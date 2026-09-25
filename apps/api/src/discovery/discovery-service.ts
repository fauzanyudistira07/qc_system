import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, lstat, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { NormalizedFlow } from '@qc/flow-schema';
import { validateFlow } from '@qc/flow-schema';
import { scanSource, type InventoryPage } from './source-scanner.ts';
import { crawlUI } from './ui-crawler.ts';
import type { DiscoveryConfig, DiscoveryJob, GeneratedFlow, Inventory, QualityAuditConfig, QualityAuditBrowser, QualityAuditViewport, FindingWorkflowStatus } from './types.ts';
import { prepareDatabase, type PreparedDatabase } from '../database/database-manager.ts';
import { buildFlows } from '../flow-builder/inventory-to-flow.ts';
import { buildReport } from '../report/report-builder.ts';
import { generatePdfReport } from '../report/report-pdf.ts';
import { executeWebFlow, type WebRunResult } from '../playwright-adapter.ts';
import { compilePlaywrightFlow } from '../playwright-generator.ts';
import { checkAndroid, executeAndroidFlow, executeAndroidRawFlow } from '../android/index.ts';
import { detectCapabilities } from './capability-model.ts';
import { buildCrudPlan } from './crud-planner.ts';
import { buildRoleActionPlan } from './role-planner.ts';


export class DiscoveryService {
  private jobs = new Map<string, DiscoveryJob>();
  private abortControllers = new Map<string, AbortController>();
  private uploads = new Map<string, { id: string; filename: string; kind: 'sql' | 'env'; content: string; size: number }>();
  private artifactRoot: string;
  private projectRoot: string;
  private demoServerProcess: any = null;
  private workspaceSnapshotTimers = new Map<string, NodeJS.Timeout>();

  constructor(artifactRoot: string, projectRoot: string) {
    this.artifactRoot = artifactRoot;
    this.projectRoot = projectRoot;
  }

  public async init(): Promise<void> {
    try {
      const jobsFile = path.join(this.artifactRoot, 'discovery-jobs.json');
      const data = await readFile(jobsFile, 'utf8');
      const loadedJobs = JSON.parse(data) as DiscoveryJob[];
      let capabilityBackfill = false;
      for (const j of loadedJobs) {
        if (j.inventory && (!j.inventory.capabilities || !j.inventory.capabilities.negativeScenarios)) {
          j.inventory.capabilities = detectCapabilities({ pages: j.inventory.pages, routes: j.inventory.routes, api: j.inventory.api });
          capabilityBackfill = true;
        }
        this.jobs.set(j.id, j);
      }
      if (capabilityBackfill) console.log(`[DiscoveryService] Backfilled capability profiles for legacy jobs.`);
      console.log(`[DiscoveryService] Loaded ${this.jobs.size} jobs from ${jobsFile}`);
    } catch (e) {
      console.log(`[DiscoveryService] Init jobs note: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const uploadsFile = path.join(this.artifactRoot, 'discovery-uploads.json');
      const data = await readFile(uploadsFile, 'utf8');
      const loadedUploads = JSON.parse(data) as any[];
      for (const u of loadedUploads) {
        this.uploads.set(u.id, u);
      }
      console.log(`[DiscoveryService] Loaded ${this.uploads.size} uploads from ${uploadsFile}`);
    } catch (e) {
      console.log(`[DiscoveryService] Init uploads note: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  public async persist(): Promise<void> {
    try {
      await mkdir(this.artifactRoot, { recursive: true });
      const jobsFile = path.join(this.artifactRoot, 'discovery-jobs.json');
      await writeFile(jobsFile, JSON.stringify(Array.from(this.jobs.values()), null, 2), 'utf8');
      const uploadsFile = path.join(this.artifactRoot, 'discovery-uploads.json');
      await writeFile(uploadsFile, JSON.stringify(Array.from(this.uploads.values()), null, 2), 'utf8');
    } catch { /* ignore */ }
  }

  public listJobs(): DiscoveryJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getJob(id: string): DiscoveryJob | undefined {
    return this.jobs.get(id);
  }

  public updateFindingStatus(id: string, findingKey: string, status: FindingWorkflowStatus): DiscoveryJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');
    if (!findingKey || findingKey.length > 240) throw new Error('Finding key tidak valid.');
    if (!['OPEN', 'IN_PROGRESS', 'READY_FOR_RETEST', 'PASSED'].includes(status)) throw new Error('Status finding tidak valid.');
    job.findingStatuses = { ...(job.findingStatuses ?? {}), [findingKey]: status };
    void this.persist();
    return job;
  }

  public saveUpload(filename: string, kind: 'sql' | 'env', content: string): { id: string; filename: string; size: number } {
    const id = randomUUID();
    const size = Buffer.byteLength(content, 'utf8');
    this.uploads.set(id, { id, filename, kind, content, size });
    void this.persist();
    return { id, filename, size };
  }

  public async saveApkUpload(
    filename: string,
    buffer: Buffer,
    metadata?: { packageId?: string; appName?: string; versionName?: string }
  ): Promise<{ id: string; filename: string; size: number; path: string; packageId?: string; appName?: string; versionName?: string }> {
    const id = randomUUID();
    const size = buffer.length;
    const uploadDir = path.join(this.artifactRoot, 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(uploadDir, `${id}-${safeName}`);
    await writeFile(filePath, buffer);
    const item = {
      id,
      filename,
      kind: 'apk' as const,
      content: '',
      size,
      path: filePath,
      packageId: metadata?.packageId,
      appName: metadata?.appName,
      versionName: metadata?.versionName
    };
    this.uploads.set(id, item as any);
    void this.persist();
    return {
      id,
      filename,
      size,
      path: filePath,
      packageId: metadata?.packageId,
      appName: metadata?.appName,
      versionName: metadata?.versionName
    };
  }

  public getUpload(id: string) {
    return this.uploads.get(id);
  }

  private makeWorkspace(configName: string) {
    const projectSlug = configName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'qc-project';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const runLabel = `${projectSlug}-${stamp}`;
    const projectPath = path.join('projects', projectSlug).split(path.sep).join('/');
    const runPath = path.join(projectPath, 'runs', runLabel).split(path.sep).join('/');
    return { projectSlug, runLabel, projectPath, runPath, milestonesPath: `${runPath}/milestones` };
  }

  private async prepareWorkspace(job: DiscoveryJob, config: DiscoveryConfig) {
    if (!job.workspace) job.workspace = this.makeWorkspace(config.name);
    const projectRoot = path.join(this.artifactRoot, job.workspace.projectPath);
    const runRoot = path.join(this.artifactRoot, job.workspace.runPath);
    const milestoneNames = [
      '01-start-analysis', '02-setup-environment', '03-discovery-inventory', '04-test-design',
      '05-execution', '06-responsive-ui', '07-evidence-retest', '08-final-report'
    ];
    await mkdir(path.join(projectRoot, 'input'), { recursive: true });
    await mkdir(path.join(runRoot, 'branches'), { recursive: true });
    await mkdir(path.join(runRoot, 'evidence', 'screenshots'), { recursive: true });
    await mkdir(path.join(runRoot, 'evidence', 'videos'), { recursive: true });
    await mkdir(path.join(runRoot, 'evidence', 'reports'), { recursive: true });
    await mkdir(path.join(runRoot, 'findings'), { recursive: true });
    await mkdir(path.join(runRoot, 'final-report'), { recursive: true });
    for (const name of milestoneNames) await mkdir(path.join(runRoot, 'milestones', name), { recursive: true });
    const safeConfig = { ...config, accounts: config.accounts.map(({ password: _password, ...account }) => account) };
    await writeFile(path.join(projectRoot, 'project.json'), JSON.stringify({ name: config.name, slug: job.workspace.projectSlug, updatedAt: new Date().toISOString(), latestRun: job.workspace.runLabel }, null, 2), 'utf8');
    await writeFile(path.join(projectRoot, 'input', 'config.json'), JSON.stringify(safeConfig, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'run.json'), JSON.stringify({ jobId: job.id, project: config.name, workspace: job.workspace, createdAt: job.createdAt, status: job.status }, null, 2), 'utf8');
    await this.writeWorkspaceSnapshot(job);
  }

  private async writeWorkspaceSnapshot(job: DiscoveryJob) {
    if (!job.workspace) return;
    const runRoot = path.join(this.artifactRoot, job.workspace.runPath);
    const milestoneRoot = path.join(runRoot, 'milestones');
    const active = job.status === 'RUNNING' || job.status === 'QUEUED';
    const phase = job.phase || '';
    const hasInventory = Boolean(job.inventory);
    const hasFlows = (job.flows?.length ?? 0) > 0;
    const hasResults = (job.results?.length ?? 0) > 0;
    const hasFailedResults = job.results.some((result) => result.status !== 'PASSED');
    const isFailed = job.status === 'FAILED' || hasFailedResults;
    const qualityRunning = active && /QUALITY/i.test(phase);
    const qualityFailed = job.qualityAudit?.status === 'FAILED' || job.qualityAudit?.status === 'ERROR';
    const qualityLimited = job.qualityAudit?.status === 'PASSED_WITH_LIMITATIONS';
    const hasQualityReport = Boolean(job.qualityAudit?.reportPath);
    const statuses = [
      { folder: '01-start-analysis', title: 'Start & Analysis', status: active && /INITIALIZING/i.test(phase) ? 'RUNNING' : job.status === 'FAILED' ? 'ATTENTION' : 'CLEAR', output: ['project.json', 'input/config.json'] },
      { folder: '02-setup-environment', title: 'Setup Environment', status: active && /PREPAR|DATABASE|RUNTIME|BOOT|ENV|STARTING_DEMO/i.test(phase) ? 'RUNNING' : 'CLEAR', output: ['run.json'] },
      { folder: '03-discovery-inventory', title: 'Discovery & Inventory', status: active && /DISCOVER|SCAN|CRAWL|INVENTORY/i.test(phase) ? 'RUNNING' : hasInventory ? 'CLEAR' : 'READY', output: hasInventory ? ['application-inventory.json', 'capability-profile.json', 'crud-plan.json', 'role-action-plan.json'] : [] },
      { folder: '04-test-design', title: 'Test Design', status: active && /FLOW|DESIGN/i.test(phase) ? 'RUNNING' : hasFlows ? 'CLEAR' : 'READY', output: hasFlows ? ['generated flows'] : [] },
      { folder: '05-execution', title: 'Execution', status: active && /RUN|EXECUTE|PLAYWRIGHT|MAESTRO/i.test(phase) ? 'RUNNING' : hasResults ? (isFailed ? 'ATTENTION' : 'CLEAR') : 'READY', output: hasResults ? ['runtime-artifacts', 'results'] : [] },
      { folder: '06-responsive-ui', title: 'Responsive & UI Quality', status: qualityRunning ? 'RUNNING' : qualityFailed || qualityLimited ? 'ATTENTION' : job.qualityAudit?.status === 'PASSED' ? 'CLEAR' : 'READY', output: hasQualityReport ? ['quality/report.json', 'quality/screenshots'] : [] },
      { folder: '07-evidence-retest', title: 'Evidence & Retest', status: hasQualityReport || hasResults ? (isFailed || qualityFailed || qualityLimited ? 'RETEST' : 'CLEAR') : 'READY', output: ['evidence/screenshots', 'evidence/videos', 'evidence/reports'] },
      { folder: '08-final-report', title: 'Defect & Final Report', status: job.finishedAt ? (isFailed || qualityFailed || qualityLimited ? 'ATTENTION' : 'CLEAR') : 'READY', output: ['final-report'] }
    ];
    await mkdir(runRoot, { recursive: true });
    await writeFile(path.join(runRoot, 'timeline.json'), JSON.stringify(job.logs, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'progress.json'), JSON.stringify({ jobId: job.id, status: job.status, phase: job.phase, progress: job.progress, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'manifest.json'), JSON.stringify({ project: job.name, workspace: job.workspace, generatedAt: new Date().toISOString(), milestones: statuses, branches: job.message ? [{ status: job.status, message: job.message }] : [] }, null, 2), 'utf8');
    for (const milestone of statuses) {
      await writeFile(path.join(milestoneRoot, milestone.folder, 'status.json'), JSON.stringify({ id: milestone.folder, title: milestone.title, status: milestone.status, output: milestone.output, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    }
    await writeFile(path.join(milestoneRoot, '03-discovery-inventory', 'job.json'), JSON.stringify({ inventory: job.inventory ?? null }, null, 2), 'utf8');
    if (job.inventory?.capabilities) {
      await writeFile(path.join(milestoneRoot, '03-discovery-inventory', 'capability-profile.json'), JSON.stringify(job.inventory.capabilities, null, 2), 'utf8');
    }
    await writeFile(path.join(milestoneRoot, '04-test-design', 'flows.json'), JSON.stringify(job.flows ?? [], null, 2), 'utf8');
    await writeFile(path.join(milestoneRoot, '05-execution', 'results.json'), JSON.stringify(job.results ?? [], null, 2), 'utf8');
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      const runtimeSource = path.join(this.artifactRoot, 'jobs', job.id);
      const runtimeTarget = path.join(runRoot, 'runtime-artifacts');
      try { await this.copyTree(runtimeSource, runtimeTarget); } catch { /* Runtime artifacts are optional. */ }
    }
    if (job.qualityAudit?.reportPath) {
      try {
        const qualityReport = path.join(this.artifactRoot, job.qualityAudit.reportPath);
        await this.copyTree(path.dirname(qualityReport), path.join(runRoot, 'evidence', 'quality'));
      } catch { /* Quality artifacts remain available from the global evidence index. */ }
    }
  }

  private async copyTree(source: string, target: string): Promise<void> {
    const metadata = await lstat(source);
    if (metadata.isDirectory()) {
      await mkdir(target, { recursive: true });
      for (const entry of await readdir(source, { withFileTypes: true })) {
        await this.copyTree(path.join(source, entry.name), path.join(target, entry.name));
      }
      return;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }

  private scheduleWorkspaceSnapshot(job: DiscoveryJob) {
    if (!job.workspace) return;
    const previous = this.workspaceSnapshotTimers.get(job.id);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.workspaceSnapshotTimers.delete(job.id);
      void this.writeWorkspaceSnapshot(job);
    }, 180);
    this.workspaceSnapshotTimers.set(job.id, timer);
  }

  public async cancelJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    if (job.status === 'RUNNING' || job.status === 'QUEUED') {
      job.status = 'CANCELLED';
      job.finishedAt = new Date().toISOString();
      job.phase = 'CANCELLED';
      job.message = 'Discovery job dibatalkan oleh pengguna.';
      this.addLog(job, 'system', 'Job dibatalkan oleh user');
    }
    return true;
  }

  public regenerateFlows(id: string): GeneratedFlow[] {
    const job = this.jobs.get(id);
    if (!job || !job.inventory) throw new Error('Job atau inventory tidak ditemukan.');
    const fullConfig: DiscoveryConfig = {
      ...job.config,
      accounts: []
    };
    const flows = buildFlows(job.inventory, fullConfig);
    job.flows = flows;
    this.addLog(job, 'discovery', `Flow dibuat ulang (${flows.length} skenario).`);
    void this.persist();
    void this.writeWorkspaceSnapshot(job);
    return flows;
  }

  public updateFlow(id: string, flowId: string, source: string): GeneratedFlow {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');
    const validation = validateFlow(source);
    if (!validation.valid || !validation.normalized) {
      throw new Error(`Flow syntax error: ${validation.errors.map(e => e.message).join('; ')}`);
    }
    const existing = job.flows.find(f => f.id === flowId);
    if (existing) {
      existing.source = source;
      existing.name = validation.normalized.name;
      existing.platform = validation.normalized.target.platform as 'web' | 'android';
      existing.status = 'READY';
      existing.reason = undefined;
      return existing;
    } else {
      const newFlow: GeneratedFlow = {
        id: flowId,
        name: validation.normalized.name,
        source,
        platform: validation.normalized.target.platform as 'web' | 'android',
        status: 'READY'
      };
      job.flows.push(newFlow);
      return newFlow;
    }
  }

  public deleteJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    const abort = this.abortControllers.get(id);
    if (abort) abort.abort();
    this.jobs.delete(id);
    this.abortControllers.delete(id);
    void this.persist();
    return true;
  }

  public async runFlows(id: string, flowIds?: string[], runtimePassword?: string): Promise<DiscoveryJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');
    const targetFlows = flowIds && flowIds.length > 0
      ? job.flows.filter(f => flowIds.includes(f.id))
      : job.flows.filter(f => f.status === 'READY' || (job.config.platform === 'android' && f.platform === 'android'));

    if (targetFlows.length === 0) {
      throw new Error('Tidak ada flow yang siap dijalankan.');
    }

    this.addLog(job, 'runner', `Memulai eksekusi ${targetFlows.length} flow...`);
    const jobArtifactDir = path.join(this.artifactRoot, 'jobs', job.id);
    await mkdir(jobArtifactDir, { recursive: true });

    const installedApks = new Set<string>();

    for (const flowItem of targetFlows) {
      // ── Deteksi raw Maestro YAML (Android native format) ──────────────────
      // Flow yang dibangun oleh inventory-to-flow.ts baru menggunakan format:
      //   appId: com.xxx.xxx
      //   name: "..."
      //   ---
      //   - tapOn: ...
      // Format ini langsung bisa dieksekusi oleh Maestro CLI tanpa perlu
      // parsing skema QC Flow terlebih dahulu.
      const isRawMaestroYaml = typeof flowItem.source === 'string' &&
        flowItem.source.trimStart().startsWith('appId:');

      if (isRawMaestroYaml && flowItem.platform === 'android') {
        const runId = `run-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
        this.addLog(job, 'runner', `Menjalankan: ${flowItem.name} (android)`);
        try {
          const apkUploadId = (job.config as any)?.apkUploadId;
          const apkUpload = apkUploadId ? this.getUpload(apkUploadId) : undefined;
          const apkPath = (apkUpload as any)?.path;
          const shouldInstall = Boolean(apkPath && !installedApks.has(apkPath));
          const runResult = await executeAndroidRawFlow(
            flowItem.source,
            flowItem.name,
            job.config.appId || 'com.sopan.digital',
            runId,
            jobArtifactDir,
            job.config.deviceId,
            undefined,
            shouldInstall ? apkPath : undefined
          );
          if (apkPath && shouldInstall) installedApks.add(apkPath);
          job.results.push({
            ...runResult,
            flowId: flowItem.id,
            runId,
            finishedAt: new Date().toISOString()
          });
          flowItem.status = runResult.status;
          this.addLog(job, 'runner', `Selesai: ${flowItem.name} -> ${runResult.status}`);
          void this.persist();
        } catch (err) {
          this.addLog(job, 'runner', `Gagal menjalankan ${flowItem.name}: ${err instanceof Error ? err.message : String(err)}`);
          flowItem.status = 'FAILED';
          job.results.push({
            status: 'INFRA_ERROR',
            steps: [],
            artifacts: [],
            flowId: flowItem.id,
            runId,
            finishedAt: new Date().toISOString()
          });
          void this.persist();
        }
        continue;
      }

      // ── Flow schema QC biasa ───────────────────────────────────────────────
      const validation = validateFlow(flowItem.source);
      if (!validation.valid || !validation.normalized) {
        this.addLog(job, 'runner', `Flow ${flowItem.name} tidak valid: skip.`);
        continue;
      }
      const normalized = validation.normalized;
      const runtimeAccount = job.config.accounts?.[0];
      const executableFlow = normalized.target.platform === 'web' && (runtimeAccount?.email || runtimePassword)
        ? {
          ...normalized,
          variables: {
            ...normalized.variables,
            ...(runtimeAccount?.email ? { QC_EMAIL: runtimeAccount.email } : {}),
            ...(runtimePassword ? { QC_PASSWORD: runtimePassword } : {}),
          },
        }
        : normalized;
      const runId = `run-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
      this.addLog(job, 'runner', `Menjalankan: ${flowItem.name} (${normalized.target.platform})`);

      try {
        let runResult: WebRunResult;
        if (normalized.target.platform === 'android') {
          const apkUploadId = (job.config as any)?.apkUploadId;
          const apkUpload = apkUploadId ? this.getUpload(apkUploadId) : undefined;
          const apkPath = (apkUpload as any)?.path;
          const shouldInstall = Boolean(apkPath && !installedApks.has(apkPath));
          runResult = await executeAndroidFlow(normalized, runId, jobArtifactDir, job.config.deviceId, undefined, shouldInstall ? apkPath : undefined);
          if (apkPath && shouldInstall) installedApks.add(apkPath);
        } else {
          runResult = await executeWebFlow(
            executableFlow,
            runId,
            job.config.baseUrl,
            jobArtifactDir,
            (step) => {
              this.addLog(job, 'runner', `Step ${step.index + 1}: ${step.action} -> ${step.status}`);
            }
          );
        }

        job.results.push({
          ...runResult,
          flowId: flowItem.id,
          runId,
          finishedAt: new Date().toISOString()
        });

        this.addLog(job, 'runner', `Selesai: ${flowItem.name} -> ${runResult.status}`);
      } catch (err) {
        this.addLog(job, 'runner', `Gagal menjalankan ${flowItem.name}: ${err instanceof Error ? err.message : String(err)}`);
        job.results.push({
          status: 'INFRA_ERROR',
          steps: [],
          artifacts: [],
          flowId: flowItem.id,
          runId,
          finishedAt: new Date().toISOString()
        });
      }
    }
    // Update and save application-report.html & application-report.pdf
    try {
      const reportHtml = buildReport(job, `/api/v1/discovery/jobs/${job.id}/artifacts/`);
      await writeFile(path.join(jobArtifactDir, 'application-report.html'), reportHtml, 'utf8');
      const pdfBuffer = await generatePdfReport(job, this.artifactRoot);
      await writeFile(path.join(jobArtifactDir, 'application-report.pdf'), pdfBuffer);
    } catch (e) {
      // non-fatal report generation error
    }

    await this.writeWorkspaceSnapshot(job);
    void this.persist();
    return job;
  }

  public async createJob(config: DiscoveryConfig): Promise<DiscoveryJob> {
    const id = randomUUID();
    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    const safeAccounts = config.accounts.map(a => ({
      name: a.name,
      email: a.email,
      role: a.role
    }));

    const job: DiscoveryJob = {
      id,
      name: config.name,
      status: 'QUEUED',
      phase: 'PREPARING',
      progress: 0,
      createdAt: new Date().toISOString(),
      logs: [],
      config: {
        ...config,
        accounts: safeAccounts
      },
      flows: [],
      results: []
    };

    await this.prepareWorkspace(job, config);
    this.jobs.set(id, job);
    void this.persist();
    this.addLog(job, 'system', `Job ${config.name} (${config.runMode}) dibuat.`);

    // Start asynchronous execution
    setImmediate(() => {
      this.executeDiscovery(job, config, abortController.signal).catch((err) => {
        job.status = 'FAILED';
        job.phase = 'FAILED';
        job.message = err instanceof Error ? err.message : String(err);
        job.finishedAt = new Date().toISOString();
        this.addLog(job, 'system', `Discovery error: ${job.message}`);
        void this.persist();
      }).finally(() => {
        void this.writeWorkspaceSnapshot(job);
        this.abortControllers.delete(id);
      });
    });

    return job;
  }

  public async updateJob(id: string, newConfig: DiscoveryConfig, restart: boolean = true): Promise<DiscoveryJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');

    const oldController = this.abortControllers.get(id);
    if (oldController) {
      oldController.abort();
      this.abortControllers.delete(id);
    }

    const safeAccounts = newConfig.accounts.map(a => ({
      name: a.name,
      email: a.email,
      role: a.role
    }));

    const defaultRules = {
      maxPages: 40,
      maxDepth: 4,
      includePaths: [],
      excludePaths: ['/logout', '/delete'],
      loginPath: '/login',
      emailSelector: "input[name='email']",
      passwordSelector: "input[type='password']",
      submitSelector: "button[type='submit']",
      successUrl: '/dashboard'
    };

    job.name = newConfig.name;
    job.config = {
      ...newConfig,
      rules: { ...defaultRules, ...(job.config?.rules || {}), ...(newConfig.rules || {}) },
      accounts: safeAccounts
    };
    void this.persist();

    if (restart) {
      job.workspace = this.makeWorkspace(newConfig.name);
      await this.prepareWorkspace(job, newConfig);
      job.status = 'QUEUED';
      job.phase = 'PREPARING';
      job.progress = 0;
      job.message = undefined;
      job.finishedAt = undefined;
      job.flows = [];
      job.results = [];
      this.addLog(job, 'system', `Konfigurasi job diperbarui. Memulai ulang discovery.`);

      const abortController = new AbortController();
      this.abortControllers.set(id, abortController);

      setImmediate(() => {
        this.executeDiscovery(job, newConfig, abortController.signal).catch((err) => {
          job.status = 'FAILED';
          job.phase = 'FAILED';
          job.message = err instanceof Error ? err.message : String(err);
          job.finishedAt = new Date().toISOString();
          this.addLog(job, 'system', `Discovery error: ${job.message}`);
        }).finally(() => {
          void this.writeWorkspaceSnapshot(job);
          this.abortControllers.delete(id);
        });
      });
    } else {
      this.addLog(job, 'system', `Konfigurasi job diperbarui.`);
    }

    return job;
  }

  public async restartJob(id: string): Promise<DiscoveryJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');

    const oldController = this.abortControllers.get(id);
    if (oldController) {
      oldController.abort();
      this.abortControllers.delete(id);
    }

    job.status = 'QUEUED';
    job.phase = 'PREPARING';
    job.progress = 0;
    job.message = undefined;
    job.finishedAt = undefined;
    job.flows = [];
    job.results = [];
    this.addLog(job, 'system', `Menjalankan ulang discovery job...`);

    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    setImmediate(() => {
      this.executeDiscovery(job, job.config as any, abortController.signal).catch((err) => {
        job.status = 'FAILED';
        job.phase = 'FAILED';
        job.message = err instanceof Error ? err.message : String(err);
        job.finishedAt = new Date().toISOString();
        this.addLog(job, 'system', `Discovery error: ${job.message}`);
      }).finally(() => {
        void this.writeWorkspaceSnapshot(job);
        this.abortControllers.delete(id);
      });
    });

    return job;
  }

  public async startQualityAudit(id: string, password: string): Promise<DiscoveryJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');
    if (job.status === 'RUNNING' || job.status === 'QUEUED') throw new Error('Job masih berjalan. Tunggu sampai selesai sebelum memulai Quality Audit.');
    if (!password?.trim()) throw new Error('Password akun audit wajib diisi.');
    if (job.config.platform !== 'web') throw new Error('Quality Audit DOM hanya tersedia untuk target web.');

    const controller = new AbortController();
    this.abortControllers.set(id, controller);
    const config = {
      ...job.config,
      accounts: (job.config.accounts ?? []).map((account) => ({ ...account, password })),
    } as unknown as DiscoveryConfig;
    job.status = 'RUNNING';
    job.phase = 'QUALITY_AUDIT';
    job.progress = 92;
    job.finishedAt = undefined;
    job.message = 'Quality Audit sedang berjalan.';
    this.addLog(job, 'quality', 'Menjalankan Quality Audit manual dari dashboard.');
    setImmediate(() => {
      this.runQualityAudit(job, config, controller.signal).finally(() => {
        if (job.status === 'RUNNING') {
          job.status = 'COMPLETED';
          job.phase = 'COMPLETED';
          job.progress = 100;
          job.finishedAt = new Date().toISOString();
          job.message = job.qualityAudit?.status === 'PASSED'
            ? 'Quality Audit selesai tanpa finding.'
            : `Quality Audit selesai dengan ${job.qualityAudit?.failed ?? 0} finding.`;
          this.addLog(job, 'system', `Quality Audit selesai. ${job.message}`);
        }
        void this.persist();
        void this.writeWorkspaceSnapshot(job);
        this.abortControllers.delete(id);
      });
    });
    return job;
  }

  private addLog(job: DiscoveryJob, category: string, message: string) {
    const entry = {
      time: new Date().toISOString(),
      category,
      message
    };
    job.logs.push(entry);
    if (job.logs.length > 2000) job.logs.shift();
    this.scheduleWorkspaceSnapshot(job);
  }

  private async ensureDemoServer(): Promise<string> {
    // If not already running, spawn demo server
    const demoUrl = 'http://127.0.0.1:4173';
    try {
      const ping = await fetch(`${demoUrl}/login`, { signal: AbortSignal.timeout(1000) });
      if (ping.ok || ping.status === 404) return demoUrl;
    } catch {
      // not running yet, start it
    }

    if (!this.demoServerProcess) {
      const demoPath = path.join(this.projectRoot, 'apps/demo-app/server.js');
      this.demoServerProcess = spawn('node', [demoPath], {
        windowsHide: true,
        stdio: 'ignore'
      });
      // Give it 1 second to bind port
      await new Promise(r => setTimeout(r, 1000));
    }
    return demoUrl;
  }

  private qualityConfig(config: DiscoveryConfig): QualityAuditConfig {
    const source = config.qualityAudit ?? {} as Partial<QualityAuditConfig>;
    const browsers = (source.browsers ?? ['chromium', 'firefox', 'webkit']).filter((item): item is QualityAuditBrowser => ['chromium', 'firefox', 'webkit'].includes(item));
    const viewports = (source.viewports ?? ['desktop', 'tablet', 'mobile']).filter((item): item is QualityAuditViewport => ['desktop', 'tablet', 'mobile'].includes(item));
    return {
      enabled: source.enabled !== false,
      browsers: browsers.length ? browsers : ['chromium'],
      viewports: viewports.length ? viewports : ['desktop'],
      maxRoutes: Math.min(1000, Math.max(0, Number(source.maxRoutes) || 0)),
      routeOffset: Math.max(0, Number(source.routeOffset) || 0),
      navigationTimeoutMs: Math.min(180000, Math.max(10000, Number(source.navigationTimeoutMs) || 60000)),
      accessibility: source.accessibility !== false,
      stateTesting: {
        enabled: source.stateTesting?.enabled !== false,
        hover: source.stateTesting?.hover !== false,
        focus: source.stateTesting?.focus !== false,
        disabled: source.stateTesting?.disabled !== false,
        loading: source.stateTesting?.loading !== false,
        empty: source.stateTesting?.empty !== false,
        error: source.stateTesting?.error !== false,
      },
      screenReader: {
        mode: source.screenReader?.mode === 'external' ? 'external' : 'semantic',
        command: source.screenReader?.command,
        timeoutMs: Math.min(60000, Math.max(1000, Number(source.screenReader?.timeoutMs ?? 10000) || 10000)),
      },
      visualRegression: {
        mode: source.visualRegression?.mode === 'off' || source.visualRegression?.mode === 'capture' ? source.visualRegression.mode : 'required',
        baselineDir: source.visualRegression?.baselineDir,
        updateBaseline: source.visualRegression?.updateBaseline === true,
        pixelThreshold: Math.min(1, Math.max(0, Number(source.visualRegression?.pixelThreshold ?? 0.1) || 0.1)),
        allowedDiffPercent: Math.min(100, Math.max(0, Number(source.visualRegression?.allowedDiffPercent ?? 0.5) || 0.5)),
      },
      denseData: {
        enabled: source.denseData?.enabled !== false,
        syntheticRows: Math.min(1000, Math.max(20, Number(source.denseData?.syntheticRows) || 100)),
        longTextLength: Math.min(2000, Math.max(40, Number(source.denseData?.longTextLength) || 240)),
      },
      negativeTesting: {
        enabled: source.negativeTesting?.enabled !== false,
        emptyFormValidation: source.negativeTesting?.emptyFormValidation !== false,
        duplicateSubmissionGuard: source.negativeTesting?.duplicateSubmissionGuard !== false,
        networkFailureHandling: source.negativeTesting?.networkFailureHandling !== false,
        transactionalScenarios: source.negativeTesting?.transactionalScenarios !== false,
        fixtureReportPath: source.negativeTesting?.fixtureReportPath,
        mutationFixturePath: source.negativeTesting?.mutationFixturePath,
        runMutations: source.negativeTesting?.runMutations === true,
      },
    };
  }

  private async runQualityAudit(job: DiscoveryJob, config: DiscoveryConfig, signal: AbortSignal): Promise<void> {
    const settings = this.qualityConfig(config);
    job.phase = 'QUALITY_AUDIT';
    job.progress = 92;
    job.qualityAudit = {
      status: settings.enabled ? 'QUEUED' : 'SKIPPED',
      startedAt: new Date().toISOString(),
      browsers: settings.browsers,
      viewports: settings.viewports,
    };
    this.addLog(job, 'quality', `▶ [Stage 6/8] Quality Audit ${settings.enabled ? 'dimulai' : 'dilewati'} — browsers: ${settings.browsers.join(', ')} | viewport: ${settings.viewports.join(', ')}.`);

    if (!settings.enabled) {
      job.qualityAudit.finishedAt = new Date().toISOString();
      this.addLog(job, 'quality', 'Quality Audit dinonaktifkan pada konfigurasi run.');
      return;
    }

    if (config.platform !== 'web') {
      job.qualityAudit.status = 'SKIPPED';
      job.qualityAudit.message = 'Quality Audit DOM hanya berlaku untuk target web.';
      job.qualityAudit.finishedAt = new Date().toISOString();
      this.addLog(job, 'quality', 'Quality Audit dilewati: target bukan aplikasi web.');
      return;
    }

    const password = config.accounts.find((account) => Boolean(account.password?.trim()))?.password;
    if (!password) {
      job.qualityAudit.status = 'ERROR';
      job.qualityAudit.message = 'Password akun audit belum tersedia. Isi ulang akun tester lalu jalankan ulang.';
      job.qualityAudit.finishedAt = new Date().toISOString();
      this.addLog(job, 'quality', `Quality Audit berhenti: ${job.qualityAudit.message}`);
      return;
    }

    const scriptPath = path.join(this.projectRoot, 'scripts', 'test-target-quality.cjs');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      QC_TARGET_BASE_URL: config.baseUrl,
      QC_TARGET_JOB_ID: job.id,
      QC_TARGET_PASSWORD: password,
      QC_TARGET_NAME: config.name,
      QC_AUDIT_ACCOUNTS: JSON.stringify(config.accounts.map((account) => ({ email: account.email, password: account.password, role: account.role, name: account.name }))),
      QC_BROWSERS: settings.browsers.join(','),
      QC_VIEWPORTS: settings.viewports.join(','),
      QC_MAX_ROUTES: String(settings.maxRoutes),
      QC_ROUTE_OFFSET: String(settings.routeOffset),
      QC_NAV_TIMEOUT_MS: String(settings.navigationTimeoutMs),
      QC_LOGIN_TIMEOUT_MS: String(Math.min(settings.navigationTimeoutMs, 10000)),
      QC_AUDIT_SESSION: `quality-${job.id}-${Date.now()}`,
      QC_ACCESSIBILITY: String(settings.accessibility !== false),
      QC_VISUAL_REGRESSION_MODE: settings.visualRegression?.mode || 'required',
      QC_VISUAL_BASELINE_DIR: settings.visualRegression?.baselineDir || '',
      QC_UPDATE_BASELINE: String(settings.visualRegression?.updateBaseline === true),
      QC_PIXEL_THRESHOLD: String(settings.visualRegression?.pixelThreshold ?? 0.1),
      QC_ALLOWED_DIFF_PERCENT: String(settings.visualRegression?.allowedDiffPercent ?? 0.5),
      QC_DENSE_DATA: String(settings.denseData?.enabled !== false),
      QC_SYNTHETIC_ROWS: String(settings.denseData?.syntheticRows ?? 100),
      QC_LONG_TEXT_LENGTH: String(settings.denseData?.longTextLength ?? 240),
      QC_NEGATIVE_TESTING: String(settings.negativeTesting?.enabled !== false),
      QC_EMPTY_FORM_VALIDATION: String(settings.negativeTesting?.emptyFormValidation !== false),
      QC_DUPLICATE_SUBMISSION_GUARD: String(settings.negativeTesting?.duplicateSubmissionGuard !== false),
      QC_NETWORK_FAILURE_HANDLING: String(settings.negativeTesting?.networkFailureHandling !== false),
      QC_STATE_TESTING: String(settings.stateTesting?.enabled !== false),
      QC_STATE_HOVER: String(settings.stateTesting?.hover !== false),
      QC_STATE_FOCUS: String(settings.stateTesting?.focus !== false),
      QC_STATE_DISABLED: String(settings.stateTesting?.disabled !== false),
      QC_STATE_LOADING: String(settings.stateTesting?.loading !== false),
      QC_STATE_EMPTY: String(settings.stateTesting?.empty !== false),
      QC_STATE_ERROR: String(settings.stateTesting?.error !== false),
      QC_SCREEN_READER_MODE: settings.screenReader?.mode || 'semantic',
      QC_SCREEN_READER_COMMAND: settings.screenReader?.command || '',
      QC_SCREEN_READER_TIMEOUT_MS: String(settings.screenReader?.timeoutMs ?? 10000),
      QC_TRANSACTIONAL_SCENARIOS: String(settings.negativeTesting?.transactionalScenarios !== false),
      QC_FIXTURE_REPORT_PATH: settings.negativeTesting?.fixtureReportPath || '',
    };

    const routeBudgetLabel = settings.maxRoutes > 0 ? `${settings.routeOffset + 1}–${settings.routeOffset + settings.maxRoutes}` : `semua route unik mulai offset ${settings.routeOffset}`;
    const mutationFixturePath = settings.negativeTesting?.mutationFixturePath;
    const mutationReportPath = path.join(this.artifactRoot, 'jobs', job.id, 'quality', 'crud-mutations', 'report.json');
    if (settings.negativeTesting?.runMutations === true && mutationFixturePath) {
      this.addLog(job, 'quality', `Mutation CRUD aktif dengan fixture ${mutationFixturePath}.`);
      await new Promise<void>((resolve) => {
        const mutationScript = path.join(this.projectRoot, 'scripts', 'run-crud-mutations.cjs');
        const mutationEnv: NodeJS.ProcessEnv = { ...env, QC_TARGET_EMAIL: config.accounts.find((account) => Boolean(account.email?.trim()))?.email || '', QC_MUTATION_FIXTURE_PATH: mutationFixturePath, QC_MUTATION_REPORT_PATH: mutationReportPath };
        const child = spawn(process.argv[0], [mutationScript], { cwd: this.projectRoot, env: mutationEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', (chunk: Buffer) => this.addLog(job, 'quality', chunk.toString().trim()));
        child.stderr.on('data', (chunk: Buffer) => this.addLog(job, 'quality', `mutation: ${chunk.toString().trim()}`));
        child.on('close', (code) => { this.addLog(job, 'quality', `Mutation CRUD selesai dengan exit code ${code ?? 1}.`); resolve(); });
        child.on('error', (error) => { this.addLog(job, 'quality', `Mutation CRUD tidak dapat dijalankan: ${error.message}`); resolve(); });
      });
      env.QC_FIXTURE_REPORT_PATH = mutationReportPath;
    }
    this.addLog(job, 'quality', `Target: ${config.baseUrl} | route budget: ${routeBudgetLabel} | timeout: ${settings.navigationTimeoutMs}ms.`);
    this.addLog(job, 'quality', 'Menyiapkan Playwright browser, akun audit, dan folder screenshot...');
    job.qualityAudit!.status = 'RUNNING';
    this.addLog(job, 'quality', 'Quality Audit runner aktif; dashboard sekarang menandai status sebagai RUNNING.');

    await new Promise<void>((resolve, reject) => {
      let output = '';
      let finalResult: { status?: string; total?: number; passed?: number; failed?: number; notApplicable?: number; runDir?: string } | undefined;
      let settled = false;
      const child = spawn(process.argv[0], [scriptPath], { cwd: this.projectRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const consume = (chunk: Buffer, isError = false) => {
        output += chunk.toString();
        const lines = output.split(/\r?\n/);
        output = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          if (line.startsWith('QC_LOG\t')) {
            const [, category, ...message] = line.split('\t');
            this.addLog(job, category || 'quality', message.join('\t'));
            continue;
          }
          if (line.startsWith('{') && line.endsWith('}')) {
            try { finalResult = JSON.parse(line); continue; } catch { /* regular output */ }
          }
          this.addLog(job, 'quality', `${isError ? '[stderr] ' : ''}${line.slice(0, 1000)}`);
        }
      };
      const abort = () => child.kill('SIGTERM');
      signal.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', (chunk) => consume(chunk));
      child.stderr.on('data', (chunk) => consume(chunk, true));
      child.once('error', (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        reject(error);
      });
      child.once('close', async (code) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        if (output.trim()) consume(Buffer.from('\n'));
        if (signal.aborted) {
          reject(new Error('Quality Audit dibatalkan oleh user.'));
          return;
        }
        let report: {
          status?: string;
          total?: number;
          passed?: number;
          failed?: number;
          notApplicable?: number;
          categories?: Record<string, { total: number; passed: number; failed: number; notApplicable?: number }>;
          visualRegression?: { mode?: any; baselinesCompared?: number; baselinesCaptured?: number; changed?: number; missing?: number };
        } | undefined;
        if (finalResult?.runDir) {
          try {
            report = JSON.parse(await readFile(path.join(finalResult.runDir, 'report.json'), 'utf8'));
            job.qualityAudit!.reportPath = path.relative(this.artifactRoot, path.join(finalResult.runDir, 'report.json')).split(path.sep).join('/');
          } catch { /* final stdout still contains useful status */ }
        }
        if (code !== 0 && !report) {
          reject(new Error(`Quality Audit process berhenti dengan exit code ${code ?? 'unknown'}.`));
          return;
        }
        const result = report ?? finalResult ?? {};
        job.qualityAudit!.status = result.status === 'PASSED_WITH_LIMITATIONS'
          ? 'PASSED_WITH_LIMITATIONS'
          : result.status === 'PASSED' ? 'PASSED' : 'FAILED';
        job.qualityAudit!.total = result.total;
        job.qualityAudit!.passed = result.passed;
        job.qualityAudit!.failed = result.failed;
        job.qualityAudit!.notApplicable = result.notApplicable;
        job.qualityAudit!.categories = report?.categories;
        job.qualityAudit!.visualRegression = report?.visualRegression;
        job.qualityAudit!.finishedAt = new Date().toISOString();
        this.addLog(job, 'quality', `Quality Audit selesai: ${result.passed ?? 0}/${result.total ?? 0} check lulus, ${result.failed ?? 0} finding, status ${result.status ?? 'FAILED'}.`);
        resolve();
      });
    }).catch((error) => {
      job.qualityAudit!.status = signal.aborted ? 'SKIPPED' : 'ERROR';
      job.qualityAudit!.message = error instanceof Error ? error.message : String(error);
      job.qualityAudit!.finishedAt = new Date().toISOString();
      this.addLog(job, 'quality', `Quality Audit tidak selesai: ${job.qualityAudit!.message}`);
    });
  }

  private async executeDiscovery(job: DiscoveryJob, config: DiscoveryConfig, signal: AbortSignal): Promise<void> {
    const isMobile = config.platform === 'android';
    const platformLabel = isMobile ? '📱 Mobile / Android' : '🌐 Web Application';

    job.status = 'RUNNING';
    job.phase = 'INITIALIZING';
    job.progress = 5;
    this.addLog(job, 'system', `Memulai engine discovery — Platform: ${platformLabel}`);
    this.addLog(job, 'system', `Project: "${config.name}" | Mode: ${config.runMode}`);

    const jobArtifactDir = path.join(this.artifactRoot, 'jobs', job.id);
    const screenshotDir = path.join(jobArtifactDir, 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    let dbCleanup: (() => Promise<void>) | undefined;
    let targetBaseUrl = config.baseUrl;

    try {
      signal.throwIfAborted();

      // 1. Runtime & Test Data Preparation
      if (config.runMode === 'demo') {
        job.phase = 'STARTING_DEMO_APP';
        job.progress = 15;
        this.addLog(job, 'system', '▶ [Stage 1/6] Menyiapkan server aplikasi demo...');
        this.addLog(job, 'system', 'Menjalankan dev server lokal untuk mode demo...');
        targetBaseUrl = await this.ensureDemoServer();
        this.addLog(job, 'system', `✓ Server demo aktif di ${targetBaseUrl}`);
      } else if (config.runMode === 'managed-local') {
        job.phase = 'PREPARING_RUNTIME';
        job.progress = 10;
        this.addLog(job, 'runtime', `▶ [Stage 1/6] Menyiapkan runtime managed-local (stack: ${config.stack})...`);
        this.addLog(job, 'runtime', `Target URL: ${config.baseUrl}`);

        if (config.database.engine !== 'none') {
          job.phase = 'PREPARING_DATABASE';
          job.progress = 20;
          this.addLog(job, 'database', `▶ [Stage 2/6] Membuat isolated container untuk database ${config.database.engine}...`);
          this.addLog(job, 'database', `Sumber data: ${config.database.source}. Menginisialisasi container...`);
          
          let sqlContent: string | undefined;
          if (config.database.source === 'sql' && config.database.sqlUploadId) {
            const up = this.uploads.get(config.database.sqlUploadId);
            sqlContent = up?.content;
          }

          const workspaceDir = path.join(jobArtifactDir, 'workspace');
          await mkdir(workspaceDir, { recursive: true });

          try {
            const db = await prepareDatabase({
              config: config.database,
              runId: `qc-${job.id.slice(0, 12)}`,
              networkName: `qc-net-${job.id.slice(0, 12)}`,
              workspace: workspaceDir,
              sqlContent,
              signal,
              log: (msg) => this.addLog(job, 'database', msg)
            });
            dbCleanup = db.cleanup;
            this.addLog(job, 'database', 'Database isolated siap.');
          } catch (dbErr) {
            this.addLog(job, 'database', `Peringatan: Bootstrap database kontainer tidak dapat diselesaikan: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}. Melanjutkan pengujian target.`);
          }
        }
      } else {
        this.addLog(job, 'runtime', `▶ [Stage 1/6] Memakai target existing: ${config.baseUrl}`);
        this.addLog(job, 'database', '▶ [Stage 2/6] Database Bootstrap dilewati karena mode existing-target memakai database aplikasi aktif.');
      }

      // 2. Static Source Scanning
      const stageLabel = isMobile ? '3' : '3';
      job.phase = 'SCANNING_SOURCE';
      job.progress = 35;
      let initialPages: InventoryPage[] = [];
      let routes: Array<{ path: string; method: string; source: string }> = [];
      let api: Array<{ path: string; method: string; source: string }> = [];
      let filesScanned = 0;
      let warnings: string[] = [];

      let scanTargetDir = '';
      if (config.runMode === 'demo') {
        scanTargetDir = path.join(this.projectRoot, 'apps/demo-app');
      } else if (config.repositoryUrl && !config.repositoryUrl.startsWith('http')) {
        // Local path repository
        scanTargetDir = config.repositoryUrl;
      } else if (config.repositoryUrl && config.repositoryUrl.startsWith('http')) {
        // Check if repository exists locally in standard directories (e.g. C:/xampp/htdocs/<repo>)
        const repoName = config.repositoryUrl.split('/').pop()?.replace(/\.git$/, '');
        if (repoName) {
          const candidates = [
            path.join('C:', 'xampp', 'htdocs', repoName),
            path.join('C:', 'xampp', 'htdocs', repoName.charAt(0).toUpperCase() + repoName.slice(1)),
            path.join('C:', 'xampp', 'htdocs', repoName.toLowerCase()),
            path.join('E:', 'projek', repoName)
          ];
          for (const cand of candidates) {
            try {
              const stat = await lstat(cand);
              if (stat.isDirectory()) {
                scanTargetDir = cand;
                this.addLog(job, 'discovery', `Repository remote '${config.repositoryUrl}' ditemukan pada folder lokal: ${cand}`);
                break;
              }
            } catch {}
          }
        }
      }

      if (scanTargetDir) {
        const extLabel = isMobile ? '.dart / .kt / .java' : '.tsx / .vue / .php / .blade';
        this.addLog(job, 'discovery', `▶ [Stage ${stageLabel}/6] Static code analysis dimulai...`);
        this.addLog(job, 'discovery', `📂 Target direktori: ${scanTargetDir}`);
        this.addLog(job, 'discovery', `🔍 Mencari file sumber (${extLabel})...`);
        try {
          const scan = await scanSource(scanTargetDir);
          initialPages = scan.pages;
          routes = scan.routes;
          api = scan.api;
          filesScanned = scan.filesScanned;
          warnings = scan.warnings;
          this.addLog(job, 'discovery', `✓ Scan selesai: ${filesScanned} file dibaca.`);
          this.addLog(job, 'discovery', `📋 Ditemukan: ${initialPages.length} layar/halaman, ${routes.length} route, ${api.length} endpoint API.`);
          if (warnings.length > 0) {
            this.addLog(job, 'discovery', `⚠ ${warnings.length} peringatan ditemukan selama scan.`);
          }
        } catch (scanErr) {
          this.addLog(job, 'discovery', `⚠ Scan source dilewati/gagal: ${scanErr instanceof Error ? scanErr.message : String(scanErr)}`);
        }
      } else {
        this.addLog(job, 'discovery', '▶ [Stage 3/6] Static source scanning...');
        this.addLog(job, 'discovery', 'Target adalah URL remote — static scan dilewati, lanjut ke dynamic crawl.');
      }

      // 3. Target Preparation & Discovery
      let observedPages: InventoryPage[] = [];

      if (config.platform === 'android') {
        job.phase = 'PREPARING_MOBILE';
        job.progress = 55;
        this.addLog(job, 'system', `▶ [Stage 4/6] Persiapan target platform Mobile / Android`);
        this.addLog(job, 'system', `📱 App ID: ${config.appId || '(tidak disetel)'}`);
        this.addLog(job, 'system', `📱 Device Target: ${config.deviceId || 'perangkat ADB pertama yang terhubung'}`);
        this.addLog(job, 'system', `🔗 Backend API yang diuji: ${targetBaseUrl || '(tidak ada — standalone mobile test)'}`);
        this.addLog(job, 'system', 'Playwright browser crawler DILEWATI — platform native mobile tidak menggunakan DOM HTML.');

        if (targetBaseUrl && targetBaseUrl.startsWith('http')) {
          this.addLog(job, 'system', `⏳ Memeriksa keterjangkauan Backend API: ${targetBaseUrl}...`);
          try {
            await fetch(targetBaseUrl, { signal: AbortSignal.timeout(3000) });
            this.addLog(job, 'system', `✓ Backend API dapat dijangkau dari jaringan lokal.`);
          } catch {
            this.addLog(job, 'system', `ℹ Backend API tidak merespons ping — mungkin hanya menerima request dari emulator/device (10.0.2.2).`);
          }
        }
        job.progress = 60;
        this.addLog(job, 'system', `🗂 Menggunakan hasil static scan: ${initialPages.length} layar terdeteksi dari source code.`);
        this.addLog(job, 'system', 'Membangun inventory dari data static analysis...');

        observedPages = [{
          id: 'android-main',
          path: config.appId || 'com.sopan.digital',
          title: config.name || 'Mobile App Main Activity',
          state: 'observed',
          elements: [
            { type: 'input', name: 'NIS / Email', selector: 'text:NIS / Email' },
            { type: 'input', name: 'Password', selector: 'text:Password' },
            { type: 'button', name: 'Masuk', selector: 'text:Masuk' }
          ]
        }];
      } else {
        job.phase = 'CRAWLING_UI';
        job.progress = 55;
        this.addLog(job, 'browser', '▶ [Stage 4/6] Dynamic Playwright Crawl dimulai...');
        this.addLog(job, 'browser', `Memulai dynamic Playwright crawler pada ${targetBaseUrl}...`);

        try {
          const crawlAccounts = config.accounts.map(a => ({
            email: a.email,
            password: a.password,
            role: a.role
          }));

          observedPages = await crawlUI(
            targetBaseUrl,
            initialPages,
            jobArtifactDir,
            config.rules,
            crawlAccounts,
            signal,
            (msg) => this.addLog(job, 'browser', msg)
          );

          this.addLog(job, 'browser', `UI crawler selesai. ${observedPages.filter(p => p.state === 'observed').length} halaman berhasil diobservasi.`);
        } catch (crawlErr) {
          this.addLog(job, 'browser', `Crawl UI gagal atau terpotong: ${crawlErr instanceof Error ? crawlErr.message : String(crawlErr)}`);
          if (initialPages.length > 0) {
            observedPages = initialPages;
          } else {
            observedPages = [{
              id: 'root',
              path: '/',
              title: 'Home Page (Candidate)',
              state: 'candidate',
              elements: []
            }];
          }
        }
      }

      // 4. Inventory Building
      job.phase = 'BUILDING_INVENTORY';
      job.progress = 75;
      this.addLog(job, 'discovery', `▶ [Stage 4/6] Membangun Application Inventory...`);
      this.addLog(job, 'discovery', `📊 Total halaman/layar: ${observedPages.length} (${observedPages.filter(p => p.state === 'observed').length} sudah diobservasi)`);
      this.addLog(job, 'discovery', `📡 Route HTTP: ${routes.length} | Endpoint API: ${api.length} | File discan: ${filesScanned}`);
      const capabilities = detectCapabilities({ pages: observedPages, routes, api });
      const crudPlan = buildCrudPlan({ pages: observedPages, routes, api });
      const roleActionPlan = buildRoleActionPlan({ pages: observedPages, accounts: config.accounts });
      const inventory: Inventory = {
        pages: observedPages,
        routes,
        api,
        filesScanned,
        warnings,
        generatedAt: new Date().toISOString(),
        capabilities,
        crudPlan,
        roleActionPlan
      };
      job.inventory = inventory;
      this.addLog(job, 'discovery', `Capability profile: ${capabilities.detectedCount}/${capabilities.totalCatalogCapabilities} kemampuan terdeteksi.`);
      this.addLog(job, 'flow-builder', `CRUD matrix: ${crudPlan.totals.resources} resource, ${crudPlan.totals.available} operasi terobservasi, ${crudPlan.totals.requiresFixture} operasi membutuhkan fixture.`);
      this.addLog(job, 'flow-builder', `Role/action matrix: ${roleActionPlan.totals.rows} kombinasi halaman-role, ${roleActionPlan.totals.runtime} perlu verifikasi runtime.`);
      this.addLog(job, 'discovery', `Domain hints: ${capabilities.domainHints.join(', ')}.`);
      capabilities.capabilities.slice(0, 12).forEach((capability) => {
        this.addLog(job, 'discovery', `  [${capability.status.toUpperCase()}] ${capability.label} (${Math.round(capability.confidence * 100)}%) — ${capability.evidence.routes.length} route, ${capability.evidence.apiRoutes.length} API evidence.`);
      });
      this.addLog(job, 'discovery', '💾 Menyimpan application-inventory.json ke disk...');

      // Save application-inventory.json
      await writeFile(
        path.join(jobArtifactDir, 'application-inventory.json'),
        JSON.stringify(inventory, null, 2),
        'utf8'
      );
      await writeFile(
        path.join(jobArtifactDir, 'capability-profile.json'),
        JSON.stringify(capabilities, null, 2),
        'utf8'
      );
      await writeFile(
        path.join(jobArtifactDir, 'crud-plan.json'),
        JSON.stringify(crudPlan, null, 2),
        'utf8'
      );
      await writeFile(
        path.join(jobArtifactDir, 'role-action-plan.json'),
        JSON.stringify(roleActionPlan, null, 2),
        'utf8'
      );
      this.addLog(job, 'discovery', '✓ Inventory tersimpan.');

      // 5. Flow Generation
      job.phase = 'GENERATING_FLOWS';
      job.progress = 85;
      const flowPlatformLabel = isMobile ? 'Maestro YAML (Android)' : 'Playwright spec.ts (Web)';
      this.addLog(job, 'flow-builder', `▶ [Stage 5/6] Menghasilkan skenario QC otomatis (${flowPlatformLabel})...`);
      this.addLog(job, 'flow-builder', `🔧 Menganalisis ${observedPages.length} layar untuk membuat skenario pengujian...`);
      const flows = buildFlows(inventory, { ...config, baseUrl: targetBaseUrl });
      job.flows = flows;
      this.addLog(job, 'flow-builder', `✓ ${flows.length} flow skenario berhasil dibuat.`);
      flows.forEach((f, i) => {
        this.addLog(job, 'flow-builder', `  [${i + 1}] ${f.name} (${f.platform}) — status: ${f.status}`);
      });

      // Save Playwright specs & yaml artifacts
      const playwrightDir = path.join(jobArtifactDir, 'playwright');
      await mkdir(playwrightDir, { recursive: true });
      for (const f of flows) {
        const val = validateFlow(f.source);
        if (val.valid && val.normalized) {
          if (val.normalized.target.platform === 'web') {
            const code = compilePlaywrightFlow(val.normalized);
            await writeFile(path.join(playwrightDir, `${f.id}.spec.ts`), code, 'utf8');
          }
        }
      }

      // Save HTML report
      const reportHtml = buildReport(job, `/api/v1/discovery/jobs/${job.id}/artifacts/`);
      await writeFile(path.join(jobArtifactDir, 'application-report.html'), reportHtml, 'utf8');

      // 6. Execution (if requested)
      if (config.executeFlows && flows.length > 0) {
        job.phase = 'EXECUTING_TESTS';
        job.progress = 90;
        await this.runFlows(job.id);
      }

      if (!isMobile) await this.runQualityAudit(job, config, signal);

      // Completion
      job.status = 'COMPLETED';
      job.phase = 'COMPLETED';
      job.progress = 100;
      job.finishedAt = new Date().toISOString();
      job.message = `Discovery selesai. ${inventory.pages.length} layar terpetakan, ${flows.length} skenario dihasilkan.`;
      this.addLog(job, 'system', '════════════════════════════════════════');
      this.addLog(job, 'system', `✅ ${job.message}`);
      this.addLog(job, 'system', `🕒 Selesai pada: ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'medium' }).format(new Date())} WIB`);
      this.addLog(job, 'system', '════════════════════════════════════════');

    } catch (err) {
      job.status = 'FAILED';
      job.phase = 'FAILED';
      job.finishedAt = new Date().toISOString();
      job.message = err instanceof Error ? err.message : String(err);
      this.addLog(job, 'system', `Gagal: ${job.message}`);
    } finally {
      if (dbCleanup) {
        try {
          await dbCleanup();
          this.addLog(job, 'database', 'Isolated database dibersihkan.');
        } catch (cleanErr) {
          this.addLog(job, 'database', `Database cleanup warning: ${cleanErr instanceof Error ? cleanErr.message : String(cleanErr)}`);
        }
      }
      void this.persist();
    }
  }
}

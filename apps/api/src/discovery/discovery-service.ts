import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, lstat, readdir, copyFile, rename } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import type { NormalizedFlow } from '@qc/flow-schema';
import { validateFlow } from '@qc/flow-schema';
import { scanSource, type InventoryPage } from './source-scanner.ts';
import { crawlUI } from './ui-crawler.ts';
import type {
  CoverageGapItem,
  DiscoveryConfig,
  DiscoveryJob,
  EnvProvisionResult,
  GeneratedFlow,
  Inventory,
  Phase1ReconSummary,
  QualityAuditConfig,
  QualityAuditBrowser,
  QualityAuditViewport,
  FindingWorkflowStatus,
} from './types.ts';
import { prepareDatabase, type PreparedDatabase } from '../database/database-manager.ts';
import { buildFlows } from '../flow-builder/inventory-to-flow.ts';
import { generatePostAccCommandPlan } from '../flow-builder/command-generator.ts';
import { buildReport } from '../report/report-builder.ts';
import { buildJsonReport } from '../report/report-json.ts';
import { generatePdfReport } from '../report/report-pdf.ts';
import { executeWebFlow, createWebRecordingSession, finishWebRecordingSession, type WebRunResult, type WebRecordingSession } from '../playwright-adapter.ts';
import { runManagedProject, type ManagedProject } from '../project-runner.ts';
import { compilePlaywrightFlow } from '../playwright-generator.ts';
import {
  buildApkFromMobileRepo,
  checkAndroid,
  ensureDeviceReady,
  executeAndroidFlow,
  executeAndroidRawFlow,
  inspectApk,
  installApkToDevice,
  notifyAndroidJobFinished,
  notifyAndroidJobStarted,
  setEmulatorReviewHold,
  setupAdbReverse,
  stopAllManagedEmulators,
} from '../android/index.ts';
import { exploreAndroidScreensForRecon } from '../android/mobile-explorer.ts';
import { detectCapabilities } from './capability-model.ts';
import { buildCrudPlan } from './crud-planner.ts';
import { buildRoleActionPlan } from './role-planner.ts';
import { buildFeatureContractPlan } from './feature-contract.ts';
import { buildBusinessFlowMap, refreshBusinessFlowSummary, type BusinessFlowMap } from './business-flow.ts';
import { runtimePolicy } from '../runtime-policy.ts';
import { analyzeCommitImpact } from './impact-analyzer.ts';
import { GeminiService } from '../gemini-service.ts';
import { provisionEnvFiles } from '../env-provisioner.ts';
import { provisionRoleAccounts, type RuntimeRoleCredential } from '../auth-role-provisioner.ts';
import { captureAndroidLongScreenshots, captureWebLongScreenshots } from '../media/long-screenshot.ts';
import { recordAndroidRoleVideos, recordWebRoleVideos } from '../media/video-recorder.ts';


export class DiscoveryService {
  private jobs = new Map<string, DiscoveryJob>();
  private abortControllers = new Map<string, AbortController>();
  private uploads = new Map<
    string,
    {
      id: string;
      filename: string;
      kind: 'sql' | 'env' | 'apk';
      content: string;
      size: number;
      path?: string;
      packageId?: string;
      appName?: string;
      versionName?: string;
    }
  >();
  private artifactRoot: string;
  private projectRoot: string;
  private demoServerProcess: any = null;
  private workspaceSnapshotTimers = new Map<string, NodeJS.Timeout>();
  private businessFlowWaiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  // Runtime role credentials & secrets stay purely in memory per active job and are never persisted to disk.
  private runtimeRoleCredentials = new Map<string, Map<string, RuntimeRoleCredential>>();
  private jobSecrets = new Map<string, Set<string>>();

  constructor(artifactRoot: string, projectRoot: string) {
    this.artifactRoot = artifactRoot;
    this.projectRoot = projectRoot;
  }

  public getPrimaryRuntimeCredential(jobId: string): { identifier: string; password: string; role: string } | undefined {
    const roleMap = this.runtimeRoleCredentials.get(jobId);
    if (!roleMap) return undefined;
    for (const cred of roleMap.values()) {
      if (cred.identifier && cred.password) {
        return { identifier: cred.identifier, password: cred.password, role: cred.role };
      }
    }
    return undefined;
  }

  private registerSecret(jobId: string, secret?: string): void {
    if (!secret || secret.length < 4) return;
    let set = this.jobSecrets.get(jobId);
    if (!set) {
      set = new Set<string>();
      this.jobSecrets.set(jobId, set);
    }
    set.add(secret);
  }

  private scrubForJob(jobId: string, text: string): string {
    const extra = [...(this.jobSecrets.get(jobId) ?? [])];
    return GeminiService.scrubSecrets(text, extra);
  }

  public async init(): Promise<void> {
    try {
      const jobsFile = path.join(this.artifactRoot, 'discovery-jobs.json');
      const data = await readFile(jobsFile, 'utf8');
      const loadedJobs = JSON.parse(data) as DiscoveryJob[];
      let capabilityBackfill = false;
      let activeJobIdFromDisk: string | null = null;
      try {
        const activeFile = path.join(this.projectRoot, '.active-qc-job.json');
        if (existsSync(activeFile)) {
          const parsed = JSON.parse(readFileSync(activeFile, 'utf8'));
          activeJobIdFromDisk = parsed.jobId || null;
        }
      } catch {}

      for (const j of loadedJobs) {
        if (['QUEUED', 'RUNNING'].includes(j.status)) {
          if (activeJobIdFromDisk === j.id) {
            // Biarkan status RUNNING tetap hidup jika aktif di background runner
          } else {
            j.status = 'INTERRUPTED';
            j.phase = 'INTERRUPTED';
            j.finishedAt = new Date().toISOString();
            j.message = 'Job terhenti karena QC API restart; jalankan ulang untuk melanjutkan.';
            capabilityBackfill = true;
          }
        }
        // Auto-restore inventory from disk artifact if missing from main job file
        if (!j.inventory) {
          try {
            const invPath = path.join(this.artifactRoot, 'jobs', j.id, 'application-inventory.json');
            const invData = await readFile(invPath, 'utf8');
            j.inventory = JSON.parse(invData) as Inventory;
            capabilityBackfill = true;
          } catch {}
        }
        if (j.inventory && (!j.inventory.capabilities || !j.inventory.capabilities.negativeScenarios)) {
          j.inventory.capabilities = detectCapabilities({ pages: j.inventory.pages, routes: j.inventory.routes, api: j.inventory.api });
          capabilityBackfill = true;
        }
        if (j.inventory && !j.inventory.featureContractPlan && j.inventory.capabilities) {
          j.inventory.featureContractPlan = buildFeatureContractPlan({ pages: j.inventory.pages, capabilities: j.inventory.capabilities.capabilities, crudPlan: j.inventory.crudPlan, roleActionPlan: j.inventory.roleActionPlan });
          capabilityBackfill = true;
        }
        if (j.inventory && !j.businessFlowMap) {
          j.businessFlowMap = buildBusinessFlowMap(j.inventory, j.config as DiscoveryConfig);
          capabilityBackfill = true;
        }
        if (j.inventory && (!j.flows || j.flows.length === 0)) {
          j.flows = buildFlows(j.inventory, j.config as DiscoveryConfig);
          capabilityBackfill = true;
        }
        this.jobs.set(j.id, j);
      }
      if (capabilityBackfill) {
        await this.persist();
        console.log(`[DiscoveryService] Backfilled capability profiles and business flow maps for legacy jobs.`);
      }
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
      const jobsTmp = `${jobsFile}.tmp.${Date.now()}`;
      await writeFile(jobsTmp, JSON.stringify(Array.from(this.jobs.values()), null, 2), 'utf8');
      await rename(jobsTmp, jobsFile);

      const uploadsFile = path.join(this.artifactRoot, 'discovery-uploads.json');
      const uploadsTmp = `${uploadsFile}.tmp.${Date.now()}`;
      await writeFile(uploadsTmp, JSON.stringify(Array.from(this.uploads.values()), null, 2), 'utf8');
      await rename(uploadsTmp, uploadsFile);
    } catch { /* ignore */ }
  }

  public listJobs(): DiscoveryJob[] {
    try {
      const jobsFile = path.join(this.artifactRoot, 'discovery-jobs.json');
      if (existsSync(jobsFile)) {
        const diskJobs = JSON.parse(readFileSync(jobsFile, 'utf8')) as DiscoveryJob[];
        for (const d of diskJobs) {
          this.jobs.set(d.id, d);
        }
      }
    } catch {}
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getJob(id: string): DiscoveryJob | undefined {
    const mem = this.jobs.get(id);
    if (mem) return mem;
    try {
      const jobsFile = path.join(this.artifactRoot, 'discovery-jobs.json');
      if (existsSync(jobsFile)) {
        const diskJobs = JSON.parse(readFileSync(jobsFile, 'utf8')) as DiscoveryJob[];
        const found = diskJobs.find((d) => d.id === id);
        if (found) {
          this.jobs.set(id, found);
          return found;
        }
      }
    } catch {}
    return undefined;
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

  public updateBusinessFlow(id: string, flowId: string, patch: Partial<Pick<BusinessFlowMap['flows'][number], 'title' | 'summary' | 'trigger' | 'actors' | 'preconditions' | 'steps' | 'expectedOutcome' | 'negativeScenarios' | 'recoveryScenarios' | 'critical' | 'status'>>): DiscoveryJob {
    const job = this.jobs.get(id);
    if (!job || !job.businessFlowMap) throw new Error('Business Flow Map belum tersedia.');
    const flow = job.businessFlowMap.flows.find((item) => item.id === flowId);
    if (!flow) throw new Error('Business flow tidak ditemukan.');
    if (typeof patch.title === 'string' && patch.title.trim()) flow.title = patch.title.trim().slice(0, 180);
    if (typeof patch.summary === 'string') flow.summary = patch.summary.trim().slice(0, 1000);
    if (typeof patch.trigger === 'string') flow.trigger = patch.trigger.trim().slice(0, 500);
    if (Array.isArray(patch.actors)) flow.actors = patch.actors.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 12);
    if (Array.isArray(patch.preconditions)) flow.preconditions = patch.preconditions.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20);
    if (Array.isArray(patch.steps)) flow.steps = patch.steps.filter((step) => step && typeof step === 'object').map((step, index) => ({
      order: index + 1,
      action: typeof step.action === 'string' ? step.action.trim().slice(0, 500) : '',
      route: typeof step.route === 'string' && step.route.trim() ? step.route.trim().slice(0, 300) : undefined,
      expected: typeof step.expected === 'string' ? step.expected.trim().slice(0, 500) : '',
      evidence: Array.isArray(step.evidence) ? step.evidence.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 8) : undefined,
    })).filter((step) => step.action || step.expected).slice(0, 40);
    if (Array.isArray(patch.expectedOutcome)) flow.expectedOutcome = patch.expectedOutcome.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20);
    if (Array.isArray(patch.negativeScenarios)) flow.negativeScenarios = patch.negativeScenarios.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20);
    if (Array.isArray(patch.recoveryScenarios)) flow.recoveryScenarios = patch.recoveryScenarios.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20);
    if (typeof patch.critical === 'boolean') flow.critical = patch.critical;
    if (patch.status && ['APPROVED', 'NEEDS_REVIEW', 'DRAFT', 'BLOCKED'].includes(patch.status)) {
      flow.status = patch.status;
      if (patch.status === 'APPROVED') {
        flow.approvedAt = new Date().toISOString();
      }
    } else if (!patch.status && flow.status === 'APPROVED') {
      flow.status = 'NEEDS_REVIEW';
    }
    refreshBusinessFlowSummary(job.businessFlowMap);
    this.addLog(job, 'flow-builder', `Business flow diperbarui: ${flow.title} (${flow.status}).`);
    void this.persist();
    void this.writeWorkspaceSnapshot(job);
    if (job.businessFlowMap.status === 'APPROVED') {
      this.businessFlowWaiters.get(id)?.resolve();
      this.businessFlowWaiters.delete(id);
    }
    return job;
  }

  public approvePhase1Job(id: string): DiscoveryJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');
    const now = new Date().toISOString();
    if (job.reconSummary) {
      job.reconSummary.approvedAt = now;
    }
    if (job.businessFlowMap) {
      job.businessFlowMap.flows.forEach((flow) => {
        flow.status = 'APPROVED';
        flow.approvedAt = now;
      });
      refreshBusinessFlowSummary(job.businessFlowMap);
    }
    job.config.executeFlows = true;
    job.flows.forEach((flow) => {
      flow.status = 'READY';
    });

    const waiter = this.businessFlowWaiters.get(id);
    if (waiter) {
      if (job.config.platform === 'android') {
        setEmulatorReviewHold(false);
      }
      job.status = 'RUNNING';
      job.phase = 'GENERATING_COMMANDS';
      job.progress = 88;
      job.message = 'Discovery Fase 1 di-ACC oleh user. Membuat rencana command, Batch 1 Long Screenshot, lalu Batch 2 Video.';
      this.addLog(job, 'flow-builder', `✅ ${job.message}`);
      void this.persist();
      void this.writeWorkspaceSnapshot(job);
      waiter.resolve();
      this.businessFlowWaiters.delete(id);
      return job;
    }

    if (job.status === 'WAITING_REVIEW' || job.phase === 'RECON_REVIEW_WAITING_ACC') {
      if (job.config.platform === 'android') {
        setEmulatorReviewHold(false);
      }
      job.status = 'RUNNING';
      job.phase = 'GENERATING_COMMANDS';
      job.progress = 88;
      job.message = 'Discovery Fase 1 di-ACC oleh user. Membuat rencana command, Batch 1 Long Screenshot, lalu Batch 2 Video.';
      this.addLog(job, 'flow-builder', `✅ ${job.message}`);
      void this.persist();
      void this.writeWorkspaceSnapshot(job);
      return job;
    }

    void this.persist();
    return job;
  }

  public approveBusinessFlows(id: string, flowIds?: string[]): DiscoveryJob {
    const job = this.jobs.get(id);
    if (!job || !job.businessFlowMap) throw new Error('Business Flow Map belum tersedia.');
    const selected = flowIds?.length ? new Set(flowIds) : null;
    const now = new Date().toISOString();
    job.businessFlowMap.flows.forEach((flow) => {
      if (!selected || selected.has(flow.id)) {
        flow.status = 'APPROVED';
        flow.approvedAt = now;
      }
    });
    refreshBusinessFlowSummary(job.businessFlowMap);
    this.addLog(job, 'flow-builder', selected ? `Business flow disetujui: ${selected.size} item.` : 'Seluruh Business Flow Map disetujui oleh reviewer.');
    void this.persist();
    void this.writeWorkspaceSnapshot(job);
    if (job.businessFlowMap.status === 'APPROVED') {
      if (job.reconSummary) {
        job.reconSummary.approvedAt = now;
      }
      job.config.executeFlows = true;
      job.flows.forEach((flow) => {
        flow.status = 'READY';
      });
      const waiter = this.businessFlowWaiters.get(id);
      if (waiter) {
        if (job.config.platform === 'android') {
          setEmulatorReviewHold(false);
        }
        job.status = 'RUNNING';
        job.phase = 'GENERATING_COMMANDS';
        waiter.resolve();
        this.businessFlowWaiters.delete(id);
      } else if (job.status === 'WAITING_REVIEW' || job.phase === 'BUSINESS_FLOW_REVIEW' || job.phase === 'RECON_REVIEW_WAITING_ACC' || job.status === 'COMPLETED') {
        job.status = 'RUNNING';
        job.phase = 'EXECUTING_TESTS';
        job.progress = 90;
        job.message = 'Seluruh Business Flow disetujui. Memulai eksekusi flow.';
        this.addLog(job, 'flow-builder', job.message);
        void this.persist();
        this.runFlows(job.id).catch((err) => {
          this.addLog(job, 'runner', `Kesalahan eksekusi flow: ${err instanceof Error ? err.message : String(err)}`);
          console.error('[DiscoveryService] runFlows error:', err);
        });
      }
    }
    return job;
  }

  private async waitForBusinessFlowApproval(job: DiscoveryJob, signal: AbortSignal): Promise<void> {
    if (job.reconSummary?.approvedAt || (job.businessFlowMap?.status as string) === 'APPROVED') return;
    job.status = 'WAITING_REVIEW';
    job.phase = 'RECON_REVIEW_WAITING_ACC';
    job.progress = 84;
    const summaryLabel = job.reconSummary
      ? `${job.reconSummary.totalRoles} role, ${job.reconSummary.totalPages} halaman/layar, ${job.reconSummary.totalInteractiveFeatures} fitur/tab`
      : 'Peta halaman & fitur';
    job.message = `Reconnaissance selesai (${summaryLabel}). Menunggu ACC user sebelum membuat command & mengambil Long SS / Video.`;
    this.addLog(job, 'flow-builder', `⏸️ ${job.message}`);

    let resolveWaiter: (() => void) | null = null;
    let approvedEarly = false;
    this.businessFlowWaiters.set(job.id, {
      resolve: () => {
        if (resolveWaiter) {
          resolveWaiter();
        } else {
          approvedEarly = true;
        }
      },
      reject: (err: Error) => {
        // no-op on manual reject
      },
    });

    try {
      await this.persist();
      await this.writeWorkspaceSnapshot(job);

      if (!approvedEarly && !job.reconSummary?.approvedAt && (job.businessFlowMap?.status as string) !== 'APPROVED') {
        await new Promise<void>((resolve, reject) => {
          resolveWaiter = resolve;
          const abort = () => {
            signal.removeEventListener('abort', abort);
            this.businessFlowWaiters.delete(job.id);
            reject(new Error('Discovery dibatalkan saat menunggu ACC Reconnaissance / Business Flow.'));
          };
          signal.addEventListener('abort', abort, { once: true });
          if (approvedEarly || job.reconSummary?.approvedAt || (job.businessFlowMap?.status as string) === 'APPROVED') {
            signal.removeEventListener('abort', abort);
            resolve();
          }
        });
      }
    } finally {
      this.businessFlowWaiters.delete(job.id);
    }

    job.status = 'RUNNING';
    job.message = 'ACC diterima. Memulai pembuatan command plan dan Batch 1 Long Screenshot.';
    this.addLog(job, 'flow-builder', job.message);
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
    this.uploads.set(id, item);
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

  public updateUploadMetadata(id: string, metadata: { packageId?: string; appName?: string; versionName?: string }): void {
    const existing = this.uploads.get(id);
    if (!existing) return;
    if (metadata.packageId) existing.packageId = metadata.packageId;
    if (metadata.appName) existing.appName = metadata.appName;
    if (metadata.versionName) existing.versionName = metadata.versionName;
    void this.persist();
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
    const safeConfig = { ...config, accounts: (config.accounts ?? []).map(({ password: _password, ...account }) => account) };
    await writeFile(path.join(projectRoot, 'project.json'), JSON.stringify({ name: config.name, slug: job.workspace.projectSlug, updatedAt: new Date().toISOString(), latestRun: job.workspace.runLabel }, null, 2), 'utf8');
    await writeFile(path.join(projectRoot, 'input', 'config.json'), JSON.stringify(safeConfig, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'run.json'), JSON.stringify({ jobId: job.id, project: config.name, workspace: job.workspace, createdAt: job.createdAt, status: job.status }, null, 2), 'utf8');
    await this.writeWorkspaceSnapshot(job);
  }

  private async writeWorkspaceSnapshot(job: DiscoveryJob) {
    if (!job.workspace) return;
    const runRoot = path.join(this.artifactRoot, job.workspace.runPath);
    const milestoneRoot = path.join(runRoot, 'milestones');
    const active = job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'WAITING_REVIEW';
    const phase = job.phase || '';
    const hasInventory = Boolean(job.inventory);
    const hasFlows = (job.flows?.length ?? 0) > 0;
    const hasPhase1Media = (job.longScreenshots?.length ?? 0) > 0 || (job.roleVideos?.length ?? 0) > 0;
    const hasResults = (job.results?.length ?? 0) > 0 || hasPhase1Media;
    const hasFailedResults = job.results.some((result) => result.status !== 'PASSED');
    const hasCoverageGaps = (job.coverageGaps?.length ?? 0) > 0;
    const isFailed = job.status === 'FAILED' || hasFailedResults;
    const qualityRunning = active && /QUALITY/i.test(phase);
    const qualityFailed = job.qualityAudit?.status === 'FAILED' || job.qualityAudit?.status === 'ERROR';
    const qualityLimited = job.qualityAudit?.status === 'PASSED_WITH_LIMITATIONS';
    const hasQualityReport = Boolean(job.qualityAudit?.reportPath);
    const statuses = [
      { folder: '01-start-analysis', title: 'Start & Analysis', status: active && /INITIALIZING/i.test(phase) ? 'RUNNING' : job.status === 'FAILED' ? 'ATTENTION' : 'CLEAR', output: ['project.json', 'input/config.json'] },
      { folder: '02-setup-environment', title: 'Setup Environment', status: active && /PREPAR|DATABASE|RUNTIME|BOOT|ENV|PROVISION|STARTING_DEMO/i.test(phase) ? 'RUNNING' : 'CLEAR', output: ['run.json'] },
      { folder: '03-discovery-inventory', title: 'Discovery & Inventory', status: active && /DISCOVER|SCAN|CRAWL|INVENTORY/i.test(phase) && !/WAITING_ACC/i.test(phase) ? 'RUNNING' : hasInventory ? 'CLEAR' : 'READY', output: hasInventory ? ['application-inventory.json', 'capability-profile.json', 'crud-plan.json', 'role-action-plan.json', 'feature-contract-plan.json'] : [] },
      { folder: '04-test-design', title: 'Test Design & Recon Gate', status: active && /FLOW|DESIGN|REVIEW|WAITING_ACC|GENERATING_COMMANDS/i.test(phase) ? 'RUNNING' : (hasFlows || job.reconSummary?.approvedAt) ? 'CLEAR' : 'READY', output: hasFlows ? ['generated flows', ...(job.businessFlowMap ? ['business-flow-map.json'] : []), ...(job.reconSummary ? ['recon-summary.json'] : [])] : [] },
      { folder: '05-execution', title: 'Capture Execution (Long SS & Video)', status: active && /RUN|EXECUTE|PLAYWRIGHT|MAESTRO|CAPTURING_LONG_SCREENSHOTS|RECORDING_ROLE_VIDEOS|DIAGNOSING_GAPS/i.test(phase) ? 'RUNNING' : hasResults ? (isFailed ? 'ATTENTION' : 'CLEAR') : 'READY', output: hasResults ? ['runtime-artifacts', 'results'] : [] },
      { folder: '06-responsive-ui', title: 'Responsive & UI Quality', status: qualityRunning ? 'RUNNING' : qualityFailed || qualityLimited ? 'ATTENTION' : job.qualityAudit?.status === 'PASSED' ? 'CLEAR' : 'READY', output: hasQualityReport ? ['quality/report.json', 'quality/screenshots'] : [] },
      { folder: '07-evidence-retest', title: 'Evidence & Coverage Gaps', status: hasQualityReport || hasResults ? (isFailed || hasCoverageGaps || qualityFailed || qualityLimited ? 'RETEST' : 'CLEAR') : 'READY', output: ['evidence/screenshots', 'evidence/videos', 'evidence/reports'] },
      { folder: '08-final-report', title: 'Defect & Final Report', status: job.finishedAt ? (isFailed || hasCoverageGaps || qualityFailed || qualityLimited ? 'ATTENTION' : 'CLEAR') : 'READY', output: ['final-report', ...(hasCoverageGaps ? ['coverage-gaps.json'] : [])] }
    ];
    await mkdir(runRoot, { recursive: true });
    await writeFile(path.join(runRoot, 'timeline.json'), JSON.stringify(job.logs, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'progress.json'), JSON.stringify({ jobId: job.id, status: job.status, phase: job.phase, progress: job.progress, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'manifest.json'), JSON.stringify({ project: job.name, workspace: job.workspace, generatedAt: new Date().toISOString(), milestones: statuses, branches: job.message ? [{ status: job.status, message: job.message }] : [] }, null, 2), 'utf8');
    for (const milestone of statuses) {
      await mkdir(path.join(milestoneRoot, milestone.folder), { recursive: true });
      await writeFile(path.join(milestoneRoot, milestone.folder, 'status.json'), JSON.stringify({ id: milestone.folder, title: milestone.title, status: milestone.status, output: milestone.output, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    }
    await writeFile(path.join(milestoneRoot, '03-discovery-inventory', 'job.json'), JSON.stringify({ inventory: job.inventory ?? null }, null, 2), 'utf8');
    if (job.inventory?.capabilities) {
      await writeFile(path.join(milestoneRoot, '03-discovery-inventory', 'capability-profile.json'), JSON.stringify(job.inventory.capabilities, null, 2), 'utf8');
    }
    if (job.inventory?.featureContractPlan) {
      await writeFile(path.join(milestoneRoot, '03-discovery-inventory', 'feature-contract-plan.json'), JSON.stringify(job.inventory.featureContractPlan, null, 2), 'utf8');
      await writeFile(path.join(milestoneRoot, '04-test-design', 'feature-contract-plan.json'), JSON.stringify(job.inventory.featureContractPlan, null, 2), 'utf8');
    }
    if (job.businessFlowMap) {
      await writeFile(path.join(milestoneRoot, '04-test-design', 'business-flow-map.json'), JSON.stringify(job.businessFlowMap, null, 2), 'utf8');
    }
    if (job.reconSummary) {
      await writeFile(path.join(milestoneRoot, '04-test-design', 'recon-summary.json'), JSON.stringify(job.reconSummary, null, 2), 'utf8');
    }
    await writeFile(path.join(milestoneRoot, '04-test-design', 'flows.json'), JSON.stringify(job.flows ?? [], null, 2), 'utf8');
    await writeFile(path.join(milestoneRoot, '05-execution', 'results.json'), JSON.stringify(job.results ?? [], null, 2), 'utf8');
    if (job.coverageGaps) {
      await mkdir(path.join(runRoot, 'findings'), { recursive: true });
      await writeFile(path.join(runRoot, 'findings', 'coverage-gaps.json'), JSON.stringify(job.coverageGaps, null, 2), 'utf8');
      await writeFile(path.join(milestoneRoot, '08-final-report', 'coverage-gaps.json'), JSON.stringify(job.coverageGaps, null, 2), 'utf8');
    }
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED' || hasResults) {
      const runtimeSource = path.join(this.artifactRoot, 'jobs', job.id);
      const runtimeTarget = path.join(runRoot, 'runtime-artifacts');
      try { await this.copyTree(runtimeSource, runtimeTarget); } catch { /* Runtime artifacts are optional. */ }

      const evidenceScreenshotsTarget = path.join(runRoot, 'evidence', 'screenshots');
      const evidenceVideosTarget = path.join(runRoot, 'evidence', 'videos');
      const evidenceReportsTarget = path.join(runRoot, 'evidence', 'reports');
      const finalReportTarget = path.join(runRoot, 'final-report');
      await mkdir(evidenceScreenshotsTarget, { recursive: true });
      await mkdir(evidenceVideosTarget, { recursive: true });
      await mkdir(evidenceReportsTarget, { recursive: true });
      await mkdir(finalReportTarget, { recursive: true });

      // Sync Phase-1 Batch 1 long screenshots
      for (const ss of job.longScreenshots || []) {
        if (ss.status === 'CAPTURED' && ss.path && existsSync(ss.path)) {
          await copyFile(ss.path, path.join(evidenceScreenshotsTarget, ss.filename)).catch(() => {});
        }
      }
      // Sync Phase-1 Batch 2 per-role videos
      for (const vid of job.roleVideos || []) {
        if (vid.status === 'RECORDED' && vid.path && existsSync(vid.path)) {
          await copyFile(vid.path, path.join(evidenceVideosTarget, vid.filename)).catch(() => {});
        }
      }
      // Copy generated reports into workspace final-report & evidence/reports
      for (const reportFile of ['application-report.json', 'application-report.html', 'application-report.pdf']) {
        const srcReport = path.join(runtimeSource, reportFile);
        if (existsSync(srcReport)) {
          await copyFile(srcReport, path.join(finalReportTarget, reportFile)).catch(() => {});
          await copyFile(srcReport, path.join(evidenceReportsTarget, reportFile)).catch(() => {});
        }
      }

      if (job.results && job.results.length > 0) {
        for (const res of job.results) {
          for (const art of res.artifacts || []) {
            if (art.type === 'screenshot' && art.path && existsSync(art.path)) {
              const dest = path.join(evidenceScreenshotsTarget, (art as any).name || path.basename(art.path));
              await copyFile(art.path, dest).catch(() => {});
            } else if ((art.type as any) === 'video' && art.path && existsSync(art.path)) {
              const dest = path.join(evidenceVideosTarget, (art as any).name || path.basename(art.path));
              await copyFile(art.path, dest).catch(() => {});
            }
          }
        }
      }

      const fullFlowSrc = path.join(this.artifactRoot, 'jobs', job.id, 'full-flow.webm');
      try {
        const fullFlowStat = await lstat(fullFlowSrc);
        if (fullFlowStat.isFile()) {
          const evidenceVideoTarget = path.join(runRoot, 'evidence', 'videos', 'full-flow.webm');
          await mkdir(path.dirname(evidenceVideoTarget), { recursive: true });
          await copyFile(fullFlowSrc, evidenceVideoTarget);
          const milestone7Video = path.join(milestoneRoot, '07-evidence-retest', 'full-flow.webm');
          await mkdir(path.dirname(milestone7Video), { recursive: true });
          await copyFile(fullFlowSrc, milestone7Video);
        }
      } catch { /* Full flow video optional */ }
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
    const pendingWaiter = this.businessFlowWaiters.get(id);
    if (pendingWaiter) {
      this.businessFlowWaiters.delete(id);
      pendingWaiter.reject(new Error('Discovery job dibatalkan oleh pengguna.'));
    }
    if (job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'WAITING_REVIEW') {
      job.status = 'CANCELLED';
      job.finishedAt = new Date().toISOString();
      job.phase = 'CANCELLED';
      job.message = 'Discovery job dibatalkan oleh pengguna.';
      this.addLog(job, 'system', 'Job dibatalkan oleh user');
    }
    if (job.config.platform === 'android') {
      setEmulatorReviewHold(false);
      notifyAndroidJobFinished();
      const hasOther = Array.from(this.jobs.values()).some(
        (j) => j.id !== id && ['RUNNING', 'QUEUED'].includes(j.status) && j.config.platform === 'android'
      );
      if (!hasOther) {
        stopAllManagedEmulators().catch(() => {});
      }
    }
    void this.persist();
    return true;
  }

  public regenerateFlows(id: string): GeneratedFlow[] {
    const job = this.jobs.get(id);
    if (!job || !job.inventory) throw new Error('Job atau inventory tidak ditemukan.');
    const fullConfig: DiscoveryConfig = {
      ...job.config,
      accounts: []
    };
    if (job.inventory.pages && job.inventory.routes) {
      job.inventory.crudPlan = buildCrudPlan({
        pages: job.inventory.pages,
        routes: job.inventory.routes,
        api: job.inventory.api || []
      });
    }
    const flows = buildFlows(job.inventory, fullConfig);
    job.flows = flows;
    job.businessFlowMap = buildBusinessFlowMap(job.inventory, fullConfig);
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
    if (job.config.platform === 'web' && job.businessFlowMap && job.config.businessFlowReview?.mode !== 'auto' && job.businessFlowMap.status !== 'APPROVED') {
      job.businessFlowMap.flows.forEach((flow) => {
        flow.status = 'APPROVED';
        flow.approvedAt = new Date().toISOString();
      });
      refreshBusinessFlowSummary(job.businessFlowMap);
    }
    const targetFlows = (flowIds && flowIds.length > 0)
      ? job.flows.filter(f => flowIds.includes(f.id))
      : (job.flows.filter(f => f.status === 'READY' || (job.config.platform === 'android' && f.platform === 'android')).length > 0
          ? job.flows.filter(f => f.status === 'READY' || (job.config.platform === 'android' && f.platform === 'android'))
          : job.flows);

    if (!targetFlows || targetFlows.length === 0) {
      throw new Error('Tidak ada flow yang siap dijalankan.');
    }

    job.status = 'RUNNING';
    job.phase = 'EXECUTING_TESTS';
    job.progress = 90;
    job.message = `Memulai eksekusi ${targetFlows.length} skenario Playwright...`;
    delete (job as any).finishedAt;
    void this.persist();

    this.addLog(job, 'runner', `Memulai eksekusi ${targetFlows.length} flow...`);
    const jobArtifactDir = path.join(this.artifactRoot, 'jobs', job.id);
    await mkdir(jobArtifactDir, { recursive: true });

    const installedApks = new Set<string>();

    const hasAndroidFlows = job.config.platform === 'android' || targetFlows.some(f => f.platform === 'android');
    if (hasAndroidFlows) {
      notifyAndroidJobStarted();
    }
    const hasWebFlows = targetFlows.some(f => f.platform === 'web' || !f.platform);
    const rawVideoDir = path.join(jobArtifactDir, '.raw-videos');
    let webRecordingSession: WebRecordingSession | undefined;
    if (hasWebFlows) {
      try {
        this.addLog(job, 'runner', 'Memulai perekaman video full flow (1280x720 @ 30 FPS)...');
        webRecordingSession = await createWebRecordingSession(job.config.baseUrl, rawVideoDir);
      } catch (sessionErr) {
        this.addLog(job, 'runner', `Peringatan inisialisasi perekaman full flow: ${sessionErr}`);
      }
    }

    try {
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
              job.config.appId || job.config.apkPackageId || '',
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

            // Sinkronkan screenshot Android flow secara generik (tanpa hardcode ID aplikasi tertentu)
            if (job.inventory?.pages && runResult.artifacts) {
              const jobScreenshotsDir = path.join(jobArtifactDir, 'screenshots');
              await mkdir(jobScreenshotsDir, { recursive: true });
              for (const art of runResult.artifacts) {
                if (art.type === 'screenshot' && art.path && existsSync(art.path)) {
                  const baseName = (art as any).name || path.basename(art.path);
                  const destPath = path.join(jobScreenshotsDir, baseName);
                  await copyFile(art.path, destPath).catch(() => {});

                  const low = baseName.toLowerCase();
                  for (const page of job.inventory.pages) {
                    const slug = page.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
                    if (slug && low.includes(slug) && !page.screenshot) {
                      page.screenshot = `screenshots/${baseName}`;
                      page.state = 'observed';
                    }
                  }
                }
              }
            }

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
        const runtimeCred = this.getPrimaryRuntimeCredential(id);
        const runtimeAccount = job.config.accounts?.[0];
        if (runtimePassword) this.registerSecret(id, runtimePassword);
        const effectivePassword = runtimePassword || runtimeCred?.password || '';
        const effectiveEmail = runtimeCred?.identifier || runtimeAccount?.email || '';
        const executableFlow = {
          ...normalized,
          ...(normalized.target.platform === 'web' ? {
            execution: {
              ...normalized.execution,
              video: 'on' as const,
            }
          } : {}),
          variables: {
            ...normalized.variables,
            QC_EMAIL: effectiveEmail,
            QC_PASSWORD: effectivePassword,
          },
        };
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
              },
              webRecordingSession
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
    } finally {
      if (webRecordingSession) {
        try {
          const fullFlowVideoPath = path.join(jobArtifactDir, 'full-flow.webm');
          const savedVideo = await finishWebRecordingSession(webRecordingSession, fullFlowVideoPath);
          if (savedVideo) {
            const evidenceVideoPath = path.join(jobArtifactDir, 'evidence', 'videos', 'full-flow.webm');
            await mkdir(path.dirname(evidenceVideoPath), { recursive: true });
            await copyFile(savedVideo, evidenceVideoPath).catch(() => {});
            this.addLog(job, 'runner', '🎬 Video full flow (30 FPS 720p) berhasil direkam & disimpan.');
            if (job.results.length > 0) {
              job.results[0].artifacts.unshift({ type: 'video', path: fullFlowVideoPath });
            }
          }
        } catch (videoFinalizeErr) {
          this.addLog(job, 'runner', `Peringatan finalisasi video full flow: ${videoFinalizeErr}`);
        } finally {
          await rm(rawVideoDir, { recursive: true, force: true }).catch(() => {});
        }
      }
      if (hasAndroidFlows) {
        notifyAndroidJobFinished();
        const otherActiveAndroidJobs = Array.from(this.jobs.values()).some(
          (j) => j.id !== job.id && ['RUNNING', 'QUEUED'].includes(j.status) && (j.config.platform === 'android' || j.phase === 'EXECUTING_TESTS')
        );
        if (!otherActiveAndroidJobs) {
          try {
            await stopAllManagedEmulators();
            this.addLog(job, 'runner', '🛑 Headless Android Emulator dimatikan otomatis. Sumber daya sistem dibebaskan.');
          } catch (emuShutdownErr) {
            /* ignore */
          }
        }
      }
    }

    // Update and save application-report.json, application-report.html & application-report.pdf
    try {
      const jsonReport = buildJsonReport(job);
      await writeFile(path.join(jobArtifactDir, 'application-report.json'), JSON.stringify(jsonReport, null, 2), 'utf8');
      const reportHtml = buildReport(job, `/api/v1/discovery/jobs/${job.id}/artifacts/`);
      await writeFile(path.join(jobArtifactDir, 'application-report.html'), reportHtml, 'utf8');
      const pdfBuffer = await generatePdfReport(job, this.artifactRoot);
      await writeFile(path.join(jobArtifactDir, 'application-report.pdf'), pdfBuffer);
    } catch (e) {
      // non-fatal report generation error
    }

    job.status = 'COMPLETED';
    job.phase = 'COMPLETED';
    job.progress = 100;
    job.finishedAt = new Date().toISOString();
    const passedCount = job.results.filter(r => r.status === 'PASSED').length;
    job.message = `Eksekusi selesai: ${passedCount}/${targetFlows.length} skenario lulus.`;
    this.addLog(job, 'runner', `✅ ${job.message}`);

    await this.writeWorkspaceSnapshot(job);
    void this.persist();
    return job;
  }

  private seedRuntimeAccounts(
    jobId: string,
    accounts: Array<{ name?: string; email: string; password?: string; role?: string }> = []
  ): void {
    const roleMap = new Map<string, RuntimeRoleCredential>();
    for (const acc of accounts) {
      if (!acc.email?.trim() || !acc.password?.trim()) continue;
      const role = (acc.role || 'user').trim().toLowerCase();
      this.registerSecret(jobId, acc.password);
      roleMap.set(role, {
        role,
        name: acc.name?.trim() || `Account ${role}`,
        identifier: acc.email.trim(),
        identifierField: 'email',
        password: acc.password,
        loginPath: '/login',
        source: 'manual',
        verified: false,
      });
    }
    this.runtimeRoleCredentials.set(jobId, roleMap);
  }

  public async createJob(config: DiscoveryConfig): Promise<DiscoveryJob> {
    const activeProjects = Array.from(this.jobs.values()).filter((job) => ['QUEUED', 'RUNNING', 'WAITING_REVIEW'].includes(job.status));
    const policy = runtimePolicy();
    if (activeProjects.length >= policy.maxActiveProjects) {
      throw new Error(`Batas project aktif tercapai (${policy.maxActiveProjects}). Selesaikan atau batalkan project aktif terlebih dahulu.`);
    }
    const id = randomUUID();
    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    const safeAccounts = (config.accounts ?? []).map(a => ({
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
    this.seedRuntimeAccounts(id, config.accounts);
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
    if (restart) {
      const activeProjects = Array.from(this.jobs.values()).filter((item) => item.id !== id && ['QUEUED', 'RUNNING', 'WAITING_REVIEW'].includes(item.status));
      const policy = runtimePolicy();
      if (activeProjects.length >= policy.maxActiveProjects) throw new Error(`Batas project aktif tercapai (${policy.maxActiveProjects}). Selesaikan atau batalkan project aktif terlebih dahulu.`);
    }

    const oldController = this.abortControllers.get(id);
    if (oldController) {
      oldController.abort();
      this.abortControllers.delete(id);
    }
    const staleWaiter = this.businessFlowWaiters.get(id);
    if (staleWaiter) {
      this.businessFlowWaiters.delete(id);
      staleWaiter.reject(new Error('Job diperbarui sebelum disetujui.'));
    }
    if (job.config.platform === 'android' && job.status === 'WAITING_REVIEW') {
      setEmulatorReviewHold(false);
    }

    const safeAccounts = (newConfig.accounts ?? []).map(a => ({
      name: a.name,
      email: a.email,
      role: a.role
    }));
    this.seedRuntimeAccounts(id, newConfig.accounts);

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
      job.envProvisioning = undefined;
      job.provisionedAccounts = undefined;
      job.reconSummary = undefined;
      job.commandPlan = undefined;
      job.longScreenshots = undefined;
      job.roleVideos = undefined;
      job.coverageGaps = undefined;
      job.inventory = {
        pages: [],
        routes: [],
        api: [],
        filesScanned: 0,
        warnings: [],
        generatedAt: new Date().toISOString()
      };
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
    const staleWaiter = this.businessFlowWaiters.get(id);
    if (staleWaiter) {
      this.businessFlowWaiters.delete(id);
      staleWaiter.reject(new Error('Job di-restart ulang.'));
    }
    if (job.config.platform === 'android' && job.status === 'WAITING_REVIEW') {
      setEmulatorReviewHold(false);
    }

    job.status = 'QUEUED';
    job.phase = 'PREPARING';
    job.progress = 0;
    job.message = 'Memulai ulang eksekusi discovery job...';
    job.finishedAt = undefined;
    job.flows = [];
    job.results = [];
    job.envProvisioning = undefined;
    job.provisionedAccounts = undefined;
    job.reconSummary = undefined;
    job.commandPlan = undefined;
    job.longScreenshots = undefined;
    job.roleVideos = undefined;
    job.coverageGaps = undefined;
    job.inventory = {
      pages: [],
      routes: [],
      api: [],
      filesScanned: 0,
      warnings: [],
      generatedAt: new Date().toISOString()
    };
    job.logs = [
      {
        time: new Date().toISOString(),
        category: 'system',
        message: '════════════════════════════════════════'
      },
      {
        time: new Date().toISOString(),
        category: 'system',
        message: `🔄 Memulai ulang discovery job "${job.name}" secara real-time...`
      },
      {
        time: new Date().toISOString(),
        category: 'system',
        message: '════════════════════════════════════════'
      }
    ];

    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    setImmediate(() => {
      const runtimeAccounts: DiscoveryConfig['accounts'] = [];
      const existingRoleMap = this.runtimeRoleCredentials.get(id);
      for (const acc of job.config.accounts ?? []) {
        const runtime = existingRoleMap?.get((acc.role || 'user').trim().toLowerCase());
        runtimeAccounts.push({ ...acc, password: runtime?.password || '' });
      }
      const fullConfig = { ...job.config, accounts: runtimeAccounts } as DiscoveryConfig;
      this.executeDiscovery(job, fullConfig, abortController.signal).catch((err) => {
        if (abortController.signal.aborted) return;
        job.status = 'FAILED';
        job.phase = 'FAILED';
        job.message = err instanceof Error ? err.message : String(err);
        job.finishedAt = new Date().toISOString();
        this.addLog(job, 'system', `Discovery error: ${job.message}`);
      }).finally(() => {
        if (this.abortControllers.get(id) === abortController) {
          void this.writeWorkspaceSnapshot(job);
          this.abortControllers.delete(id);
        }
      });
    });

    return job;
  }

  public async startQualityAudit(id: string, password: string): Promise<DiscoveryJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job tidak ditemukan.');
    if (job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'WAITING_REVIEW') throw new Error('Job masih berjalan. Tunggu sampai selesai sebelum memulai Quality Audit.');
    if (!password?.trim()) throw new Error('Password akun audit wajib diisi.');
    this.registerSecret(id, password);
    const existingRoles = this.runtimeRoleCredentials.get(id) ?? new Map<string, RuntimeRoleCredential>();
    if (existingRoles.size === 0) {
      const fallbackEmail = job.config.accounts?.[0]?.email || job.provisionedAccounts?.[0]?.identifier || '';
      const fallbackRole = (job.config.accounts?.[0]?.role || job.provisionedAccounts?.[0]?.role || 'admin').toLowerCase();
      existingRoles.set(fallbackRole, {
        role: fallbackRole,
        name: `Audit ${fallbackRole}`,
        identifier: fallbackEmail,
        identifierField: 'email',
        password,
        loginPath: job.config.rules?.loginPath || '/login',
        source: 'manual',
        verified: false,
      });
    } else {
      for (const cred of existingRoles.values()) {
        cred.password = password;
      }
    }
    this.runtimeRoleCredentials.set(id, existingRoles);
    if (job.config.platform !== 'web') throw new Error('Quality Audit DOM hanya tersedia untuk target web.');

    const controller = new AbortController();
    this.abortControllers.set(id, controller);
    const config = {
      ...job.config,
      qualityAudit: { ...(job.config.qualityAudit ?? {}), enabled: true },
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

  public addLog(job: DiscoveryJob, category: string, message: string) {
    const entry = {
      time: new Date().toISOString(),
      category,
      message: this.scrubForJob(job.id, message)
    };
    job.logs.push(entry);
    if (job.logs.length > 2000) job.logs.shift();
    this.scheduleWorkspaceSnapshot(job);
    void this.persist();
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
      enabled: source.enabled === true,
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

    const password = config.accounts.find((account) => Boolean(account.password?.trim()))?.password
      || this.getPrimaryRuntimeCredential(job.id)?.password
      || '';
    if (!password) {
      job.qualityAudit.status = 'ERROR';
      job.qualityAudit.message = 'Password akun audit belum tersedia di sesi runtime. Isi akun tester atau jalankan ulang provisioning.';
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
          scorePercent?: number;
          errorBreakdown?: { userAppErrors: number; qcEngineErrors: number };
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
        const totalAudited = Math.max(1, (result.total ?? 1) - (result.notApplicable ?? 0));
        const calcPercent = Math.round(((result.passed ?? 0) / totalAudited) * 100);
        job.qualityAudit!.scorePercent = report?.scorePercent ?? (result as any).scorePercent ?? calcPercent;
        job.qualityAudit!.errorBreakdown = report?.errorBreakdown ?? {
          userAppErrors: (result as any).userAppErrors ?? result.failed ?? 0,
          qcEngineErrors: (result as any).qcEngineErrors ?? 0,
        };
        job.qualityAudit!.categories = report?.categories;
        job.qualityAudit!.visualRegression = report?.visualRegression;
        job.qualityAudit!.finishedAt = new Date().toISOString();
        this.addLog(job, 'quality', `Quality Audit selesai: ${result.passed ?? 0}/${result.total ?? 0} check lulus (${job.qualityAudit!.scorePercent}%), ${result.failed ?? 0} error (${job.qualityAudit!.errorBreakdown.userAppErrors} kode aplikasi user, ${job.qualityAudit!.errorBreakdown.qcEngineErrors} runner QC).`);

        // Sync quality audit screenshots directly into discovery inventory pages
        if (job.inventory?.pages && finalResult?.runDir) {
          try {
            const qaScreenshotsDir = path.join(finalResult.runDir, 'screenshots');
            const jobScreenshotsDir = path.join(this.artifactRoot, 'jobs', job.id, 'screenshots');
            await mkdir(jobScreenshotsDir, { recursive: true });
            const qaFiles = await readdir(qaScreenshotsDir).catch(() => [] as string[]);
            let syncedCount = 0;
            for (const page of job.inventory.pages) {
              const pageSlug = page.path.toLowerCase().replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/g, '-') || 'index';
              const match = qaFiles.find(f => (f.startsWith('chromium-desktop-') || f.includes('desktop-')) && (f.endsWith(`-${pageSlug}.png`) || f === `chromium-desktop-${pageSlug}.png`));
              if (match) {
                const destFile = `qa-${match}`;
                await copyFile(path.join(qaScreenshotsDir, match), path.join(jobScreenshotsDir, destFile)).catch(() => {});
                page.screenshot = `screenshots/${destFile}`;
                if (page.state === 'candidate') page.state = 'observed';
                syncedCount++;
              }
            }
            if (syncedCount > 0) {
              this.addLog(job, 'quality', `Berhasil menyinkronkan ${syncedCount} screenshot audit ke inventory halaman.`);
            }
          } catch (err) {
            this.addLog(job, 'quality', `Screenshot sync warning: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        resolve();
      });
    }).catch((error) => {
      job.qualityAudit!.status = signal.aborted ? 'SKIPPED' : 'ERROR';
      job.qualityAudit!.message = error instanceof Error ? error.message : String(error);
      job.qualityAudit!.finishedAt = new Date().toISOString();
      this.addLog(job, 'quality', `Quality Audit tidak selesai: ${job.qualityAudit!.message}`);
    });

    // Replace the pre-audit PDF so the downloadable artifact includes the final UI findings and screenshots.
    try {
      const jobArtifactDir = path.join(this.artifactRoot, 'jobs', job.id);
      const pdfBuffer = await generatePdfReport(job, this.artifactRoot);
      await writeFile(path.join(jobArtifactDir, 'application-report.pdf'), pdfBuffer);
    } catch (error) {
      this.addLog(job, 'quality', `PDF final tidak dapat diperbarui: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildPhase1ReconSummary(
    platform: 'web' | 'android',
    observedPages: InventoryPage[],
    credentials: RuntimeRoleCredential[]
  ): Phase1ReconSummary {
    const roleMap = new Map<string, {
      pages: Set<string>;
      features: number;
      verified: boolean;
    }>();

    for (const cred of credentials) {
      const r = cred.role || 'user';
      if (!roleMap.has(r)) {
        roleMap.set(r, { pages: new Set<string>(), features: 0, verified: cred.verified });
      }
    }

    for (const page of observedPages) {
      if (/\/api(?:\/|$)/i.test(page.path)) continue;
      if (page.state === 'blocked' || page.state === 'error') continue;
      const role = page.role || (credentials[0]?.role || 'public');
      let entry = roleMap.get(role);
      if (!entry) {
        const cred = credentials.find((c) => c.role === role);
        entry = { pages: new Set<string>(), features: 0, verified: cred ? cred.verified : role === 'public' };
        roleMap.set(role, entry);
      }
      const key = (page.resolvedConcretePath || page.path).toLowerCase();
      if (!entry.pages.has(key)) {
        entry.pages.add(key);
        entry.features += page.interactiveFeatures?.length ?? 0;
      }
    }

    const roles = Array.from(roleMap.entries()).map(([role, info]) => ({
      role,
      pagesCount: info.pages.size,
      interactiveFeaturesCount: info.features,
      accountVerified: info.verified,
    }));

    return {
      discoveredAt: new Date().toISOString(),
      platform,
      totalRoles: roles.length,
      totalPages: roles.reduce((sum, r) => sum + r.pagesCount, 0),
      totalInteractiveFeatures: roles.reduce((sum, r) => sum + r.interactiveFeaturesCount, 0),
      roles,
    };
  }

  private async deduplicateAndDiagnoseGaps(rawGaps: CoverageGapItem[]): Promise<CoverageGapItem[]> {
    const byKey = new Map<string, CoverageGapItem>();
    for (const gap of rawGaps) {
      const key = `${gap.role}::${gap.pagePath}::${gap.phaseFailed}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          ...gap,
          failedApiCalls: gap.failedApiCalls ? [...gap.failedApiCalls] : undefined,
          consoleOrDeviceErrors: gap.consoleOrDeviceErrors ? [...gap.consoleOrDeviceErrors] : undefined,
        });
      } else {
        if (gap.errorScreenshotUrl && !existing.errorScreenshotUrl) {
          existing.errorScreenshotUrl = gap.errorScreenshotUrl;
        }
        if (gap.failedApiCalls?.length) {
          existing.failedApiCalls = [...(existing.failedApiCalls || []), ...gap.failedApiCalls].slice(0, 8);
        }
        if (gap.consoleOrDeviceErrors?.length) {
          existing.consoleOrDeviceErrors = [...new Set([...(existing.consoleOrDeviceErrors || []), ...gap.consoleOrDeviceErrors])].slice(0, 8);
        }
      }
    }

    const deduped = [...byKey.values()];
    if (deduped.length > 0) {
      const diagnosed = await GeminiService.diagnoseCoverageGaps(deduped).catch(() => ({} as Record<string, CoverageGapItem['aiDiagnosis']>));
      for (const gap of deduped) {
        const diag = diagnosed?.[gap.id];
        if (diag) gap.aiDiagnosis = diag;
      }
    }
    return deduped;
  }

  private async writePhase1Reports(job: DiscoveryJob, jobArtifactDir: string): Promise<void> {
    try {
      const jsonReport = buildJsonReport(job);
      await writeFile(path.join(jobArtifactDir, 'application-report.json'), JSON.stringify(jsonReport, null, 2), 'utf8');
    } catch (err) {
      this.addLog(job, 'report', `Peringatan JSON report: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const reportHtml = buildReport(job, `/api/v1/discovery/jobs/${job.id}/artifacts/`);
      await writeFile(path.join(jobArtifactDir, 'application-report.html'), reportHtml, 'utf8');
    } catch (err) {
      this.addLog(job, 'report', `Peringatan HTML report: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const pdfBuffer = await generatePdfReport(job, this.artifactRoot);
      await writeFile(path.join(jobArtifactDir, 'application-report.pdf'), pdfBuffer);
    } catch (err) {
      this.addLog(job, 'report', `Peringatan PDF report: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async executeDiscovery(job: DiscoveryJob, config: DiscoveryConfig, signal: AbortSignal): Promise<void> {
    const isMobile = config.platform === 'android';
    const platformLabel = isMobile ? 'Mobile / Android' : 'Web Application';

    job.status = 'RUNNING';
    job.phase = 'INITIALIZING';
    job.progress = 5;
    this.addLog(job, 'system', `Memulai engine discovery — Platform: ${platformLabel}`);
    this.addLog(job, 'system', `Project: "${config.name}" | Mode: ${config.runMode}`);

    const jobArtifactDir = path.join(this.artifactRoot, 'jobs', job.id);
    const screenshotDir = path.join(jobArtifactDir, 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    let dbCleanup: (() => Promise<void>) | undefined;
    let managedRuntimeRelease: (() => void | Promise<void>) | undefined;
    let managedRuntimePromise: Promise<unknown> | undefined;
    let managedSourceDir = '';
    let managedBackendContainer: { name: string; workdir: string } | undefined;
    let targetBaseUrl = config.baseUrl;
    let activeSerial = '';
    let androidJobStarted = false;
    let holdingEmulatorReview = false;
    const phase1Gaps: CoverageGapItem[] = [];

    if (!this.jobSecrets.has(job.id)) {
      this.jobSecrets.set(job.id, new Set<string>());
    }
    const jobSecretSet = this.jobSecrets.get(job.id)!;
    for (const acc of config.accounts ?? []) {
      if (acc.password?.trim()) this.registerSecret(job.id, acc.password);
    }

    // Materialize uploaded .env file if supplied so project-runner accepts it cleanly
    let uploadedEnvFilePath: string | undefined;
    if (config.envUploadId) {
      const envUpload = this.uploads.get(config.envUploadId);
      if (envUpload?.content) {
        const destEnv = path.join(jobArtifactDir, '.env.uploaded');
        await writeFile(destEnv, envUpload.content, 'utf8');
        uploadedEnvFilePath = destEnv;
        for (const line of envUpload.content.split(/\r?\n/)) {
          const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
          if (m && /key|secret|password|token/i.test(m[1]) && m[2].length >= 4) {
            this.registerSecret(job.id, m[2].replace(/^["']|["']$/g, ''));
          }
        }
      }
    }

    const frontendRepoUrl = config.frontendTarget?.repositoryUrl?.trim() || config.repositoryUrl?.trim() || '';
    const frontendBranch = config.frontendTarget?.branch?.trim() || config.ref?.trim() || 'main';
    const backendRepoUrl = config.backendTarget?.repositoryUrl?.trim() || '';
    const backendBranch = config.backendTarget?.branch?.trim() || frontendBranch;
    const mobileRepoUrl =
      config.mobileTarget?.repositoryUrl?.trim() ||
      (isMobile && config.mobileTarget?.sameRepoAsFrontend !== false ? (frontendRepoUrl || undefined) : undefined);
    const mobileBranch = config.mobileTarget?.branch?.trim() || frontendBranch;
    const configuredBackendUrl = config.backendUrl?.trim() || config.backendTarget?.url?.trim() || '';

    try {
      signal.throwIfAborted();

      // 1. Runtime, Dual-Repo Sandbox & .env Provisioning
      const hasGitHubTarget =
        config.sourceType === 'github' ||
        config.frontendTarget?.mode === 'server' ||
        config.backendTarget?.mode === 'server' ||
        config.mobileTarget?.mode === 'server' ||
        Boolean(frontendRepoUrl || backendRepoUrl || mobileRepoUrl);

      if (config.runMode === 'demo') {
        job.phase = 'STARTING_DEMO_APP';
        job.progress = 15;
        this.addLog(job, 'system', '▶ [Stage 1/6] Menyiapkan server aplikasi demo...');
        targetBaseUrl = await this.ensureDemoServer();
        this.addLog(job, 'system', `✓ Server demo aktif di ${targetBaseUrl}`);
      } else if (config.runMode === 'managed-local') {
        job.phase = 'PREPARING_RUNTIME';
        job.progress = 10;
        this.addLog(job, 'runtime', `▶ [Stage 1/6] Menyiapkan runtime sandbox (platform: ${config.platform}, stack: ${config.stack})...`);

        const effectiveSourceType: 'local-folder' | 'github' =
          config.sourceType === 'local-folder' || (!hasGitHubTarget && config.localPath?.trim())
            ? 'local-folder'
            : 'github';

        let skipRunnerBecauseLocalAlreadyRunning = false;
        if (effectiveSourceType === 'local-folder' && !backendRepoUrl && !isMobile) {
          const probeUrls = [
            config.baseUrl,
            config.baseUrl.includes('localhost') ? config.baseUrl.replace('localhost', '127.0.0.1') : config.baseUrl.replace('127.0.0.1', 'localhost'),
          ];
          for (const u of new Set(probeUrls)) {
            if (!u) continue;
            try {
              const res = await fetch(u, { signal: AbortSignal.timeout(3000) });
              if (res.ok || res.status < 500) {
                skipRunnerBecauseLocalAlreadyRunning = true;
                targetBaseUrl = u;
                job.config.baseUrl = u;
                this.addLog(job, 'runtime', `✓ Service local-folder sudah aktif di ${u}. Memakai service yang berjalan.`);
                break;
              }
            } catch { /* continue */ }
          }
        }

        if (!skipRunnerBecauseLocalAlreadyRunning && (effectiveSourceType === 'github' || Boolean(config.localPath?.trim()))) {
          let releaseRuntime!: () => void;
          let resolveReady!: () => void;
          let rejectReady!: (error: unknown) => void;
          const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
          const hold = new Promise<void>((resolve) => { releaseRuntime = resolve; });
          const runtimeFlow = {
            schemaVersion: '1.0',
            version: '1.0',
            name: `managed-runtime-${job.id}`,
            target: { platform: isMobile ? 'android' : 'web', baseUrl: config.baseUrl },
            steps: [],
            cleanup: []
          } as unknown as NormalizedFlow;
          const managedProject: ManagedProject = {
            sourceType: effectiveSourceType,
            sourcePath: effectiveSourceType === 'local-folder' ? config.localPath : undefined,
            repositoryUrl: effectiveSourceType === 'github' ? frontendRepoUrl : undefined,
            ref: frontendBranch,
            baseUrl: config.baseUrl,
            backendUrl: configuredBackendUrl || undefined,
            backendRepositoryUrl: effectiveSourceType === 'github' ? (backendRepoUrl || undefined) : undefined,
            backendRef: backendBranch,
            mobileRepositoryUrl: effectiveSourceType === 'github' ? (mobileRepoUrl || undefined) : undefined,
            mobileRef: mobileBranch,
            sameRepoAsFrontend: config.mobileTarget?.sameRepoAsFrontend,
            platform: config.platform,
            environment: 'local',
            stack: config.stack,
            envFilePath: uploadedEnvFilePath,
            retainClone: effectiveSourceType === 'github',
            services: config.services
          };
          const runtimeAbort = () => releaseRuntime();
          signal.addEventListener('abort', runtimeAbort, { once: true });
          managedRuntimePromise = runManagedProject(runtimeFlow, `discovery-${job.id}`, managedProject, this.artifactRoot, this.projectRoot, {
            signal,
            update: (update) => {
              if (update.phase) job.phase = update.phase;
              if (typeof update.progress === 'number') job.progress = Math.max(job.progress, Math.min(35, update.progress));
              if (update.services) this.addLog(job, 'runtime', `Service runtime: ${update.services.map((service) => `${service.name}=${service.status}`).join(', ')}`);
              if (update.message) this.addLog(job, 'runtime', update.message);
            },
            onSource: async (sourceDir) => { managedSourceDir = sourceDir; },
            onEnvProvisioned: (envResult: EnvProvisionResult) => {
              for (const sec of envResult.secretsToRedact) {
                this.registerSecret(job.id, sec);
              }
              job.envProvisioning = {
                entries: envResult.entries,
                warnings: envResult.warnings,
                secretsToRedact: envResult.secretsToRedact.map(() => '[REDACTED]'),
              };
              for (const warning of envResult.warnings) {
                phase1Gaps.push({
                  id: `gap-env-${phase1Gaps.length + 1}`,
                  role: 'infra',
                  pagePath: '/.env',
                  pageTitle: 'Environment Provisioning (.env Demo)',
                  phaseFailed: 'ENV',
                  category: 'env-misconfigured',
                  technicalReason: warning,
                });
              }
              void this.persist();
            },
            beforeStart: async (runnerContext) => {
              for (const [svcId, containerInfo] of runnerContext.containers.entries()) {
                const svcMeta = runnerContext.services.find((s) => s.id === svcId);
                if (svcMeta?.kind === 'backend' || /backend|laravel|api/i.test(svcId)) {
                  managedBackendContainer = containerInfo;
                  break;
                }
              }
              if (!managedBackendContainer && runnerContext.containers.size > 0) {
                managedBackendContainer = runnerContext.containers.values().next().value;
              }
            },
            prepare: async (runnerContext) => {
              if (config.database.engine === 'none') return {};
              job.phase = 'PREPARING_DATABASE';
              job.progress = 12;
              this.addLog(job, 'database', `▶ [Stage 2/6] Menyiapkan isolated container database ${config.database.engine} pada ${runnerContext.networkName}...`);

              let sqlContent: string | undefined;
              if (config.database.source === 'sql' && config.database.sqlUploadId) {
                const up = this.uploads.get(config.database.sqlUploadId);
                sqlContent = up?.content;
              }
              if (!sqlContent) {
                const projectSlug = (config.name || 'project').toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
                const projectSeedPath = path.join(this.artifactRoot, 'projects', projectSlug, 'database', 'seed.sql');
                try {
                  const content = await readFile(projectSeedPath, 'utf8');
                  if (content && content.trim()) {
                    sqlContent = content;
                    this.addLog(job, 'database', `✓ Menggunakan file seed SQL project: ${projectSeedPath}`);
                  }
                } catch { /* no project seed SQL */ }
              }

              const workspaceDir = path.join(jobArtifactDir, 'workspace');
              await mkdir(workspaceDir, { recursive: true });

              try {
                const db = await prepareDatabase({
                  config: config.database,
                  runId: runnerContext.runId,
                  networkName: runnerContext.networkName,
                  workspace: workspaceDir,
                  sqlContent,
                  signal,
                  log: (msg) => this.addLog(job, 'database', msg)
                });
                dbCleanup = db.cleanup;
                if (db.environment.DB_PASSWORD) this.registerSecret(job.id, db.environment.DB_PASSWORD);
                this.addLog(job, 'database', `✓ Database isolated (${config.database.engine}) siap dan terhubung.`);
                return db.environment;
              } catch (dbErr) {
                this.addLog(job, 'database', `Peringatan bootstrap DB: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
                return {};
              }
            },
            execute: async () => {
              resolveReady();
              await hold;
              return { status: 'PASSED', steps: [], artifacts: [] } as WebRunResult;
            }
          }).then(() => undefined).catch((error) => {
            rejectReady(error);
          });

          try {
            await ready;
            managedRuntimeRelease = () => { releaseRuntime(); };
            targetBaseUrl = managedProject.baseUrl || config.baseUrl;
            job.config.baseUrl = targetBaseUrl;
            this.addLog(job, 'runtime', `✓ Sandbox runtime aktif (${targetBaseUrl}).`);
          } catch (error) {
            managedRuntimeRelease = () => { releaseRuntime(); };
            throw error;
          }
        }
      } else {
        // existing-target mode
        try {
          await fetch(config.baseUrl, { signal: AbortSignal.timeout(2000) });
          this.addLog(job, 'runtime', `▶ [Stage 1/6] Memakai target existing aktif: ${config.baseUrl}`);
        } catch {
          this.addLog(job, 'runtime', `▶ [Stage 1/6] Memakai target existing: ${config.baseUrl}`);
        }
        this.addLog(job, 'database', '▶ [Stage 2/6] Database bootstrap dilewati pada mode existing-target.');
      }

      // 2. Android Server Emulator Readiness & APK Install (FR-03)
      let effectiveAppId = config.appId?.trim() || config.apkPackageId?.trim() || '';
      if (isMobile) {
        notifyAndroidJobStarted();
        androidJobStarted = true;
        job.phase = 'PREPARING_MOBILE';
        job.progress = 26;
        const useServerEmulator = config.useServerEmulator !== false;
        this.addLog(job, 'android', `▶ Menyiapkan Server Emulator Android headless (useServerEmulator=${useServerEmulator})...`);

        const ready = await ensureDeviceReady(config.deviceId, useServerEmulator);
        if (!ready.serial) {
          const reason = ready.error || 'Headless Android Emulator di server gagal siap / tidak ditemukan AVD qc_worker_headless.';
          phase1Gaps.push({
            id: 'gap-android-emulator',
            role: 'mobile',
            pagePath: '/emulator',
            pageTitle: 'Server Headless Android Emulator',
            phaseFailed: 'EMULATOR',
            category: 'env-misconfigured',
            technicalReason: reason,
          });
          job.coverageGaps = await this.deduplicateAndDiagnoseGaps(phase1Gaps);
          await this.writePhase1Reports(job, jobArtifactDir);
          throw new Error(reason);
        }

        activeSerial = ready.serial;
        this.addLog(job, 'android', `✓ Server emulator siap: ${activeSerial}${ready.model ? ` (${ready.model})` : ''}`);

        // Reverse backend port so Android emulator reaches backend sandbox cleanly on 127.0.0.1:<port>
        const reverseTarget = configuredBackendUrl || targetBaseUrl;
        if (reverseTarget && /^https?:/i.test(reverseTarget)) {
          try {
            const parsedBackend = new URL(reverseTarget);
            const reversePort = Number(parsedBackend.port || (parsedBackend.protocol === 'https:' ? 443 : 80));
            if (reversePort > 0 && reversePort <= 65535) {
              const reversed = await setupAdbReverse(activeSerial, reversePort);
              this.addLog(job, 'android', reversed
                ? `✓ adb reverse tcp:${reversePort} aktif untuk backend.`
                : `ℹ adb reverse tcp:${reversePort} dilewati / gunakan 10.0.2.2.`);
            }
          } catch { /* ignore invalid URL */ }
        }

        const apkUpload = config.apkUploadId ? this.getUpload(config.apkUploadId) as { path?: string; packageId?: string } | undefined : undefined;
        let apkPathToInstall = apkUpload?.path;
        if (!apkPathToInstall && managedSourceDir) {
          const mobileBuildDir = existsSync(path.join(managedSourceDir, 'mobile'))
            ? path.join(managedSourceDir, 'mobile')
            : managedSourceDir;
          if (
            existsSync(path.join(mobileBuildDir, 'pubspec.yaml')) ||
            existsSync(path.join(mobileBuildDir, 'gradlew')) ||
            existsSync(path.join(mobileBuildDir, 'android', 'gradlew'))
          ) {
            const built = await buildApkFromMobileRepo(mobileBuildDir, (msg) => this.addLog(job, 'android', msg));
            if (built.apkPath) {
              apkPathToInstall = built.apkPath;
              if (built.packageId && !effectiveAppId) effectiveAppId = built.packageId;
            } else if (built.error) {
              this.addLog(job, 'android', `Peringatan build APK dari repo mobile: ${built.error}`);
            }
          }
        }

        if (apkPathToInstall) {
          const inspected = await inspectApk(apkPathToInstall).catch(() => ({} as { packageId?: string }));
          if (inspected.packageId && !effectiveAppId) {
            effectiveAppId = inspected.packageId;
          }
          const installRes = await installApkToDevice(apkPathToInstall, activeSerial, false, useServerEmulator);
          if (!installRes.success) {
            const reason = `Gagal menginstal APK ke server emulator ${activeSerial}: ${installRes.output}`;
            phase1Gaps.push({
              id: 'gap-android-install',
              role: 'mobile',
              pagePath: '/apk-install',
              pageTitle: 'Instalasi APK ke Server Emulator',
              phaseFailed: 'EMULATOR',
              category: 'env-misconfigured',
              technicalReason: reason,
            });
            job.coverageGaps = await this.deduplicateAndDiagnoseGaps(phase1Gaps);
            await this.writePhase1Reports(job, jobArtifactDir);
            throw new Error(reason);
          }
          this.addLog(job, 'android', `✓ APK terpasang pada ${activeSerial} (${effectiveAppId || path.basename(apkPathToInstall)}).`);
        }

        if (!effectiveAppId) {
          throw new Error('Package App ID Android belum diketahui (isi App ID atau upload APK yang valid).');
        }
        job.config.appId = effectiveAppId;
      }

      // 3. Static Source Scanning
      job.phase = 'SCANNING_SOURCE';
      job.progress = 38;
      let initialPages: InventoryPage[] = [];
      let routes: Array<{ path: string; method: string; source: string }> = [];
      let api: Array<{ path: string; method: string; source: string }> = [];
      let filesScanned = 0;
      let warnings: string[] = [];

      let scanTargetDir = '';
      if (managedSourceDir) {
        scanTargetDir = managedSourceDir;
      } else if (config.runMode === 'demo') {
        scanTargetDir = path.join(this.projectRoot, 'apps/demo-app');
      } else if (config.localPath?.trim() && existsSync(config.localPath.trim())) {
        scanTargetDir = config.localPath.trim();
      } else if (config.repositoryUrl && !config.repositoryUrl.startsWith('http') && existsSync(config.repositoryUrl)) {
        scanTargetDir = config.repositoryUrl;
      }

      if (scanTargetDir) {
        this.addLog(job, 'discovery', `▶ [Stage 3/6] Static code analysis: ${scanTargetDir}`);
        try {
          const scan = await scanSource(scanTargetDir);
          initialPages = scan.pages;
          routes = scan.routes;
          api = scan.api;
          filesScanned = scan.filesScanned;
          warnings = scan.warnings;
          this.addLog(job, 'discovery', `✓ Scan selesai: ${filesScanned} file, ${initialPages.length} layar/halaman, ${routes.length} route, ${api.length} endpoint API.`);
        } catch (scanErr) {
          this.addLog(job, 'discovery', `⚠ Scan source dilewati/gagal: ${scanErr instanceof Error ? scanErr.message : String(scanErr)}`);
        }
      } else {
        this.addLog(job, 'discovery', '▶ [Stage 3/6] Static source dilewati (tidak ada folder lokal / clone), lanjut dynamic discovery.');
      }

      // 4. Auto Role Discovery & Credential Provisioning (FR-04)
      job.phase = 'PROVISIONING_ACCOUNTS';
      job.progress = 48;
      this.addLog(job, 'discovery', '▶ [Stage 4/6] Mendeteksi role aplikasi & menyiapkan kredensial runtime (tanpa hardcode)...');
      const provisioned = await provisionRoleAccounts({
        sourceDir: scanTargetDir || undefined,
        backendUrl: configuredBackendUrl || (!isMobile ? targetBaseUrl : undefined),
        frontendUrl: !isMobile ? targetBaseUrl : undefined,
        explicitAccounts: config.accounts,
        autoProvisionAccounts: config.autoProvisionAccounts !== false,
        backendContainer: managedBackendContainer,
        secretsOut: jobSecretSet,
      });
      this.runtimeRoleCredentials.set(job.id, provisioned.runtimeCredentials);
      job.provisionedAccounts = provisioned.publicAccounts;
      this.addLog(job, 'discovery', `✓ Terdeteksi ${provisioned.runtimeCredentials.size} role akun (${provisioned.publicAccounts.map((a) => `${a.role}:${a.source}`).join(', ') || 'public only'}).`);

      const effectiveLoginPath =
        config.rules?.loginPath && config.rules.loginPath !== '/login'
          ? config.rules.loginPath
          : (provisioned.schema.loginPath || '/login');

      // 5. Stage 1 Reconnaissance — Web & Android (NO final SS/Video yet! FR-05)
      let observedPages: InventoryPage[] = [];
      const credentialsList = [...provisioned.runtimeCredentials.values()];

      if (isMobile) {
        job.phase = 'RECON_ANDROID';
        job.progress = 62;
        this.addLog(job, 'android', '▶ [Stage 5/6] Reconnaissance Android di headless emulator (tanpa simpan SS/video final)...');
        const recon = await exploreAndroidScreensForRecon({
          serial: activeSerial,
          appId: effectiveAppId,
          credentials: credentialsList,
          staticPages: initialPages,
          onLog: (msg) => this.addLog(job, 'android', msg),
        });
        observedPages = recon.pages;
        phase1Gaps.push(...recon.gaps);
        if (config.businessFlowReview?.mode !== 'auto') {
          setEmulatorReviewHold(true);
          holdingEmulatorReview = true;
        }
      } else {
        job.phase = 'CRAWLING_UI';
        job.progress = 62;
        this.addLog(job, 'browser', `▶ [Stage 5/6] Reconnaissance Web Playwright pada ${targetBaseUrl} (tanpa simpan SS/video final)...`);
        try {
          const crawlAccounts = credentialsList.map((cred) => ({
            email: cred.identifier,
            password: cred.password,
            role: cred.role,
            token: cred.token,
            identifierField: cred.identifierField,
          }));
          observedPages = await crawlUI(
            targetBaseUrl,
            initialPages,
            jobArtifactDir,
            { ...config.rules, loginPath: effectiveLoginPath },
            crawlAccounts,
            signal,
            (msg) => this.addLog(job, 'browser', msg)
          );

          // Enrich bare slug titles with Gemini if configured
          const barePages = observedPages.filter((p) => !p.title || p.title === p.path);
          if (GeminiService.isConfigured() && barePages.length > 0) {
            const labels = await GeminiService.labelScreensAndTabs(
              barePages.slice(0, 20).map((p) => ({
                id: p.id,
                rawPathOrWidget: p.path,
                sampleTexts: (p.interactiveFeatures || []).slice(0, 4).map((f) => f.label),
              }))
            ).catch(() => ({} as Record<string, string>));
            for (const p of barePages) {
              if (labels[p.id]) p.title = labels[p.id];
            }
          }
          this.addLog(job, 'browser', `✓ Reconnaissance selesai: ${observedPages.length} entri halaman/status terpetakan.`);
        } catch (crawlErr) {
          this.addLog(job, 'browser', `⚠ Crawl Web tidak lengkap: ${crawlErr instanceof Error ? crawlErr.message : String(crawlErr)}`);
          observedPages = initialPages.length > 0 ? initialPages : [{
            id: 'root',
            path: '/',
            title: 'Home Page (Candidate)',
            state: 'candidate',
            elements: [],
          }];
        }
      }

      // 6. Inventory + Recon Summary + Flow Synthesis
      job.phase = 'BUILDING_INVENTORY';
      job.progress = 76;
      const capabilities = detectCapabilities({ pages: observedPages, routes, api });
      const crudPlan = buildCrudPlan({ pages: observedPages, routes, api });
      const roleActionPlan = buildRoleActionPlan({
        pages: observedPages,
        accounts: config.accounts?.length ? config.accounts : (job.provisionedAccounts || credentialsList.map(c => ({ role: c.role }))),
      });
      const featureContractPlan = buildFeatureContractPlan({ pages: observedPages, capabilities: capabilities.capabilities, crudPlan, roleActionPlan });
      const rolesDiscovered = [...new Set([
        ...credentialsList.map((c) => c.role),
        ...observedPages.map((p) => p.role).filter((r): r is string => Boolean(r)),
      ])];

      const inventory: Inventory = {
        pages: observedPages,
        routes,
        api,
        filesScanned,
        warnings,
        generatedAt: new Date().toISOString(),
        rolesDiscovered,
        capabilities,
        crudPlan,
        roleActionPlan,
        featureContractPlan,
      };
      job.inventory = inventory;
      job.reconSummary = this.buildPhase1ReconSummary(isMobile ? 'android' : 'web', observedPages, credentialsList);

      const flowAccountStubs = credentialsList.map((c) => ({ name: c.name, email: c.identifier, role: c.role, password: '' }));
      const flows = buildFlows(inventory, { ...config, baseUrl: targetBaseUrl, accounts: flowAccountStubs });
      job.flows = flows;
      job.businessFlowMap = buildBusinessFlowMap(inventory, { ...config, baseUrl: targetBaseUrl, accounts: flowAccountStubs });

      await writeFile(path.join(jobArtifactDir, 'application-inventory.json'), JSON.stringify(inventory, null, 2), 'utf8');
      await writeFile(path.join(jobArtifactDir, 'capability-profile.json'), JSON.stringify(capabilities, null, 2), 'utf8');
      await writeFile(path.join(jobArtifactDir, 'crud-plan.json'), JSON.stringify(crudPlan, null, 2), 'utf8');
      await writeFile(path.join(jobArtifactDir, 'role-action-plan.json'), JSON.stringify(roleActionPlan, null, 2), 'utf8');
      await writeFile(path.join(jobArtifactDir, 'feature-contract-plan.json'), JSON.stringify(featureContractPlan, null, 2), 'utf8');

      // 7. Mandatory Human-in-the-Loop ACC Gate for BOTH Web & Android (FR-05)
      if (config.businessFlowReview?.mode !== 'auto') {
        this.addLog(
          job,
          'flow-builder',
          `📋 Reconnaissance selesai: ${job.reconSummary.totalRoles} role, ${job.reconSummary.totalPages} halaman/layar, ${job.reconSummary.totalInteractiveFeatures} tab/fitur interaktif. Menunggu ACC user sebelum Command Plan, Long SS, & Video.`
        );
        await this.waitForBusinessFlowApproval(job, signal);
      } else {
        const now = new Date().toISOString();
        if (job.reconSummary) job.reconSummary.approvedAt = now;
        if (job.businessFlowMap) {
          job.businessFlowMap.flows.forEach((f) => { f.status = 'APPROVED'; f.approvedAt = now; });
          refreshBusinessFlowSummary(job.businessFlowMap);
        }
      }

      if (holdingEmulatorReview) {
        setEmulatorReviewHold(false);
        holdingEmulatorReview = false;
      }

      // 8. Post-ACC Step 1: Deterministic Command Plan Generation (FR-06)
      job.status = 'RUNNING';
      job.phase = 'GENERATING_COMMANDS';
      job.progress = 86;
      this.addLog(job, 'flow-builder', '▶ [Post-ACC 1/4] Menghasilkan Command Plan (Long Screenshot & Continuous Role Video)...');
      const commandOutput = await generatePostAccCommandPlan({
        inventory,
        platform: isMobile ? 'android' : 'web',
        baseUrl: targetBaseUrl,
        appId: effectiveAppId,
        credentials: credentialsList,
        runPath: jobArtifactDir,
      });
      job.commandPlan = commandOutput.plan;
      phase1Gaps.push(...commandOutput.unresolvedGaps);
      this.addLog(
        job,
        'flow-builder',
        `✓ Command plan siap: ${commandOutput.plan.screenshotCommands.length} perintah Long SS, ${commandOutput.plan.videoCommands.length} skrip video role.`
      );
      await this.persist();
      await this.writeWorkspaceSnapshot(job);

      // 9. Post-ACC Step 2 (Batch 1): Strictly 1 Long Full-Page Screenshot per Page per Role (FR-06)
      job.phase = 'CAPTURING_LONG_SCREENSHOTS';
      job.progress = 89;
      this.addLog(job, 'runner', '▶ [Post-ACC 2/4 — Batch 1] Menjalankan capture 1 Long Screenshot (atas-bawah) per halaman...');
      const ssResult = isMobile
        ? await captureAndroidLongScreenshots({
            jobId: job.id,
            serial: activeSerial,
            appId: effectiveAppId,
            plan: commandOutput.plan,
            credentials: credentialsList,
            runPath: jobArtifactDir,
            signal,
            onLog: (msg) => this.addLog(job, 'android', msg),
          })
        : await captureWebLongScreenshots({
            jobId: job.id,
            plan: commandOutput.plan,
            credentials: credentialsList,
            baseUrl: targetBaseUrl,
            runPath: jobArtifactDir,
            loginRules: { ...config.rules, loginPath: effectiveLoginPath },
            signal,
            onLog: (msg) => this.addLog(job, 'browser', msg),
          });

      job.longScreenshots = ssResult.artifacts;
      phase1Gaps.push(...ssResult.gaps);

      for (const art of ssResult.artifacts) {
        if (art.status !== 'CAPTURED') continue;
        const page = inventory.pages.find(
          (p) => p.id === art.pageId || (p.path === art.pagePath && (!p.role || p.role === art.role))
        );
        if (page) {
          page.screenshot = `screenshots/long/${art.filename}`;
          page.state = 'observed';
        }
      }
      if (job.reconSummary) {
        job.reconSummary.batch1TotalScreenshots = ssResult.artifacts.length;
        job.reconSummary.batch1CapturedCount = ssResult.artifacts.filter((a) => a.status === 'CAPTURED').length;
      }
      this.addLog(
        job,
        'runner',
        `✓ Batch 1 selesai: ${job.reconSummary?.batch1CapturedCount ?? 0}/${ssResult.artifacts.length} Long Screenshot berhasil.`
      );
      await writeFile(path.join(jobArtifactDir, 'application-inventory.json'), JSON.stringify(inventory, null, 2), 'utf8');
      await this.persist();
      await this.writeWorkspaceSnapshot(job);

      // 10. Post-ACC Step 3 (Batch 2 — Strictly After Batch 1): Continuous Video per Role (FR-07)
      job.phase = 'RECORDING_ROLE_VIDEOS';
      job.progress = 93;
      this.addLog(job, 'runner', '▶ [Post-ACC 3/4 — Batch 2] Merekam video perjalanan penuh per role (klik seluruh tab + scroll penuh)...');
      const vidResult = isMobile
        ? await recordAndroidRoleVideos({
            jobId: job.id,
            serial: activeSerial,
            appId: effectiveAppId,
            plan: commandOutput.plan,
            credentials: credentialsList,
            runPath: jobArtifactDir,
            signal,
            onLog: (msg) => this.addLog(job, 'android', msg),
          })
        : await recordWebRoleVideos({
            jobId: job.id,
            plan: commandOutput.plan,
            credentials: credentialsList,
            baseUrl: targetBaseUrl,
            runPath: jobArtifactDir,
            loginRules: { ...config.rules, loginPath: effectiveLoginPath },
            signal,
            onLog: (msg) => this.addLog(job, 'browser', msg),
          });

      job.roleVideos = vidResult.videos;
      phase1Gaps.push(...vidResult.gaps);
      if (job.reconSummary) {
        job.reconSummary.batch2TotalRoleVideos = vidResult.videos.length;
        job.reconSummary.batch2RecordedCount = vidResult.videos.filter((v) => v.status === 'RECORDED').length;
      }
      this.addLog(
        job,
        'runner',
        `✓ Batch 2 selesai: ${job.reconSummary?.batch2RecordedCount ?? 0}/${vidResult.videos.length} Video per role berhasil direkam.`
      );

      // Populate per-role summary results for compatibility with Attempt & Evidence tabs
      const roleKeys = new Set<string>([
        ...commandOutput.plan.videoCommands.map((v) => v.role),
        ...vidResult.videos.map((v) => v.role),
      ]);
      for (const role of roleKeys) {
        const flowId = `phase1-role-${role}`;
        const roleVideo = vidResult.videos.find((v) => v.role === role);
        const roleShots = ssResult.artifacts.filter((s) => s.role === role);
        const passed = Boolean(roleVideo?.status === 'RECORDED') && roleShots.every((s) => s.status === 'CAPTURED');
        if (!job.flows.some((f) => f.id === flowId)) {
          job.flows.push({
            id: flowId,
            name: `Phase-1 Full Coverage: Role ${role}`,
            source: '',
            platform: isMobile ? 'android' : 'web',
            status: passed ? 'PASSED' : 'FAILED',
          });
        }
        const resultArtifacts: WebRunResult['artifacts'] = [];
        if (roleVideo?.status === 'RECORDED' && roleVideo.path) {
          resultArtifacts.push({ type: 'video', path: roleVideo.path, name: roleVideo.filename } as any);
        }
        for (const s of roleShots) {
          if (s.status === 'CAPTURED' && s.path) {
            resultArtifacts.push({ type: 'screenshot', path: s.path, name: s.filename } as any);
          }
        }
        job.results.push({
          flowId,
          runId: `phase1-${role}-${Date.now().toString(36)}`,
          finishedAt: new Date().toISOString(),
          status: passed ? 'PASSED' : 'FAILED',
          steps: [
            {
              id: `phase1-${role}-batch1-ss`,
              index: 0,
              action: `Batch 1 Long SS (${roleShots.filter((s) => s.status === 'CAPTURED').length}/${roleShots.length})`,
              status: roleShots.every((s) => s.status === 'CAPTURED') ? 'PASSED' : 'FAILED',
              durationMs: 0,
            },
            {
              id: `phase1-${role}-batch2-video`,
              index: 1,
              action: `Batch 2 Continuous Video (${roleVideo?.durationSec ?? 0}s, ${roleVideo?.chapters.length ?? 0} chapter)`,
              status: roleVideo?.status === 'RECORDED' ? 'PASSED' : 'FAILED',
              durationMs: (roleVideo?.durationSec ?? 0) * 1000,
            },
          ],
          artifacts: resultArtifacts,
        });
      }

      // 11. Post-ACC Step 4: Coverage Gap Diagnosis & Gemini Executive Summary (FR-08 & FR-09)
      job.phase = 'DIAGNOSING_GAPS';
      job.progress = 96;
      this.addLog(job, 'discovery', '▶ [Post-ACC 4/4] Menganalisis halaman tidak bisa dicek & ringkasan laporan bersama Gemini...');
      const diagnosedGaps = await this.deduplicateAndDiagnoseGaps(phase1Gaps);
      job.coverageGaps = diagnosedGaps;
      if (job.reconSummary) {
        job.reconSummary.aiExecutiveSummary = await GeminiService.summarizePhase1Report({
          projectName: job.name,
          summary: job.reconSummary,
          coverageGaps: diagnosedGaps,
        }).catch(() => undefined);
      }

      await writeFile(path.join(jobArtifactDir, 'coverage-gaps.json'), JSON.stringify(diagnosedGaps, null, 2), 'utf8');
      await writeFile(path.join(jobArtifactDir, 'application-inventory.json'), JSON.stringify(inventory, null, 2), 'utf8');

      // Optional legacy DOM Quality Audit only when explicitly enabled
      if (!isMobile && config.qualityAudit?.enabled === true) {
        await this.runQualityAudit(job, config, signal);
      }

      // 12. Generate JSON / HTML / PDF Reports
      job.phase = 'GENERATING_REPORTS';
      job.progress = 98;
      await this.writePhase1Reports(job, jobArtifactDir);

      // Completion
      job.status = 'COMPLETED';
      job.phase = 'COMPLETED';
      job.progress = 100;
      job.finishedAt = new Date().toISOString();
      const ssCaptured = job.reconSummary?.batch1CapturedCount ?? 0;
      const ssTotal = job.reconSummary?.batch1TotalScreenshots ?? 0;
      const vidCaptured = job.reconSummary?.batch2RecordedCount ?? 0;
      const vidTotal = job.reconSummary?.batch2TotalRoleVideos ?? 0;
      job.message = `Fase 1 selesai: ${ssCaptured}/${ssTotal} Long SS, ${vidCaptured}/${vidTotal} Video Role, ${diagnosedGaps.length} kendala cakupan.`;
      this.addLog(job, 'system', '════════════════════════════════════════');
      this.addLog(job, 'system', `✅ ${job.message}`);
      this.addLog(job, 'system', '════════════════════════════════════════');

    } catch (err) {
      job.status = 'FAILED';
      job.phase = 'FAILED';
      job.finishedAt = new Date().toISOString();
      job.message = err instanceof Error ? err.message : String(err);
      this.addLog(job, 'system', `Gagal: ${job.message}`);
      if (phase1Gaps.length > 0 && !job.coverageGaps) {
        job.coverageGaps = await this.deduplicateAndDiagnoseGaps(phase1Gaps).catch(() => phase1Gaps);
        await this.writePhase1Reports(job, jobArtifactDir).catch(() => {});
      }
    } finally {
      if (holdingEmulatorReview) {
        setEmulatorReviewHold(false);
      }
      if (androidJobStarted) {
        notifyAndroidJobFinished();
        const otherActiveAndroid = Array.from(this.jobs.values()).some(
          (j) => j.id !== job.id && ['RUNNING', 'QUEUED', 'WAITING_REVIEW'].includes(j.status) && j.config.platform === 'android'
        );
        if (!otherActiveAndroid) {
          await stopAllManagedEmulators().catch(() => {});
        }
      }
      if (managedRuntimeRelease) {
        managedRuntimeRelease();
        try {
          await managedRuntimePromise;
          this.addLog(job, 'runtime', 'Managed-local runtime dibersihkan.');
        } catch (runtimeErr) {
          this.addLog(job, 'runtime', `Runtime cleanup warning: ${runtimeErr instanceof Error ? runtimeErr.message : String(runtimeErr)}`);
        }
      }
      if (dbCleanup) {
        try {
          await dbCleanup();
          this.addLog(job, 'database', 'Isolated database dibersihkan.');
        } catch (cleanErr) {
          this.addLog(job, 'database', `Database cleanup warning: ${cleanErr instanceof Error ? cleanErr.message : String(cleanErr)}`);
        }
      }
      await this.writeWorkspaceSnapshot(job).catch(() => {});
      void this.persist();
    }
  }

  public async createIncrementalRoomFromCommit(payload: {
    repositoryUrl?: string;
    repoName?: string;
    branch?: string;
    commitSha: string;
    commitMessage: string;
    author: string;
    filesChanged: string[];
    diffSummary?: string;
    parentJobId?: string;
  }): Promise<DiscoveryJob> {
    // 1. Cari baseline job
    let baselineJob: DiscoveryJob | undefined;
    if (payload.parentJobId) {
      baselineJob = this.jobs.get(payload.parentJobId);
    }
    if (!baselineJob && (payload.repositoryUrl || payload.repoName)) {
      const repoNameLower = (payload.repoName || '').toLowerCase();
      baselineJob = Array.from(this.jobs.values())
        .filter(j =>
          j.kind !== 'incremental-room' &&
          ((payload.repositoryUrl && j.config?.repositoryUrl === payload.repositoryUrl) ||
           (repoNameLower && (j.name?.toLowerCase().includes(repoNameLower) || j.config?.name?.toLowerCase().includes(repoNameLower))))
        )
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    }
    if (!baselineJob) {
      baselineJob = Array.from(this.jobs.values())
        .filter(j => j.kind !== 'incremental-room' && j.status === 'COMPLETED' && j.flows && j.flows.length > 0)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    }

    if (!baselineJob) {
      throw new Error('Tidak ditemukan baseline QA run untuk proyek ini. Harap jalankan baseline QA pertama terlebih dahulu.');
    }

    // 2. Analisis dampak perubahan commit
    const impact = analyzeCommitImpact(payload.filesChanged, baselineJob.flows, baselineJob.inventory);

    const id = randomUUID();
    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    const commitShaShort = payload.commitSha.slice(0, 7);
    const roomName = `[Update #${commitShaShort}] ${payload.commitMessage || 'Commit Update'}`;

    let resolvedDiffSummary = payload.diffSummary;
    if (!resolvedDiffSummary) {
      const possibleDirs = [
        baselineJob.config?.localPath,
        baselineJob.workspace?.projectPath,
        path.join(this.projectRoot, '..', payload.repoName || '')
      ].filter((d): d is string => Boolean(d && typeof d === 'string'));

      for (const dir of possibleDirs) {
        try {
          const out = execSync(`git show ${payload.commitSha} -U2 --color=never`, { cwd: dir, encoding: 'utf8', timeout: 4000 });
          if (out && out.includes('diff --git')) {
            resolvedDiffSummary = out.trim();
            break;
          }
        } catch {
          // ignore error
        }
      }
    }

    const job: DiscoveryJob = {
      id,
      name: roomName,
      status: 'QUEUED',
      phase: 'PREPARING',
      progress: 0,
      createdAt: new Date().toISOString(),
      logs: [],
      config: {
        ...baselineJob.config,
        name: roomName,
      },
      inventory: baselineJob.inventory,
      businessFlowMap: baselineJob.businessFlowMap,
      flows: impact.selectedFlows.map(f => ({ ...f, status: 'READY' })),
      results: [],
      parentJobId: baselineJob.id,
      kind: 'incremental-room',
      commitInfo: {
        sha: payload.commitSha,
        message: payload.commitMessage,
        author: payload.author,
        branch: payload.branch || 'main',
        filesChanged: payload.filesChanged,
        diffSummary: resolvedDiffSummary,
        repoUrl: payload.repositoryUrl,
      },
      impactReport: {
        impactedModules: impact.impactedModules,
        impactedRoutes: impact.impactedRoutes,
        totalFlowsTested: impact.selectedFlows.length,
        passed: 0,
        failed: 0,
        summary: impact.summary,
      },
    };

    await this.prepareWorkspace(job, job.config as any);
    this.jobs.set(id, job);

    const baselineRoles = this.runtimeRoleCredentials.get(baselineJob.id);
    if (baselineRoles) {
      this.runtimeRoleCredentials.set(id, new Map(baselineRoles));
    }
    const baselineSecrets = this.jobSecrets.get(baselineJob.id);
    if (baselineSecrets) {
      this.jobSecrets.set(id, new Set(baselineSecrets));
    }

    void this.persist();
    this.addLog(job, 'system', `Dedicated Room dibuat untuk commit #${commitShaShort} (${payload.author}).`);
    this.addLog(job, 'system', `Analisis Dampak: ${impact.summary}`);

    // Eksekusi terarah (targeted execution) secara asinkron
    void (async () => {
      try {
        job.status = 'RUNNING';
        job.phase = 'EXECUTING_TESTS';
        job.progress = 20;
        void this.persist();

        if (impact.selectedFlows.length === 0) {
          job.status = 'COMPLETED';
          job.phase = 'COMPLETED';
          job.progress = 100;
          job.finishedAt = new Date().toISOString();
          job.message = 'Commit tidak mengubah file alur bisnis. Tidak ada pengujian yang diperlukan.';
          this.addLog(job, 'system', `✅ ${job.message}`);
          void this.persist();
          return;
        }

        await this.runFlows(job.id, impact.selectedFlows.map(f => f.id));

        const passed = job.results.filter(r => r.status === 'PASSED').length;
        const failed = job.results.length - passed;
        if (job.impactReport) {
          job.impactReport.passed = passed;
          job.impactReport.failed = failed;
        }

        job.status = 'COMPLETED';
        job.phase = 'COMPLETED';
        job.progress = 100;
        job.finishedAt = new Date().toISOString();
        job.message = `Incremental QA Selesai: ${passed}/${impact.selectedFlows.length} skenario terdampak lulus.`;
        this.addLog(job, 'system', `✅ ${job.message}`);
        await this.writeWorkspaceSnapshot(job);
        void this.persist();
      } catch (err) {
        job.status = 'FAILED';
        job.phase = 'FAILED';
        job.finishedAt = new Date().toISOString();
        job.message = err instanceof Error ? err.message : String(err);
        this.addLog(job, 'system', `Incremental QA Gagal: ${job.message}`);
        void this.persist();
      }
    })();

    return job;
  }
}

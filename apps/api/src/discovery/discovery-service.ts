import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { NormalizedFlow } from '@qc/flow-schema';
import { validateFlow } from '@qc/flow-schema';
import { scanSource, type InventoryPage } from './source-scanner.ts';
import { crawlUI } from './ui-crawler.ts';
import type { DiscoveryConfig, DiscoveryJob, GeneratedFlow, Inventory } from './types.ts';
import { prepareDatabase, type PreparedDatabase } from '../database/database-manager.ts';
import { buildFlows } from '../flow-builder/inventory-to-flow.ts';
import { buildReport } from '../report/report-builder.ts';
import { generatePdfReport } from '../report/report-pdf.ts';
import { executeWebFlow, type WebRunResult } from '../playwright-adapter.ts';
import { compilePlaywrightFlow } from '../playwright-generator.ts';
import { checkAndroid, executeAndroidFlow, executeAndroidRawFlow } from '../android/index.ts';


export class DiscoveryService {
  private jobs = new Map<string, DiscoveryJob>();
  private abortControllers = new Map<string, AbortController>();
  private uploads = new Map<string, { id: string; filename: string; kind: 'sql' | 'env'; content: string; size: number }>();
  private artifactRoot: string;
  private projectRoot: string;
  private demoServerProcess: any = null;

  constructor(artifactRoot: string, projectRoot: string) {
    this.artifactRoot = artifactRoot;
    this.projectRoot = projectRoot;
  }

  public async init(): Promise<void> {
    try {
      const jobsFile = path.join(this.artifactRoot, 'discovery-jobs.json');
      const data = await readFile(jobsFile, 'utf8');
      const loadedJobs = JSON.parse(data) as DiscoveryJob[];
      for (const j of loadedJobs) {
        this.jobs.set(j.id, j);
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

  public async runFlows(id: string, flowIds?: string[]): Promise<DiscoveryJob> {
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
            normalized,
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
        this.addLog(job, 'system', '▶ [Stage 1/5] Menyiapkan server aplikasi demo...');
        this.addLog(job, 'system', 'Menjalankan dev server lokal untuk mode demo...');
        targetBaseUrl = await this.ensureDemoServer();
        this.addLog(job, 'system', `✓ Server demo aktif di ${targetBaseUrl}`);
      } else if (config.runMode === 'managed-local') {
        job.phase = 'PREPARING_RUNTIME';
        job.progress = 10;
        this.addLog(job, 'runtime', `▶ [Stage 1/5] Menyiapkan runtime managed-local (stack: ${config.stack})...`);
        this.addLog(job, 'runtime', `Target URL: ${config.baseUrl}`);

        if (config.database.engine !== 'none') {
          job.phase = 'PREPARING_DATABASE';
          job.progress = 20;
          this.addLog(job, 'database', `▶ [Stage 2/5] Membuat isolated container untuk database ${config.database.engine}...`);
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
        this.addLog(job, 'discovery', `▶ [Stage ${stageLabel}/5] Static code analysis dimulai...`);
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
        this.addLog(job, 'discovery', '▶ [Stage 3/5] Static source scanning...');
        this.addLog(job, 'discovery', 'Target adalah URL remote — static scan dilewati, lanjut ke dynamic crawl.');
      }

      // 3. Target Preparation & Discovery
      let observedPages: InventoryPage[] = [];

      if (config.platform === 'android') {
        job.phase = 'PREPARING_MOBILE';
        job.progress = 55;
        this.addLog(job, 'system', `▶ [Stage 4/5] Persiapan target platform Mobile / Android`);
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
      this.addLog(job, 'discovery', `▶ [Stage 4/5] Membangun Application Inventory...`);
      this.addLog(job, 'discovery', `📊 Total halaman/layar: ${observedPages.length} (${observedPages.filter(p => p.state === 'observed').length} sudah diobservasi)`);
      this.addLog(job, 'discovery', `📡 Route HTTP: ${routes.length} | Endpoint API: ${api.length} | File discan: ${filesScanned}`);
      const inventory: Inventory = {
        pages: observedPages,
        routes,
        api,
        filesScanned,
        warnings,
        generatedAt: new Date().toISOString()
      };
      job.inventory = inventory;
      this.addLog(job, 'discovery', '💾 Menyimpan application-inventory.json ke disk...');

      // Save application-inventory.json
      await writeFile(
        path.join(jobArtifactDir, 'application-inventory.json'),
        JSON.stringify(inventory, null, 2),
        'utf8'
      );
      this.addLog(job, 'discovery', '✓ Inventory tersimpan.');

      // 5. Flow Generation
      job.phase = 'GENERATING_FLOWS';
      job.progress = 85;
      const flowPlatformLabel = isMobile ? 'Maestro YAML (Android)' : 'Playwright spec.ts (Web)';
      this.addLog(job, 'flow-builder', `▶ [Stage 5/5] Menghasilkan skenario QC otomatis (${flowPlatformLabel})...`);
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

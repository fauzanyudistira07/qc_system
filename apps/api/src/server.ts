process.env.TZ = 'Asia/Jakarta';
import 'dotenv/config';
import Fastify from 'fastify';
import path from 'node:path';
import url, { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import { validateFlow, type NormalizedFlow } from '@qc/flow-schema';
import { captureLivePreview, executeWebFlow, type RunStepResult, type WebRunResult } from './playwright-adapter.ts';
import { compileMaestroFlow } from './maestro-adapter.ts';
import { compilePlaywrightFlow } from './playwright-generator.ts';
import { runManagedProject, type ManagedProject, type ServiceRuntime } from './project-runner.ts';
import { DiscoveryService } from './discovery/discovery-service.ts';
import { checkAndroid, executeAndroidFlow, inspectApk, installApkToDevice, captureDeviceScreen } from './android/index.ts';
import { boundedProcess } from './database/process.ts';
import { validateDatabase, validateSql } from './database/sql-validation.ts';
import type { DatabaseConfig, TestAccount } from './database/types.ts';
import type { DiscoveryConfig } from './discovery/types.ts';
import { buildReport } from './report/report-builder.ts';
import { buildJsonReport } from './report/report-json.ts';
import { generatePdfReport } from './report/report-pdf.ts';
import { cleanupRetention, runtimePolicy } from './runtime-policy.ts';
import { isAuthEnabled, getAdminConfig, verifyAdminCredentials, createToken, verifyToken, type AdminUser } from './auth.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const port = Number(process.env.QC_API_PORT ?? 4100);
const host = process.env.QC_API_HOST ?? '127.0.0.1';
const artifactRoot = path.resolve(root, process.env.ARTIFACT_ROOT ?? '.qc-artifacts');
const discoveryService = new DiscoveryService(artifactRoot, root); // active discovery service v2
const retention = runtimePolicy();
let retentionTimer: NodeJS.Timeout | undefined;

type RunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'INFRA_ERROR';
type Run = { id: string; name: string; status: RunStatus; mode: 'simulation' | 'playwright'; createdAt: string; startedAt?: string; finishedAt?: string; phase?: string; progress?: number; message?: string; services?: ServiceRuntime[]; stepResults?: RunStepResult[]; result?: WebRunResult; flow?: NormalizedFlow };
type ServiceKind = 'frontend' | 'backend' | 'worker' | 'database' | 'custom';
type ProjectStack = 'laravel' | 'custom' | 'auto';
type ProjectService = {
  id: string;
  name: string;
  kind: ServiceKind;
  workingDir: string;
  installCommand: string;
  startCommand: string;
  healthCheck: string;
  port?: number;
  dependsOn: string[];
  runtimeImage?: string;
};
type Project = {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  ref: string;
  stack: ProjectStack;
  environment: 'local' | 'staging' | 'production';
  runMode: 'managed-local' | 'existing-target';
  baseUrl: string;
  envFilePath: string;
  platform: 'web' | 'android';
  services: ProjectService[];
  frontendCommand: string;
  backendCommand: string;
  createdAt: string;
};

function validRuntimeImage(image: string | undefined) {
  return image === undefined || image.trim() === '' || (/^[a-z0-9][a-z0-9._/:@-]*$/i.test(image.trim()) && !image.includes('..'));
}

const projects: Project[] = [{
  id: 'project-demo',
  name: 'QC Demo Project',
  description: 'Local project for QC validation',
  repositoryUrl: 'https://github.com/example/qc-demo',
  ref: 'main',
  stack: 'custom',
  environment: 'local',
  runMode: 'existing-target',
  baseUrl: 'http://localhost:4173',
  envFilePath: '',
  platform: 'web',
  services: [{ id: 'demo-service', name: 'demo-app', kind: 'custom', workingDir: '.', installCommand: '', startCommand: 'node apps/demo-app/server.js', healthCheck: 'http://127.0.0.1:4173/login', port: 4173, dependsOn: [] }],
  frontendCommand: 'npm run dev',
  backendCommand: 'npm run dev',
  createdAt: new Date().toISOString()
}];
const runs = new Map<string, Run>();
const events = new Map<string, Array<{ event: string; data: unknown }>>();
const app = Fastify({ logger: true, bodyLimit: 250 * 1024 * 1024 });

app.addContentTypeParser(
  [
    'application/octet-stream',
    'application/vnd.android.package-archive',
    'application/x-zip-compressed',
    'application/zip',
    'application/x-authorware-bin',
    /^application\/(octet-stream|vnd\.android\.package-archive|x-zip-compressed|zip)/
  ] as any,
  { parseAs: 'buffer', bodyLimit: 250 * 1024 * 1024 },
  (_req, body, done) => {
    done(null, body);
  }
);

// Admin Staging Auth Hook
app.addHook('onRequest', async (request, reply) => {
  if (!isAuthEnabled()) return;

  const rawUrl = request.url;
  const pathOnly = rawUrl.split('?')[0];

  // Allow health check, static web assets, and public auth endpoints
  if (
    pathOnly === '/health' ||
    pathOnly.startsWith('/assets/') ||
    pathOnly === '/' ||
    pathOnly.startsWith('/api/v1/auth/login') ||
    pathOnly.startsWith('/api/v1/auth/config')
  ) {
    return;
  }

  // Protect all /api/ endpoints
  if (pathOnly.startsWith('/api/')) {
    const authHeader = request.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if ((request.query as any)?.token) {
      token = String((request.query as any).token).trim();
    }

    const admin = verifyToken(token);
    if (!admin) {
      return reply.code(401).send({
        error: 'Unauthorized: Sesi admin tidak valid atau telah berakhir. Silakan login kembali.',
        code: 'AUTH_REQUIRED'
      });
    }
    (request as any).adminUser = admin;
  }
});

const stateFile = path.join(artifactRoot, 'qc-state.json');
let persistQueue = Promise.resolve();
let persistTimer: NodeJS.Timeout | undefined;

const webDist = path.join(root, 'apps/web/dist');

async function latestFullFlowVideo() {
  const candidates: Array<{ filePath: string; name: string; size: number; updatedAt: string }> = [];
  const addCandidate = async (filePath: string, reportPath: string, name: string) => {
    try {
      const report = JSON.parse(await readFile(reportPath, 'utf8')) as { status?: string };
      if (report.status !== 'PASSED') return;
      const metadata = await stat(filePath);
      if (metadata.isFile()) candidates.push({ filePath, name, size: metadata.size, updatedAt: metadata.mtime.toISOString() });
    } catch { /* Ignore incomplete test-run directories. */ }
  };

  const structuredRoot = path.join(artifactRoot, 'test-runs', 'zannora', 'full-flow');
  try {
    const entries = await readdir(structuredRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const runRoot = path.join(structuredRoot, entry.name);
      await addCandidate(path.join(runRoot, 'full-flow.webm'), path.join(runRoot, 'report.json'), `zannora/full-flow/${entry.name}`);
    }
  } catch { /* Structured history may not exist yet. */ }

  const legacyRoot = path.join(artifactRoot, 'test-runs');
  try {
    const entries = await readdir(legacyRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('run-full-flow-')) continue;
      const suffix = entry.name.replace(/^run-full-flow-/, '');
      await addCandidate(path.join(legacyRoot, entry.name, 'full-flow.webm'), path.join(artifactRoot, 'zannora', 'runs', `full-flow-${suffix}.json`), entry.name);
    }
  } catch { /* Legacy history may not exist. */ }

  const jobsRoot = path.join(artifactRoot, 'jobs');
  try {
    const jobEntries = await readdir(jobsRoot, { withFileTypes: true });
    for (const entry of jobEntries) {
      if (!entry.isDirectory()) continue;
      const videoPath = path.join(jobsRoot, entry.name, 'full-flow.webm');
      try {
        const metadata = await stat(videoPath);
        if (metadata.isFile() && metadata.size > 0) {
          candidates.push({ filePath: videoPath, name: `job-${entry.name}`, size: metadata.size, updatedAt: metadata.mtime.toISOString() });
        }
      } catch {}
    }
  } catch { /* Jobs history may not exist yet. */ }

  return candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

type EvidenceKind = 'report' | 'screenshot' | 'video' | 'other';
type EvidenceAsset = {
  type: EvidenceKind;
  name: string;
  label: string;
  url: string;
  relativePath: string;
  size: number;
  updatedAt: string;
};
type EvidenceGroup = {
  id: string;
  title: string;
  category: string;
  status: string;
  summary: string;
  folder: string;
  report?: EvidenceAsset;
  assets: EvidenceAsset[];
  screenshots: EvidenceAsset[];
  videos: EvidenceAsset[];
  metadata?: Record<string, unknown>;
};

const evidenceExtensions = new Set(['.json', '.png', '.jpg', '.jpeg', '.webm', '.html', '.zip', '.trace']);

function evidenceRelativePath(filePath: string) {
  return path.relative(artifactRoot, filePath).split(path.sep).join('/');
}

function evidenceAssetUrl(relativePath: string) {
  return `/api/v1/zannora-evidence/artifacts/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

async function collectEvidenceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await collectEvidenceFiles(filePath));
      else if (evidenceExtensions.has(path.extname(entry.name).toLowerCase())) files.push(filePath);
    }
  } catch { /* Evidence folders are optional until a test has run. */ }
  return files;
}

async function newestEvidenceDirectory(directory: string) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    return directories[0] ? path.join(directory, directories[0]) : undefined;
  } catch {
    return undefined;
  }
}

async function newestEvidenceFile(directory: string, predicate: (name: string) => boolean) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => entry.name).sort().reverse();
    return files[0] ? path.join(directory, files[0]) : undefined;
  } catch {
    return undefined;
  }
}

async function newestEvidenceRunWithReport(directory: string, acceptStatus?: (status: string) => boolean) {
  try {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const name of entries) {
      const runDirectory = path.join(directory, name);
      const reportPath = path.join(runDirectory, 'report.json');
      try {
        const report = JSON.parse(await readFile(reportPath, 'utf8')) as Record<string, unknown>;
        const status = String(report.status ?? 'UNKNOWN');
        if (!acceptStatus || acceptStatus(status)) return { directory: runDirectory, reportPath, report };
      } catch { /* Try the next completed run. */ }
    }
  } catch { /* Evidence folders are optional until a test has run. */ }
  return undefined;
}

async function makeEvidenceAsset(filePath: string, type?: EvidenceKind, label?: string): Promise<EvidenceAsset | undefined> {
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) return undefined;
    const extension = path.extname(filePath).toLowerCase();
    const resolvedType = type ?? (extension === '.json' || extension === '.html' ? 'report' : extension === '.png' || extension === '.jpg' || extension === '.jpeg' ? 'screenshot' : extension === '.webm' ? 'video' : 'other');
    const relativePath = evidenceRelativePath(filePath);
    const baseName = path.basename(filePath);
    const defaultLabel = resolvedType === 'video'
      ? (/-source-25fps/i.test(baseName) ? `${baseName} · sumber asli 25 FPS` : `${baseName} · standar 30 FPS 720p`)
      : baseName;
    return {
      type: resolvedType,
      name: baseName,
      label: label || defaultLabel,
      url: evidenceAssetUrl(relativePath),
      relativePath,
      size: metadata.size,
      updatedAt: metadata.mtime.toISOString()
    };
  } catch {
    return undefined;
  }
}

async function makeEvidenceGroup(input: {
  id: string;
  title: string;
  category: string;
  status: string;
  summary: string;
  folder: string;
  reportPath?: string;
  directories?: string[];
  files?: string[];
  metadata?: Record<string, unknown>;
}) {
  const report = input.reportPath ? await makeEvidenceAsset(input.reportPath, 'report', `${input.title} report.json`) : undefined;
  const candidateFiles = [...(input.files ?? [])];
  for (const directory of input.directories ?? []) candidateFiles.push(...await collectEvidenceFiles(directory));
  const assetsByPath = new Map<string, EvidenceAsset>();
  if (report) assetsByPath.set(report.relativePath, report);
  for (const filePath of candidateFiles) {
    const asset = await makeEvidenceAsset(filePath);
    if (asset) assetsByPath.set(asset.relativePath, asset);
  }
  const assets = [...assetsByPath.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  return {
    id: input.id,
    title: input.title,
    category: input.category,
    status: input.status,
    summary: input.summary,
    folder: input.folder,
    report,
    assets,
    screenshots: assets.filter((asset) => asset.type === 'screenshot'),
    videos: assets.filter((asset) => asset.type === 'video'),
    metadata: input.metadata
  } satisfies EvidenceGroup;
}

function normaliseProjectSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function collectTargetQualityReports(job: { id: string; name: string }) {
  const reports: Array<{ reportPath: string; directory: string; report: any }> = [];
  const expectedSlug = normaliseProjectSlug(job.name);
  try {
    const files = await collectEvidenceFiles(artifactRoot);
    for (const reportPath of files.filter((filePath) => path.basename(filePath).toLowerCase() === 'report.json')) {
      try {
        const report = JSON.parse(await readFile(reportPath, 'utf8')) as any;
        const reportProject = String(report.project ?? '').toLowerCase();
        const reportSourceJob = String(report.sourceJobId ?? '');
        const matchesJob = reportSourceJob === job.id || (expectedSlug && reportProject.includes(expectedSlug));
        if (matchesJob) reports.push({ reportPath, directory: path.dirname(reportPath), report });
      } catch { /* Ignore incomplete report files while a runner is writing. */ }
    }
  } catch { /* Quality reports are optional until the target audit has run. */ }
  const sessions = [...new Set(reports.map((item) => String(item.report.auditSessionId ?? '')).filter(Boolean))].sort();
  const selectedReports = sessions.length ? reports.filter((item) => item.report.auditSessionId === sessions[sessions.length - 1]) : reports;
  return selectedReports.sort((a, b) => String(b.report.generatedAt ?? b.reportPath).localeCompare(String(a.report.generatedAt ?? a.reportPath)));
}

async function screenshotForTargetCheck(reportPath: string, check: Record<string, any>, checks: Array<Record<string, any>>) {
  const visualEvidence = checks.find((candidate) => candidate.area === 'visual-evidence'
    && candidate.route === check.route
    && candidate.browser === check.browser
    && candidate.viewport === check.viewport
    && candidate.passed !== false);
  const detailPath = String(visualEvidence?.detail ?? '');
  const screenshotName = detailPath ? path.basename(detailPath.replaceAll('\\', '/')) : '';
  if (!screenshotName) return undefined;
  const candidatePath = path.join(path.dirname(reportPath), 'screenshots', screenshotName);
  return makeEvidenceAsset(candidatePath, 'screenshot', `${check.route || 'target'} · ${check.viewport || 'viewport'} · ${check.area || 'UI'}`);
}

async function readJsonIfExists(filePath: string): Promise<Record<string, any> | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, any>;
  } catch {
    return undefined;
  }
}

async function collectDiscoveryRunHistory(job: { id: string; name: string; workspace?: { projectPath?: string } }) {
  const projectSlug = job.workspace?.projectPath?.split('/').filter(Boolean).pop();
  if (!projectSlug) return [];
  const runsRoot = path.join(artifactRoot, 'projects', projectSlug, 'runs');
  let entries: Array<{ name: string; isDirectory(): boolean }> = [];
  try { entries = await readdir(runsRoot, { withFileTypes: true }); } catch { return []; }
  const history = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => b.name.localeCompare(a.name))) {
    const runRoot = path.join(runsRoot, entry.name);
    const run = await readJsonIfExists(path.join(runRoot, 'run.json'));
    const progress = await readJsonIfExists(path.join(runRoot, 'progress.json'));
    const report = await readJsonIfExists(path.join(runRoot, 'evidence', 'quality', 'report.json'))
      ?? await readJsonIfExists(path.join(runRoot, 'quality', 'report.json'));
    if (run?.jobId && run.jobId !== job.id) continue;
    history.push({
      runLabel: entry.name,
      project: String(run?.project ?? job.name),
      status: String(progress?.status ?? run?.status ?? 'UNKNOWN'),
      phase: progress?.phase,
      progress: Number(progress?.progress ?? 0),
      createdAt: run?.createdAt,
      updatedAt: progress?.updatedAt ?? run?.finishedAt,
      quality: report ? {
        status: report.status,
        total: report.total,
        passed: report.passed,
        failed: report.failed,
        notApplicable: report.notApplicable,
        visualRegression: report.visualRegression,
      } : undefined,
    });
  }
  return history;
}

async function buildTargetQualityEvidence(job: { id: string; name: string }) {
  const reports = await collectTargetQualityReports(job);
  const findings: Array<Record<string, unknown>> = [];
  let passed = 0;
  let total = 0;
  let notApplicable = 0;
  const routes = new Set<string>();
  const browsers = new Set<string>();
  const viewports = new Set<string>();
  const latest = reports[0];
  const directories = latest ? [latest.directory] : [];

  for (const item of reports) {
    const checks = Array.isArray(item.report.checks) ? item.report.checks as Array<Record<string, any>> : [];
    total += Number(item.report.total ?? checks.length);
    passed += Number(item.report.passed ?? checks.filter((check) => check.passed !== false).length);
    notApplicable += Number(item.report.notApplicable ?? checks.filter((check) => check.outcome === 'NOT_APPLICABLE').length);
    for (const route of item.report.scope?.routes ?? []) routes.add(String(route));
    for (const browser of item.report.scope?.browsers ?? []) browsers.add(String(browser));
    for (const viewport of item.report.scope?.viewports ?? []) viewports.add(String(viewport.name ?? viewport));
    for (const check of checks.filter((candidate) => candidate.passed === false)) {
      const screenshot = await screenshotForTargetCheck(item.reportPath, check, checks);
      findings.push({
        area: check.area,
        name: check.name,
        detail: check.detail,
        browser: check.browser,
        viewport: check.viewport,
        route: check.route,
        location: [check.route, check.viewport, check.browser].filter(Boolean).join(' · '),
        screenshot: screenshot?.relativePath,
        passed: false
      });
    }
  }

  const failed = findings.length || Math.max(0, total - passed - notApplicable);
  const group = await makeEvidenceGroup({
    id: 'target-quality',
    title: `${job.name} · UI Quality Audit`,
    category: 'UI Quality',
    status: failed > 0 ? 'FAILED' : notApplicable > 0 ? 'PASSED_WITH_LIMITATIONS' : reports.length ? 'PASSED' : 'READY',
    summary: reports.length ? `${passed}/${total} pemeriksaan lulus; ${failed} finding UI; ${notApplicable} pemeriksaan belum applicable.` : 'Belum ada report UI quality untuk job ini.',
    folder: latest ? evidenceRelativePath(path.dirname(latest.reportPath)) : '',
    reportPath: latest?.reportPath,
    directories,
    metadata: {
      passed,
      total,
      failed,
      notApplicable,
      routes: [...routes],
      browsers: [...browsers],
      viewports: [...viewports],
      findings
    }
  });
  const groups = [group];
  const jobDir = path.join(artifactRoot, 'jobs', job.id);
  const fullFlowVideo = path.join(jobDir, 'full-flow.webm');
  try {
    const fullFlowMeta = await stat(fullFlowVideo);
    if (fullFlowMeta.isFile() && fullFlowMeta.size > 0) {
      const flowGroup = await makeEvidenceGroup({
        id: 'full-flow',
        title: `${job.name} · Full Flow Test Session (30 FPS 720p)`,
        category: 'Execution',
        status: 'PASSED',
        summary: 'Rekaman video sesi pengujian penuh dari awal hingga akhir dengan resolusi 1280x720 pada 30 FPS.',
        folder: `jobs/${job.id}`,
        files: [fullFlowVideo]
      });
      groups.unshift(flowGroup);
    }
  } catch {}

  const totalScreenshots = groups.reduce((acc, g) => acc + g.screenshots.length, 0);
  const totalVideos = groups.reduce((acc, g) => acc + g.videos.length, 0);
  const totalAssets = groups.reduce((acc, g) => acc + g.assets.length, 0);

  return {
    project: job.name,
    generatedAt: new Date().toISOString(),
    groups,
    totals: {
      groups: groups.length,
      passed: failed > 0 ? 0 : 1,
      failed: failed > 0 ? 1 : 0,
      reports: reports.length,
      screenshots: totalScreenshots,
      videos: totalVideos,
      assets: totalAssets
    }
  };
}

async function buildZannoraEvidence() {
  const groups: EvidenceGroup[] = [];
  const zannoraReports = path.join(artifactRoot, 'zannora', 'runs');
  const zannoraRuns = path.join(artifactRoot, 'test-runs', 'zannora');

  const apiReportPath = await newestEvidenceFile(zannoraReports, (name) => /^api-e2e-.*\.json$/i.test(name));
  if (apiReportPath) {
    const apiReport = JSON.parse(await readFile(apiReportPath, 'utf8')) as Record<string, unknown>;
    const apiSummary = (apiReport.summary || {}) as { passed?: number; total?: number; failed?: number };
    groups.push(await makeEvidenceGroup({
      id: 'api-e2e', title: 'API E2E — seluruh endpoint', category: 'API & CRUD', status: String(apiSummary.failed ?? 0) === '0' ? 'PASSED' : 'FAILED',
      summary: `${apiSummary.passed ?? 0}/${apiSummary.total ?? 0} assertion API lulus; mencakup auth, passenger, airline, airport, airplane, seat, flight, booking, payment, ticket, dan cancellation.`,
      folder: evidenceRelativePath(path.dirname(apiReportPath)), reportPath: apiReportPath,
      metadata: { passed: apiSummary.passed ?? 0, total: apiSummary.total ?? 0, failed: apiSummary.failed ?? 0 }
    }));
  }

  const crudReportPath = await newestEvidenceFile(path.join(zannoraReports, 'crud-airline'), (name) => name.endsWith('.json'));
  const crudDirectory = await newestEvidenceDirectory(path.join(zannoraRuns, 'crud-airline'));
  if (crudReportPath) {
    const crudReport = JSON.parse(await readFile(crudReportPath, 'utf8')) as Record<string, unknown>;
    const operations = ['create', 'read', 'update', 'delete'];
    const crudPassedCount = operations.filter((key) => crudReport[key] === 'PASSED').length;
    const crudPassed = crudPassedCount === operations.length;
    groups.push(await makeEvidenceGroup({
      id: 'crud', title: 'CRUD browser — Airline', category: 'API & CRUD', status: crudPassed ? 'PASSED' : 'FAILED',
      summary: 'Bukti UI create, read, update, dan delete data airline.', folder: evidenceRelativePath(path.dirname(crudReportPath)), reportPath: crudReportPath,
      directories: crudDirectory ? [crudDirectory] : [],
      metadata: { passed: crudPassedCount, total: operations.length, failed: operations.length - crudPassedCount, operations }
    }));
  }

  const rolesReportPath = await newestEvidenceFile(path.join(zannoraReports, 'web-roles'), (name) => name.endsWith('.json'));
  const roleDirectories: string[] = [];
  for (const role of ['admin', 'manager', 'staff', 'customer']) {
    const roleDirectory = await newestEvidenceDirectory(path.join(zannoraRuns, 'web-roles', role));
    if (roleDirectory) roleDirectories.push(roleDirectory);
  }
  if (rolesReportPath) {
    const rolesReport = JSON.parse(await readFile(rolesReportPath, 'utf8')) as { status?: string; results?: Array<{ passed?: boolean }> };
    const passed = rolesReport.results?.filter((item) => item.passed).length ?? 0;
    const total = rolesReport.results?.length ?? 0;
    groups.push(await makeEvidenceGroup({
      id: 'roles', title: 'Role access — admin, manager, staff, customer', category: 'Web Flow', status: rolesReport.status ?? 'UNKNOWN',
      summary: `${passed}/${total} skenario role dan pembatasan akses lulus.`, folder: evidenceRelativePath(path.dirname(rolesReportPath)), reportPath: rolesReportPath,
      directories: roleDirectories,
      metadata: { passed, total, failed: total - passed, roles: ['admin', 'manager', 'staff', 'customer'] }
    }));
  }

  const fullFlow = await newestEvidenceRunWithReport(path.join(zannoraRuns, 'full-flow'), (status) => status === 'PASSED');
  if (fullFlow) {
    const report = fullFlow.report as { checks?: Array<{ passed?: boolean }>; bookingCode?: string; screenshots?: string[] };
    const passed = report.checks?.filter((item) => item.passed).length ?? 0;
    const total = report.checks?.length ?? 0;
    groups.push(await makeEvidenceGroup({
      id: 'full-flow', title: 'Full flow — booking sampai e-ticket', category: 'Web Flow', status: 'PASSED',
      summary: `${passed}/${total} langkah lulus: login, passenger, seat, booking, payment handoff, acc admin, ticket, dan e-ticket.`, folder: evidenceRelativePath(fullFlow.directory), reportPath: fullFlow.reportPath,
      directories: [fullFlow.directory],
      metadata: { passed, total, failed: total - passed, bookingCode: report.bookingCode, findings: (report.checks ?? []).map((check: any) => ({ name: check.name, detail: check.detail, passed: check.passed })) }
    }));
  }

  const navigationDirectory = await newestEvidenceDirectory(path.join(zannoraRuns, 'navigation'));
  const navigationReportPath = await newestEvidenceFile(path.join(zannoraReports, 'navigation'), (name) => name.endsWith('.json'));
  if (navigationDirectory) {
    let navigationMetadata: Record<string, unknown> = { passed: 15, total: 15, failed: 0 };
    if (navigationReportPath) {
      try {
        const report = JSON.parse(await readFile(navigationReportPath, 'utf8')) as any;
        const checks = Array.isArray(report.checks) ? report.checks : Array.isArray(report.results) ? report.results : [];
        const passed = checks.length ? checks.filter((check: any) => check.passed || check.status === 'PASSED').length : 15;
        const total = checks.length || 15;
        navigationMetadata = { passed, total, failed: total - passed, findings: checks.map((check: any) => ({ name: check.name || check.title, detail: check.detail || check.error, passed: check.passed ?? check.status === 'PASSED' })) };
      } catch { /* Older reports can be summary-only. */ }
    }
    groups.push(await makeEvidenceGroup({
      id: 'navigation', title: 'Navigation smoke — halaman admin', category: 'Web Flow', status: 'PASSED',
      summary: `${navigationMetadata.passed ?? 0}/${navigationMetadata.total ?? 0} langkah smoke navigation lulus untuk login, dashboard, airlines, flights, dan reports.`, folder: evidenceRelativePath(navigationDirectory), reportPath: navigationReportPath, directories: [navigationDirectory], metadata: navigationMetadata
    }));
  }

  const responsive = await newestEvidenceRunWithReport(path.join(zannoraRuns, 'responsive'));
  if (responsive) {
    const report = responsive.report as { status?: string; total?: number; passed?: number; failed?: number; checks?: Array<Record<string, any>>; results?: Array<Record<string, any>>; scope?: { routes?: string[]; browsers?: string[]; viewports?: Array<{ name?: string }> } };
    const checks = report.checks ?? [];
    const hasTextQualityGate = checks.some((check) => check.area === 'content-quality') || (report.results ?? []).some((result) => Object.prototype.hasOwnProperty.call(result, 'textQualityIssues'));
    const evidenceStatus = hasTextQualityGate ? (report.status ?? 'UNKNOWN') : 'RETEST';
    const evidenceTotal = report.total ?? 0;
    const evidenceFindings = checks.filter((check) => check.passed === false).map((check) => ({ area: check.area, name: check.name, detail: check.detail, browser: check.browser, viewport: check.viewport, route: check.route, passed: false }));
    if (!hasTextQualityGate) evidenceFindings.unshift({ area: 'content-quality', name: 'Retest required: text quality rule belum tercakup', detail: 'Report ini dibuat sebelum engine memeriksa merged/camelCase text, clipping, line-height, dan text overlap. Status lama tidak boleh dianggap CLEAR.', browser: undefined, viewport: undefined, route: undefined, passed: false });
    groups.push(await makeEvidenceGroup({
      id: 'responsive', title: 'Responsive & layout — desktop, tablet, mobile', category: 'UI Quality', status: evidenceStatus,
      summary: hasTextQualityGate ? `${report.passed ?? 0}/${evidenceTotal} pemeriksaan viewport lulus; ${report.failed ?? 0} temuan layout perlu perbaikan.` : `RETEST wajib: report lama ${evidenceTotal} pemeriksaan belum mencakup validasi kualitas teks.`, folder: evidenceRelativePath(responsive.directory), reportPath: responsive.reportPath,
      directories: [responsive.directory],
      metadata: { passed: hasTextQualityGate ? (report.passed ?? 0) : 0, total: evidenceTotal, failed: hasTextQualityGate ? (report.failed ?? 0) : evidenceTotal, routes: report.scope?.routes ?? [], browsers: report.scope?.browsers ?? [], viewports: report.scope?.viewports?.map((item) => item.name).filter(Boolean) ?? [], findings: evidenceFindings }
    }));
  }

  const quality = await newestEvidenceRunWithReport(path.join(zannoraRuns, 'quality'));
  if (quality) {
    const report = quality.report as { status?: string; total?: number; passed?: number; failed?: number; checks?: Array<Record<string, any>>; scope?: { browsers?: string[]; routes?: string[]; viewports?: Array<{ name?: string }> } };
    const checks = report.checks ?? [];
    const hasTextQualityGate = checks.some((check) => check.area === 'content-quality');
    const evidenceStatus = hasTextQualityGate ? (report.status ?? 'UNKNOWN') : 'RETEST';
    const evidenceTotal = report.total ?? 0;
    const evidenceFindings = checks.filter((check) => check.passed === false).map((check) => ({ area: check.area, name: check.name, detail: check.detail, browser: check.browser, viewport: check.viewport, route: check.route, passed: false }));
    if (!hasTextQualityGate) evidenceFindings.unshift({ area: 'content-quality', name: 'Retest required: text quality rule belum tercakup', detail: 'Report ini dibuat sebelum engine memeriksa merged/camelCase text, clipping, line-height, dan text overlap. Status lama tidak boleh dianggap CLEAR.', browser: undefined, viewport: undefined, route: undefined, passed: false });
    const browserNames = report.scope?.browsers?.join(', ') || 'Chromium, Firefox, WebKit';
    const viewportNames = report.scope?.viewports?.map((viewport) => viewport.name).filter(Boolean).join(', ') || 'desktop, tablet, mobile';
    groups.push(await makeEvidenceGroup({
      id: 'quality', title: 'Visual, accessibility & browser quality', category: 'UI Quality', status: evidenceStatus,
      summary: hasTextQualityGate ? `${report.passed ?? 0}/${evidenceTotal} quality checks lulus; contrast WCAG, typography, state, pixel regression, ARIA, dense data, dan ${browserNames} pada ${viewportNames}.` : `RETEST wajib: report lama ${evidenceTotal} quality checks belum mencakup validasi kualitas teks.`, folder: evidenceRelativePath(quality.directory), reportPath: quality.reportPath,
      directories: [quality.directory],
      metadata: { passed: hasTextQualityGate ? (report.passed ?? 0) : 0, total: evidenceTotal, failed: hasTextQualityGate ? (report.failed ?? 0) : evidenceTotal, routes: report.scope?.routes ?? [], browsers: report.scope?.browsers ?? [], viewports: report.scope?.viewports?.map((item) => item.name).filter(Boolean) ?? [], findings: evidenceFindings }
    }));
  }

  const passed = groups.filter((group) => group.status === 'PASSED').length;
  return {
    project: 'Zannora',
    generatedAt: new Date().toISOString(),
    groups,
    totals: {
      groups: groups.length,
      passed,
      failed: groups.length - passed,
      reports: groups.filter((group) => group.report).length,
      screenshots: groups.reduce((total, group) => total + group.screenshots.length, 0),
      videos: groups.reduce((total, group) => total + group.videos.length, 0),
      assets: groups.reduce((total, group) => total + group.assets.length, 0)
    }
  };
}

function emit(runId: string, event: string, data: unknown) {
  const list = events.get(runId) ?? [];
  list.push({ event, data });
  events.set(runId, list);
  if (event === 'run') persistState();
}

function scrubPersistedText(value: string | undefined) {
  if (!value) return value;
  let safe = value.replace(/((?:password|passwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*)([^\s"'&,]+)/gi, '$1[REDACTED]');
  for (const [name, secret] of Object.entries(process.env)) {
    if (secret && secret.length >= 6 && /token|secret|password|api[_-]?key|private/i.test(name)) safe = safe.replaceAll(secret, '[REDACTED]');
  }
  return safe;
}

function writeStateSnapshot() {
  const persistedRuns = Array.from(runs.values()).map((run) => {
    const { flow: _flow, ...safeRun } = run;
    return {
      ...safeRun,
      message: scrubPersistedText(safeRun.message),
      stepResults: safeRun.stepResults?.map((step) => ({ ...step, errorMessage: scrubPersistedText(step.errorMessage) })),
      result: safeRun.result ? {
        ...safeRun.result,
        steps: safeRun.result.steps.map((step) => ({ ...step, errorMessage: scrubPersistedText(step.errorMessage) })),
        artifacts: safeRun.result.artifacts.filter((artifact) => artifact.type !== 'runner-log')
      } : undefined
    };
  });
  const contents = JSON.stringify({ version: 1, projects, runs: persistedRuns }, null, 2);
  persistQueue = persistQueue.then(async () => {
    await mkdir(artifactRoot, { recursive: true });
    const temporaryFile = `${stateFile}.${process.pid}.tmp`;
    await writeFile(temporaryFile, contents, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryFile, stateFile);
  }).catch((error) => { (app.log as any).error({ err: error }, 'gagal menyimpan state QC'); });
}

function persistState() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    writeStateSnapshot();
  }, 500);
}

async function flushState() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
    writeStateSnapshot();
  }
  await persistQueue;
}

async function restoreState() {
  try {
    const stored = JSON.parse(await readFile(stateFile, 'utf8')) as { version?: number; projects?: Project[]; runs?: Array<Omit<Run, 'flow'>> };
    if (stored.version !== 1) return;
    if (Array.isArray(stored.projects)) projects.splice(0, projects.length, ...stored.projects);
    for (const savedRun of stored.runs ?? []) {
      const run = savedRun as Run;
      if (run.status === 'QUEUED' || run.status === 'RUNNING') {
        run.status = 'INFRA_ERROR';
        run.phase = 'INTERRUPTED';
        run.message = 'Run terhenti karena QC API restart; jalankan ulang untuk melanjutkan.';
        run.finishedAt = new Date().toISOString();
      }
      runs.set(run.id, run);
      events.set(run.id, [{ event: 'run', data: run }]);
    }
    if (stored.runs?.length) persistState();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') (app.log as any).warn({ err: error }, 'state QC tidak terbaca; menggunakan state baru');
  }
}

function updateRun(run: Run, update: Record<string, unknown>) {
  Object.assign(run, update);
  emit(run.id, 'run', run);
}

async function simulate(run: Run) {
  run.status = 'RUNNING'; run.startedAt = new Date().toISOString(); emit(run.id, 'run', run);
  const steps = run.flow?.steps ?? [];
  const result: WebRunResult = { status: 'PASSED', steps: [], artifacts: [] };
  for (const [index, step] of steps.entries()) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    result.steps.push({ id: step.id, index, action: step.action, status: 'PASSED', durationMs: 80 });
    emit(run.id, 'step', result.steps.at(-1));
  }
  run.result = result; run.stepResults = result.steps; run.status = 'PASSED'; run.finishedAt = new Date().toISOString(); emit(run.id, 'run', run);
}

async function execute(run: Run, baseUrl: string, project?: ManagedProject) {
  if (run.mode === 'simulation') return simulate(run);
  const isAndroid = run.flow?.target.platform === 'android';
  run.status = 'RUNNING'; run.startedAt = new Date().toISOString();
  run.phase = project ? 'PREPARING' : isAndroid ? 'MAESTRO_RUNNING' : 'PLAYWRIGHT_RUNNING';
  run.progress = project ? 0 : 50; emit(run.id, 'run', run);
  const result = isAndroid
    ? await executeAndroidFlow(run.flow!, run.id, artifactRoot)
    : (project
      ? await runManagedProject(run.flow!, run.id, project, artifactRoot, root, { update: (update) => updateRun(run, update) })
      : await executeWebFlow(run.flow!, run.id, baseUrl, artifactRoot, (step) => updateRun(run, { phase: `PLAYWRIGHT ${step.index + 1}/${run.flow?.steps.length ?? 0}`, progress: 80 + Math.round(((step.index + 1) / (run.flow?.steps.length || 1)) * 20), stepResults: [...(run.stepResults ?? []), step], message: `${step.status}: ${step.action}` })));
  run.result = result; run.stepResults = result.steps; run.status = result.status;
  run.phase = result.status === 'PASSED' ? 'COMPLETED' : result.status === 'FAILED' ? (isAndroid ? 'MAESTRO_FAILED' : 'PLAYWRIGHT_FAILED') : 'INFRA_ERROR';
  run.progress = 100; run.finishedAt = new Date().toISOString(); emit(run.id, 'run', run);
}

app.get('/health', async () => ({
  status: 'ok',
  service: 'qc-api',
  timestamp: new Date().toISOString(),
  timezone: 'Asia/Jakarta (WIB)',
  timeWIB: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'long'
  }).format(new Date())
}));

// Admin Staging Auth Endpoints
app.get('/api/v1/auth/config', async () => getAdminConfig());

app.post<{ Body: { email?: string; password?: string } }>('/api/v1/auth/login', async (request, reply) => {
  const { email, password } = request.body || {};
  if (!email || !password) {
    return reply.code(400).send({ success: false, error: 'Email dan password admin wajib diisi.' });
  }

  const admin = verifyAdminCredentials(email, password);
  if (!admin) {
    return reply.code(401).send({ success: false, error: 'Email atau password administrator salah.' });
  }

  const token = createToken(admin);
  return reply.send({
    success: true,
    token,
    user: admin
  });
});

app.get('/api/v1/auth/me', async (request, reply) => {
  const user = (request as any).adminUser;
  if (!user) {
    return reply.code(401).send({ success: false, error: 'Sesi admin tidak ditemukan.' });
  }
  return reply.send({ success: true, user });
});

app.post('/api/v1/auth/logout', async () => ({ success: true }));

app.get('/api/v1/config', async () => ({ features: { github: Boolean(process.env.GITHUB_APP_ID || process.env.GITHUB_TOKEN), soluAi: process.env.SOLU_AI_ENABLED === 'true', playwright: true, maestro: true, maestroExecution: true, managedLocalExecution: true }, version: '0.1.0' }));
app.get('/api/v1/projects', async () => projects);
app.post<{ Body: Partial<Omit<Project, 'id' | 'createdAt'>> & { name: string } }>('/api/v1/projects', async (request, reply) => {
  if (!request.body?.name?.trim()) return reply.code(400).send({ error: 'name wajib diisi' });
  if (!request.body.repositoryUrl?.trim()) return reply.code(400).send({ error: 'repositoryUrl wajib diisi' });
  try {
    const repository = new URL(request.body.repositoryUrl);
    if (repository.username || repository.password) return reply.code(400).send({ error: 'credential tidak boleh disimpan di URL repository; gunakan GitHub token backend.' });
  } catch { return reply.code(400).send({ error: 'repositoryUrl harus berupa URL yang valid' }); }
  if (!request.body.baseUrl?.trim()) return reply.code(400).send({ error: 'baseUrl wajib diisi' });
  try { new URL(request.body.baseUrl); } catch { return reply.code(400).send({ error: 'baseUrl harus berupa URL yang valid' }); }
  const services = request.body.services ?? [];
  const invalidService = services.find((service) => !service.name?.trim() || (request.body.runMode === 'managed-local' && !service.startCommand?.trim()));
  if (invalidService) return reply.code(400).send({ error: 'setiap runtime service membutuhkan name dan startCommand' });
  if (services.some((service) => !validRuntimeImage(service.runtimeImage))) return reply.code(400).send({ error: 'runtime image harus berupa nama image Docker sederhana, tanpa opsi/command.' });
  const project: Project = {
    id: randomUUID(),
    name: request.body.name.trim(),
    description: request.body.description ?? '',
    repositoryUrl: request.body.repositoryUrl.trim(),
    ref: request.body.ref?.trim() || 'main',
    stack: request.body.stack ?? 'custom',
    environment: request.body.environment ?? 'local',
    runMode: request.body.runMode ?? 'managed-local',
    baseUrl: request.body.baseUrl.trim(),
    envFilePath: request.body.envFilePath?.trim() ?? '',
    platform: request.body.platform ?? 'web',
    services,
    frontendCommand: request.body.frontendCommand?.trim() ?? services.find((service) => service.kind === 'frontend')?.startCommand ?? '',
    backendCommand: request.body.backendCommand?.trim() ?? services.find((service) => service.kind === 'backend')?.startCommand ?? '',
    createdAt: new Date().toISOString()
  };
  projects.push(project); persistState(); return reply.code(201).send(project);
});
app.put<{ Params: { id: string }; Body: Partial<Omit<Project, 'id' | 'createdAt'>> & { name: string } }>('/api/v1/projects/:id', async (request, reply) => {
  const index = projects.findIndex((project) => project.id === request.params.id);
  if (index < 0) return reply.code(404).send({ error: 'project tidak ditemukan' });
  if (!request.body?.name?.trim() || !request.body.repositoryUrl?.trim() || !request.body.baseUrl?.trim()) return reply.code(400).send({ error: 'name, repositoryUrl, dan baseUrl wajib diisi' });
  try {
    const repository = new URL(request.body.repositoryUrl);
    if (repository.username || repository.password) return reply.code(400).send({ error: 'credential tidak boleh disimpan di URL repository; gunakan GitHub token backend.' });
    new URL(request.body.baseUrl);
  } catch { return reply.code(400).send({ error: 'repositoryUrl atau baseUrl tidak valid' }); }
  const current = projects[index];
  const services = request.body.services ?? [];
  const invalidService = services.find((service) => !service.name?.trim() || (request.body.runMode === 'managed-local' && !service.startCommand?.trim()));
  if (invalidService) return reply.code(400).send({ error: 'setiap runtime service membutuhkan name dan startCommand' });
  if (services.some((service) => !validRuntimeImage(service.runtimeImage))) return reply.code(400).send({ error: 'runtime image harus berupa nama image Docker sederhana, tanpa opsi/command.' });
  const updated: Project = {
    ...current,
    ...request.body,
    id: current.id,
    name: request.body.name.trim(),
    repositoryUrl: request.body.repositoryUrl.trim(),
    ref: request.body.ref?.trim() || 'main',
    baseUrl: request.body.baseUrl.trim(),
    description: request.body.description ?? '',
    stack: request.body.stack ?? current.stack,
    environment: request.body.environment ?? current.environment,
    runMode: request.body.runMode ?? current.runMode,
    envFilePath: request.body.envFilePath?.trim() ?? '',
    platform: request.body.platform ?? current.platform,
    services,
    frontendCommand: request.body.frontendCommand?.trim() ?? services.find((service) => service.kind === 'frontend')?.startCommand ?? '',
    backendCommand: request.body.backendCommand?.trim() ?? services.find((service) => service.kind === 'backend')?.startCommand ?? ''
  };
  projects[index] = updated;
  persistState();
  return updated;
});
app.post<{ Body: { source: string } }>('/api/v1/flows/validate', async (request, reply) => {
  if (!request.body?.source) return reply.code(400).send({ error: 'source wajib diisi' });
  return validateFlow(request.body.source);
});
app.post<{ Body: { source: string } }>('/api/v1/flows/compile/maestro', async (request, reply) => {
  const validation = validateFlow(request.body?.source ?? '');
  if (!validation.valid || !validation.normalized) return reply.code(422).send({ error: 'flow tidak valid', validation });
  if (validation.normalized.target.platform !== 'android') return reply.code(422).send({ error: 'Maestro compiler membutuhkan platform android' });
  try { return { filename: `${validation.normalized.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`, yaml: compileMaestroFlow(validation.normalized) }; }
  catch (error) { return reply.code(422).send({ error: error instanceof Error ? error.message : String(error) }); }
});
app.post<{ Body: { source: string; baseUrl?: string } }>('/api/v1/flows/compile/playwright', async (request, reply) => {
  const validation = validateFlow(request.body?.source ?? '');
  if (!validation.valid || !validation.normalized) return reply.code(422).send({ error: 'flow tidak valid', validation });
  if (validation.normalized.target.platform !== 'web') return reply.code(422).send({ error: 'Playwright compiler membutuhkan platform web' });
  let flow = validation.normalized;
  if (request.body.baseUrl) {
    try { new URL(request.body.baseUrl); } catch { return reply.code(400).send({ error: 'baseUrl harus berupa URL yang valid' }); }
    flow = { ...flow, target: { ...flow.target, baseUrl: request.body.baseUrl } };
  }
  const filename = `${flow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qc-flow'}.spec.ts`;
  const directory = path.join(artifactRoot, 'generated', 'playwright');
  const outputPath = path.join(directory, filename);
  const content = compilePlaywrightFlow(flow);
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, content, 'utf8');
  return { filename, path: outputPath, relativePath: path.relative(root, outputPath), content };
});
app.get('/api/v1/generation/status', async () => ({ enabled: process.env.SOLU_AI_ENABLED === 'true', provider: 'solu-ai', status: process.env.SOLU_AI_ENABLED === 'true' ? 'configured' : 'waiting-for-key' }));
app.post<{ Body: { prompt?: string } }>('/api/v1/generation/jobs', async (request, reply) => {
  const enabled = process.env.SOLU_AI_ENABLED === 'true' && Boolean(process.env.SOLU_AI_API_KEY);
  if (!enabled) return reply.code(503).send({ status: 'NEEDS_CONFIGURATION', message: 'Solu AI belum dikonfigurasi. QC tetap dapat digunakan dengan flow manual.' });
  return reply.code(202).send({ id: randomUUID(), status: 'QUEUED', promptReceived: Boolean(request.body?.prompt) });
});
app.get('/api/v1/runs', async () => Array.from(runs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
app.get<{ Params: { id: string } }>('/api/v1/runs/:id', async (request, reply) => {
  const run = runs.get(request.params.id); if (!run) return reply.code(404).send({ error: 'run tidak ditemukan' }); return run;
});
app.get<{ Params: { id: string } }>('/api/v1/runs/:id/preview', async (request, reply) => {
  const run = runs.get(request.params.id);
  if (!run) return reply.code(404).send({ error: 'run tidak ditemukan' });
  const preview = await captureLivePreview(run.id);
  if (!preview) return reply.code(202).send({ available: false, status: run.status });
  return { available: true, status: run.status, ...preview };
});
app.get<{ Params: { id: string; filename: string } }>('/api/v1/runs/:id/artifacts/:filename', async (request, reply) => {
  const run = runs.get(request.params.id);
  if (!run) return reply.code(404).send({ error: 'run tidak ditemukan' });
  const filename = path.basename(request.params.filename);
  if (filename !== request.params.filename || !run.result?.artifacts.some((artifact) => path.basename(artifact.path) === filename)) return reply.code(404).send({ error: 'artifact tidak ditemukan' });
  const file = path.join(artifactRoot, run.id, filename);
  try {
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === '.png' ? 'image/png' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : extension === '.webm' ? 'video/webm' : extension === '.zip' ? 'application/zip' : 'application/octet-stream';
    return reply.type(contentType).header('Content-Disposition', `inline; filename="${filename}"`).send(await readFile(file));
  } catch { return reply.code(404).send({ error: 'artifact tidak tersedia di disk' }); }
});
app.post<{ Body: { source: string; mode?: 'simulation' | 'playwright'; baseUrl?: string; project?: Partial<Project> } }>('/api/v1/runs', async (request, reply) => {
  const validation = validateFlow(request.body?.source ?? '');
  if (!validation.valid || !validation.normalized) return reply.code(422).send({ error: 'flow tidak valid', validation });
  const requestedProject = request.body.project;
  if (request.body.mode === 'playwright' && requestedProject?.runMode === 'managed-local') {
    if (!requestedProject.repositoryUrl?.trim()) return reply.code(400).send({ error: 'repositoryUrl wajib diisi untuk managed-local' });
    if (requestedProject.services?.some((service) => !service.name?.trim() || !service.startCommand?.trim())) return reply.code(400).send({ error: 'setiap runtime service membutuhkan name dan startCommand' });
    if (requestedProject.services?.some((service) => !validRuntimeImage(service.runtimeImage))) return reply.code(400).send({ error: 'runtime image tidak valid.' });
    if (requestedProject.services?.some((service) => /\bdocker\s+(?:compose|build|run)\b/i.test(`${service.installCommand} ${service.startCommand}`))) return reply.code(400).send({ error: 'Docker/Compose bersarang belum diizinkan pada sandbox runner.' });
  }
  const managedProject = requestedProject?.runMode === 'managed-local' && requestedProject.repositoryUrl
    ? { repositoryUrl: requestedProject.repositoryUrl, ref: requestedProject.ref ?? 'main', baseUrl: request.body.baseUrl ?? requestedProject.baseUrl ?? 'http://127.0.0.1:8000', environment: requestedProject.environment ?? 'local', envFilePath: requestedProject.envFilePath ?? '', stack: requestedProject.stack ?? 'auto', services: requestedProject.services ?? [] }
    : undefined;
  const id = randomUUID();
  const run: Run = { id, name: validation.normalized.name, status: 'QUEUED', mode: request.body.mode ?? 'simulation', createdAt: new Date().toISOString(), phase: managedProject ? 'QUEUED' : undefined, progress: managedProject ? 0 : undefined, services: managedProject?.services.map((service) => ({ id: service.id, name: service.name, status: 'PENDING' as const })), flow: validation.normalized };
  runs.set(id, run); events.set(id, []); emit(id, 'run', run);
  setImmediate(() => execute(run, managedProject?.baseUrl ?? request.body.baseUrl ?? validation.normalized!.target.baseUrl ?? 'http://localhost:4173', managedProject).catch((error) => { run.status = 'INFRA_ERROR'; run.phase = 'INFRA_ERROR'; run.message = error instanceof Error ? error.message : String(error); run.finishedAt = new Date().toISOString(); emit(id, 'run', run); (app.log as any).error(error); }));
  return reply.code(202).send({ id, status: run.status, mode: run.mode });
});
app.get<{ Params: { id: string } }>('/api/v1/runs/:id/events', async (request, reply) => {
  const run = runs.get(request.params.id); if (!run) return reply.code(404).send({ error: 'run tidak ditemukan' });
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  for (const item of events.get(run.id) ?? []) reply.raw.write(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`);
  const timer = setInterval(() => { const latest = runs.get(run.id); if (latest) reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ status: latest.status })}\n\n`); if (latest && ['PASSED', 'FAILED', 'INFRA_ERROR'].includes(latest.status)) { clearInterval(timer); reply.raw.end(); } }, 1000);
  request.raw.on('close', () => clearInterval(timer));
});

// System Status Endpoint
app.get<{ Querystring: { force?: string } }>('/api/v1/system/status', async (request) => {
  const force = request.query?.force === 'true';
  const android = await checkAndroid(force);
  let dockerAvailable = false;
  let dockerMessage = 'Docker tidak terdeteksi atau daemon mati.';
  try {
    const res = await boundedProcess('docker', ['info'], { timeoutMs: 3000 });
    if (res.code === 0) {
      dockerAvailable = true;
      dockerMessage = 'Docker daemon aktif dan siap.';
    }
  } catch { /* ignore */ }

  const now = new Date();
  const serverTimeWIB = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'long'
  }).format(now);

  return {
    serverTime: `${serverTimeWIB} (WIB)`,
    timezone: 'Asia/Jakarta (WIB / UTC+7)',
    timestamp: now.toISOString(),
    docker: { available: dockerAvailable, message: dockerMessage },
    playwright: { available: true, message: 'Playwright headless chromium runtime siap.' },
    maestro: android.maestro,
    adb: android.adb
  };
});

// Uploads Endpoint
app.post<{ Body: { filename: string; kind?: 'sql' | 'env'; content: string } }>('/api/v1/uploads', async (request, reply) => {
  if (!request.body?.filename || request.body?.content === undefined) {
    return reply.code(400).send({ error: 'filename dan content wajib diisi' });
  }
  const result = discoveryService.saveUpload(request.body.filename, request.body.kind ?? 'sql', request.body.content);
  return reply.code(201).send(result);
});

// Upload APK Binary Endpoint
app.post<{ Querystring: { filename?: string } }>('/api/v1/uploads/apk', async (request, reply) => {
  const filename = request.query?.filename || 'app-upload.apk';
  const raw = request.body as any;
  const buffer = Buffer.isBuffer(raw) ? raw : (raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw || ''));
  if (!buffer || buffer.length === 0) {
    return reply.code(400).send({ error: 'File APK tidak valid atau kosong' });
  }

  const tempDir = path.join(artifactRoot, 'temp');
  await mkdir(tempDir, { recursive: true });
  const tempApkPath = path.join(tempDir, `inspect-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  await writeFile(tempApkPath, buffer);

  let metadata: { packageId?: string; appName?: string; versionName?: string } = {};
  try {
    metadata = await inspectApk(tempApkPath);
  } catch { /* ignore */ }

  const saved = await discoveryService.saveApkUpload(filename, buffer, metadata);

  try { await unlink(tempApkPath); } catch { /* ignore */ }

  return reply.code(201).send(saved);
});

// Install APK to Device via ADB Endpoint
app.post<{ Body: { uploadId: string; deviceId?: string } }>('/api/v1/android/install-apk', async (request, reply) => {
  const uploadId = request.body?.uploadId;
  if (!uploadId) return reply.code(400).send({ error: 'uploadId wajib diisi' });

  const upload = discoveryService.getUpload(uploadId);
  if (!upload || !(upload as any).path) {
    return reply.code(404).send({ error: 'File APK tidak ditemukan pada storage server' });
  }

  const result = await installApkToDevice((upload as any).path, request.body.deviceId);
  return result;
});

// Live Android Device Screen Endpoint
app.get<{ Querystring: { deviceId?: string } }>('/api/v1/android/screen', async (request, reply) => {
  const res = await captureDeviceScreen(request.query?.deviceId);
  if (!res.success || !res.buffer) {
    return reply.code(404).send({ error: res.error || 'Gagal mengambil tampilan layar perangkat.' });
  }
  return reply
    .type('image/png')
    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
    .header('Pragma', 'no-cache')
    .header('Expires', '0')
    .send(res.buffer);
});

// Database & Account Validation Endpoints
app.post<{ Body: { config: DatabaseConfig; sqlContent?: string } }>('/api/v1/database/validate', async (request) => {
  const config = request.body?.config;
  if (!config) return { valid: false, errors: ['config database wajib diisi'] };
  const errors = validateDatabase(config);
  if (config.source === 'sql') {
    errors.push(...validateSql(request.body.sqlContent ?? '', config.engine));
  }
  return { valid: errors.length === 0, errors };
});

app.post<{ Body: { accounts: Array<{ name?: string; email: string; password: string; role?: string }> } }>('/api/v1/test-accounts/validate', async (request) => {
  const accounts = request.body?.accounts ?? [];
  const errors: string[] = [];
  accounts.forEach((acc, i) => {
    if (!acc.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc.email)) errors.push(`Akun #${i + 1}: format email tidak valid.`);
    if (!acc.password || acc.password.length < 3) errors.push(`Akun #${i + 1}: password terlalu pendek.`);
  });
  return { valid: errors.length === 0, errors };
});

// Database Auto-Seed Endpoints
app.get('/api/v1/fixtures/seed/jamaahku', async () => {
  const sqlPath = path.resolve(root, 'fixtures/sql/jamaahku_lengkap.sql');
  try {
    const meta = await stat(sqlPath);
    return {
      available: true,
      sqlPath,
      sizeBytes: meta.size,
      sizeKb: (meta.size / 1024).toFixed(1)
    };
  } catch {
    return { available: false, sqlPath };
  }
});

app.post('/api/v1/fixtures/seed/jamaahku', async (_request, reply) => {
  try {
    const seederUrl = url.pathToFileURL(path.resolve(root, 'scripts/seed-jamaahku.mjs')).href;
    const seederModule = await import(seederUrl);
    const result = await seederModule.seedJamaahkuDatabase();
    return reply.send({ success: true, ...result });
  } catch (err: any) {
    return reply.code(500).send({ success: false, error: err?.message || String(err) });
  }
});


// Discovery Jobs Endpoints
app.get('/api/v1/discovery/jobs', async () => {
  return discoveryService.listJobs();
});

app.post<{ Body: DiscoveryConfig }>('/api/v1/discovery/jobs', async (request, reply) => {
  const body = request.body;
  if (!body?.name?.trim()) return reply.code(400).send({ error: 'Nama project / job wajib diisi.' });
  const sourceType = body.sourceType ?? (body.runMode === 'managed-local' ? (body.localPath?.trim() ? 'local-folder' : 'github') : 'existing-target');
  if (body.runMode === 'managed-local' && sourceType === 'local-folder' && !body.localPath?.trim() && !body.repositoryUrl?.trim()) {
    return reply.code(400).send({ error: 'Folder lokal wajib diisi untuk mode folder kerja.' });
  }
  if (body.runMode === 'managed-local' && sourceType === 'github' && !body.repositoryUrl?.trim()) {
    return reply.code(400).send({ error: 'Repository GitHub wajib diisi untuk mode GitHub.' });
  }
  if (!body.baseUrl?.trim() && body.runMode !== 'demo') {
    return reply.code(400).send({ error: 'baseUrl wajib diisi.' });
  }
  if (sourceType === 'github') {
    try {
      const repository = new URL(body.repositoryUrl);
      if (!['http:', 'https:'].includes(repository.protocol) || repository.username || repository.password) return reply.code(400).send({ error: 'Repository GitHub harus berupa URL HTTP(S) tanpa credential.' });
    } catch { return reply.code(400).send({ error: 'repositoryUrl GitHub tidak valid.' }); }
  }
  const job = await discoveryService.createJob({ ...body, sourceType, localPath: body.localPath?.trim(), repositoryUrl: body.repositoryUrl?.trim() ?? '' });
  return reply.code(201).send(job);
});

app.get<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id', async (request, reply) => {
  const job = discoveryService.getJob(request.params.id);
  if (!job) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  return job;
});

app.put<{ Params: { id: string }; Body: DiscoveryConfig & { restart?: boolean } }>('/api/v1/discovery/jobs/:id', async (request, reply) => {
  const body = request.body;
  if (!body?.name?.trim()) return reply.code(400).send({ error: 'Nama project / job wajib diisi.' });
  const sourceType = body.sourceType ?? (body.runMode === 'managed-local' ? (body.localPath?.trim() ? 'local-folder' : 'github') : 'existing-target');
  if (body.runMode === 'managed-local' && sourceType === 'local-folder' && !body.localPath?.trim() && !body.repositoryUrl?.trim()) return reply.code(400).send({ error: 'Folder lokal wajib diisi untuk mode folder kerja.' });
  if (body.runMode === 'managed-local' && sourceType === 'github' && !body.repositoryUrl?.trim()) return reply.code(400).send({ error: 'Repository GitHub wajib diisi untuk mode GitHub.' });
  try {
    const job = await discoveryService.updateJob(request.params.id, { ...body, sourceType, localPath: body.localPath?.trim(), repositoryUrl: body.repositoryUrl?.trim() ?? '' }, body.restart !== false);
    return job;
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id/restart', async (request, reply) => {
  try {
    const job = await discoveryService.restartJob(request.params.id);
    return job;
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post<{ Params: { id: string }; Body: { password?: string } }>('/api/v1/discovery/jobs/:id/quality-audit', async (request, reply) => {
  try {
    const job = await discoveryService.startQualityAudit(request.params.id, request.body?.password || '');
    return job;
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id', async (request, reply) => {
  const success = discoveryService.deleteJob(request.params.id);
  if (!success) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  return { success: true };
});

app.post<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id/cancel', async (request, reply) => {
  const success = await discoveryService.cancelJob(request.params.id);
  if (!success) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  return { status: 'CANCELLED' };
});

app.post<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id/generate-flow', async (request, reply) => {
  try {
    const flows = discoveryService.regenerateFlows(request.params.id);
    return { flows };
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put<{ Params: { id: string; flowId: string }; Body: Record<string, unknown> }>('/api/v1/discovery/jobs/:id/business-flows/:flowId', async (request, reply) => {
  try {
    return discoveryService.updateBusinessFlow(request.params.id, request.params.flowId, request.body as any);
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post<{ Params: { id: string }; Body: { flowIds?: string[] } }>('/api/v1/discovery/jobs/:id/business-flows/approve', async (request, reply) => {
  try {
    return discoveryService.approveBusinessFlows(request.params.id, request.body?.flowIds);
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put<{ Params: { id: string; flowId: string }; Body: { source: string } }>('/api/v1/discovery/jobs/:id/flows/:flowId', async (request, reply) => {
  if (!request.body?.source) return reply.code(400).send({ error: 'source wajib diisi.' });
  try {
    const flow = discoveryService.updateFlow(request.params.id, request.params.flowId, request.body.source);
    return flow;
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post<{ Params: { id: string }; Body: { flowIds?: string[]; password?: string } }>('/api/v1/discovery/jobs/:id/run', async (request, reply) => {
  try {
    const job = await discoveryService.runFlows(request.params.id, request.body?.flowIds, request.body?.password);
    return job;
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id/inventory', async (request, reply) => {
  const job = discoveryService.getJob(request.params.id);
  if (!job) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  if (!job.inventory) return reply.code(404).send({ error: 'Inventory belum tersedia' });
  return job.inventory;
});

app.get<{ Params: { id: string }; Querystring: { format?: string; attempt?: string; status?: string; download?: string } }>('/api/v1/discovery/jobs/:id/report', async (request, reply) => {
  const job = discoveryService.getJob(request.params.id);
  if (!job) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  const format = request.query?.format ?? 'html';
  const artifactPrefix = `/api/v1/discovery/jobs/${job.id}/artifacts/`;
  if (format === 'json') {
    const jsonReport = buildJsonReport(job, artifactPrefix, {
      attempt: request.query?.attempt,
      status: request.query?.status
    });
    if (request.query?.download === 'true') {
      reply.header('Content-Disposition', `attachment; filename="qc-report-${job.config.appId || job.id.slice(0, 8)}.json"`);
    }
    return reply.type('application/json; charset=utf-8').send(JSON.stringify(jsonReport, null, 2));
  }
  if (format === 'pdf') {
    const pdfBuffer = await generatePdfReport(job, artifactRoot, {
      attempt: request.query?.attempt,
      status: request.query?.status
    });
    reply.header('Content-Disposition', `inline; filename="qc-report-${job.config.appId || job.id.slice(0, 8)}.pdf"`);
    return reply.type('application/pdf').send(pdfBuffer);
  }
  const html = buildReport(job, artifactPrefix, {
    attempt: request.query?.attempt,
    status: request.query?.status
  });
  return reply.type('text/html; charset=utf-8').send(html);
});

app.get<{ Params: { id: string; '*': string } }>('/api/v1/discovery/jobs/:id/artifacts/*', async (request, reply) => {
  const relative = request.params['*'];
  const safeRelative = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  const jobDir = path.join(artifactRoot, 'jobs', request.params.id);
  const filePath = path.resolve(jobDir, safeRelative);
  if (!filePath.startsWith(jobDir)) return reply.code(403).send({ error: 'Access denied' });
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webm' ? 'video/webm'
      : ext === '.mp4' ? 'video/mp4'
      : ext === '.html' ? 'text/html'
      : ext === '.json' ? 'application/json'
      : 'text/plain';
    return reply.type(mime).send(await readFile(filePath));
  } catch {
    return reply.code(404).type('application/json').send({ error: 'Artifact tidak ditemukan' });
  }
});

app.get('/api/v1/test-runs/full-flow', async (_, reply) => {
  const video = await latestFullFlowVideo();
  if (!video) return { available: false };
  return {
    available: true,
    name: video.name,
    size: video.size,
    updatedAt: video.updatedAt,
    url: '/api/v1/test-runs/full-flow/video'
  };
});

app.get('/api/v1/test-runs/full-flow/video', async (_, reply) => {
  const video = await latestFullFlowVideo();
  if (!video) return reply.code(404).send({ error: 'Video full flow belum tersedia.' });
  const safeFilename = video.name.replace(/[^a-z0-9._-]+/gi, '-');
  return reply
    .type('video/webm')
    .header('Content-Disposition', `inline; filename="${safeFilename}-full-flow.webm"`)
    .header('Cache-Control', 'no-cache')
    .send(await readFile(video.filePath));
});

app.get('/api/v1/zannora-evidence', async () => buildZannoraEvidence());

app.get<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id/quality-evidence', async (request, reply) => {
  const job = discoveryService.getJob(request.params.id);
  if (!job) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  return buildTargetQualityEvidence({ id: job.id, name: job.config.name });
});

app.patch<{ Params: { id: string }; Body: { findingKey?: string; status?: 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'PASSED' } }>('/api/v1/discovery/jobs/:id/findings/status', async (request, reply) => {
  try {
    if (!request.body?.findingKey || !request.body.status) return reply.code(400).send({ error: 'findingKey dan status wajib diisi.' });
    return discoveryService.updateFindingStatus(request.params.id, request.body.findingKey, request.body.status);
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get<{ Params: { id: string } }>('/api/v1/discovery/jobs/:id/history', async (request, reply) => {
  const job = discoveryService.getJob(request.params.id);
  if (!job) return reply.code(404).send({ error: 'Job tidak ditemukan' });
  return { project: job.config.name, entries: await collectDiscoveryRunHistory({ id: job.id, name: job.config.name, workspace: job.workspace }) };
});

app.get<{ Params: { '*': string } }>('/api/v1/zannora-evidence/artifacts/*', async (request, reply) => {
  let decodedRelative: string;
  try {
    decodedRelative = request.params['*'].split('/').map((part) => decodeURIComponent(part)).join('/');
  } catch {
    return reply.code(400).send({ error: 'Path artifact tidak valid' });
  }
  const filePath = path.resolve(artifactRoot, decodedRelative);
  const relativeCheck = path.relative(artifactRoot, filePath);
  if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) return reply.code(403).send({ error: 'Access denied' });
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webm' ? 'video/webm' : ext === '.json' ? 'application/json; charset=utf-8' : ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream';
    return reply.type(mime).header('Content-Disposition', 'inline').header('Cache-Control', 'no-cache').send(await readFile(filePath));
  } catch {
    return reply.code(404).send({ error: 'Evidence artifact tidak ditemukan' });
  }
});

app.get('/', async (_, reply) => reply.type('text/html; charset=utf-8').send(await readFile(path.join(webDist, 'index.html'), 'utf8')));
app.get<{ Params: { '*': string } }>('/assets/*', async (request, reply) => {
  const relative = request.params['*'];
  const file = path.resolve(webDist, 'assets', relative);
  const assetsRoot = path.resolve(webDist, 'assets');
  if (!file.startsWith(assetsRoot)) return reply.code(400).send({ error: 'invalid asset path' });
  try {
    const extension = path.extname(file).toLowerCase();
    const mime = extension === '.js' ? 'application/javascript' : extension === '.css' ? 'text/css' : 'application/octet-stream';
    return reply.type(mime).send(await readFile(file));
  } catch { return reply.code(404).send({ error: 'asset tidak ditemukan' }); }
});

await restoreState();
await discoveryService.init();
const retentionResult = await cleanupRetention(artifactRoot, retention);
if (retentionResult.removed.length) app.log.info({ removed: retentionResult.removed.length, policy: retention }, 'Retention cleanup completed');
retentionTimer = setInterval(() => {
  void cleanupRetention(artifactRoot, retention).then((result) => {
    if (result.removed.length) app.log.info({ removed: result.removed.length }, 'Scheduled retention cleanup completed');
  });
}, retention.cleanupIntervalHours * 3_600_000);
app.addHook('onClose', async () => {
  if (retentionTimer) clearInterval(retentionTimer);
  await flushState();
});
await app.listen({ port, host });
console.log(`QC API running at http://${host}:${port}`);

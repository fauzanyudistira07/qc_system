export type Service = { id: string; name: string; kind: 'frontend' | 'backend' | 'worker' | 'database' | 'custom'; workingDir: string; installCommand: string; startCommand: string; healthCheck: string; port?: number; dependsOn: string[]; runtimeImage?: string };
export type Account = { name: string; email: string; password: string; role: string };
export type Config = {
  name: string; repositoryUrl: string; ref: string; baseUrl: string;
  backendUrl?: string; backendMode?: 'existing' | 'repo';
  runMode: 'managed-local' | 'existing-target' | 'demo'; stack: 'auto' | 'custom' | 'laravel'; services: Service[];
  database: { engine: 'none' | 'mysql' | 'postgres' | 'sqlite'; source: 'empty' | 'sql' | 'migrate' | 'seed'; sqlUploadId?: string; migrationCommand?: string; seedCommand?: string; provisionCommand?: string };
  envUploadId?: string; accounts: Account[];
  rules: { maxPages: number; maxDepth: number; includePaths: string[]; excludePaths: string[]; loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string };
  platform: 'web' | 'android'; appId?: string; deviceId?: string; executeFlows: boolean;
  apkUploadId?: string; apkFilename?: string; apkPackageId?: string;
};
export type Element = { type: string; name: string; selector?: string; testId?: string; tag?: string; source?: string; confidence?: number };
export type Page = { id: string; path: string; title: string; url?: string; status?: number; state: 'observed' | 'candidate' | 'blocked' | 'error'; elements: Element[]; screenshot?: string; source?: string; authentication?: string; errors?: string[]; links?: string[] };
export type Inventory = { pages: Page[]; routes: unknown[]; api: unknown[]; filesScanned: number; warnings: string[]; generatedAt: string };
export type Flow = { id: string; name: string; source: string; platform: string; status: string; reason?: string };
export type Step = { id?: string; index?: number; action?: string; status: string; durationMs?: number; errorMessage?: string; [key: string]: unknown };
export type Artifact = { type?: string; path?: string; name?: string; url?: string };
export type Result = { flowId: string; status: string; steps: Step[]; artifacts: (Artifact | string)[]; runId?: string; finishedAt?: string };
export type Job = { id: string; name: string; status: string; phase: string; progress: number; createdAt: string; finishedAt?: string; message?: string; logs: { time: string; category: string; message: string }[]; inventory?: Inventory; flows?: Flow[]; results?: Result[]; config?: Partial<Config> };
export type Capability = { available: boolean; message: string; devices?: string[] };
export type SystemStatus = Record<'docker' | 'playwright' | 'maestro' | 'adb', Capability>;
export type LegacyRun = { id: string; name: string; status: string; mode: string; createdAt: string; message?: string; stepResults?: Step[]; result?: { status: string; steps: Step[]; artifacts: Artifact[] } };
export type EvidenceAsset = { type: 'report' | 'screenshot' | 'video' | 'other'; name: string; label: string; url: string; relativePath: string; size: number; updatedAt: string };
export type EvidenceGroup = { id: string; title: string; category: string; status: string; summary: string; folder: string; report?: EvidenceAsset; assets: EvidenceAsset[]; screenshots: EvidenceAsset[]; videos: EvidenceAsset[] };
export type ZannoraEvidence = { project: string; generatedAt: string; groups: EvidenceGroup[]; totals: { groups: number; passed: number; failed: number; reports: number; screenshots: number; videos: number; assets: number } };
export type View = 'overview' | 'projects' | 'discovery' | 'map' | 'flows' | 'runs' | 'reports' | 'evidence' | 'settings' | 'new' | 'live';
export const initialConfig = (): Config => ({
  name: '',
  repositoryUrl: '',
  ref: 'main',
  baseUrl: 'http://127.0.0.1:8000',
  backendUrl: 'http://10.0.2.2:8000',
  backendMode: 'existing',
  runMode: 'existing-target',
  stack: 'auto',
  services: [],
  database: { engine: 'none', source: 'empty' },
  accounts: [{ name: 'QA Tester', email: 'tester.qc@example.com', password: 'password123', role: 'user' }],
  rules: {
    maxPages: 40,
    maxDepth: 4,
    includePaths: [],
    excludePaths: ['/logout', '/delete'],
    loginPath: '/login',
    emailSelector: "input[name='email'], #email, input[type='email']",
    passwordSelector: "input[type='password'], #password",
    submitSelector: "button[type='submit'], .btn-primary",
    successUrl: '/dashboard',
  },
  platform: 'android',
  executeFlows: true,
});

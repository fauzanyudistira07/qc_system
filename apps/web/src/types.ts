export type Service = { id: string; name: string; kind: 'frontend' | 'backend' | 'worker' | 'database' | 'custom'; workingDir: string; installCommand: string; startCommand: string; healthCheck: string; port?: number; dependsOn: string[]; runtimeImage?: string };
export type Account = { name: string; email: string; password: string; role: string };
export type QualityAuditBrowser = 'chromium' | 'firefox' | 'webkit';
export type QualityAuditViewport = 'desktop' | 'tablet' | 'mobile';
export type QualityAuditConfig = {
  enabled: boolean;
  browsers: QualityAuditBrowser[];
  viewports: QualityAuditViewport[];
  maxRoutes: number;
  routeOffset: number;
  navigationTimeoutMs: number;
  accessibility?: boolean;
  stateTesting?: { enabled?: boolean; hover?: boolean; focus?: boolean; disabled?: boolean; loading?: boolean; empty?: boolean; error?: boolean };
  screenReader?: { mode?: 'semantic' | 'external'; command?: string; timeoutMs?: number };
  visualRegression?: {
    mode?: 'off' | 'capture' | 'required';
    baselineDir?: string;
    updateBaseline?: boolean;
    pixelThreshold?: number;
    allowedDiffPercent?: number;
  };
  denseData?: { enabled?: boolean; syntheticRows?: number; longTextLength?: number };
  negativeTesting?: { enabled?: boolean; emptyFormValidation?: boolean; duplicateSubmissionGuard?: boolean; networkFailureHandling?: boolean; transactionalScenarios?: boolean; fixtureReportPath?: string; mutationFixturePath?: string; runMutations?: boolean };
};
export type QualityAuditState = {
  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'PASSED_WITH_LIMITATIONS' | 'FAILED' | 'SKIPPED' | 'ERROR';
  startedAt?: string;
  finishedAt?: string;
  total?: number;
  passed?: number;
  failed?: number;
  notApplicable?: number;
  browsers?: QualityAuditBrowser[];
  viewports?: QualityAuditViewport[];
  reportPath?: string;
  message?: string;
  categories?: Record<string, { total: number; passed: number; failed: number }>;
  visualRegression?: { mode?: 'off' | 'capture' | 'required'; baselinesCompared?: number; baselinesCaptured?: number; changed?: number; missing?: number };
};
export type Config = {
  name: string; repositoryUrl: string; ref: string; baseUrl: string;
  backendUrl?: string; backendMode?: 'existing' | 'repo';
  runMode: 'managed-local' | 'existing-target' | 'demo'; stack: 'auto' | 'custom' | 'laravel'; services: Service[];
  database: { engine: 'none' | 'mysql' | 'postgres' | 'sqlite'; source: 'empty' | 'sql' | 'migrate' | 'seed'; sqlUploadId?: string; migrationCommand?: string; seedCommand?: string; provisionCommand?: string };
  envUploadId?: string; accounts: Account[];
  rules: { maxPages: number; maxDepth: number; includePaths: string[]; excludePaths: string[]; loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string };
  platform: 'web' | 'android'; appId?: string; deviceId?: string; executeFlows: boolean; qualityAudit: QualityAuditConfig;
  apkUploadId?: string; apkFilename?: string; apkPackageId?: string;
};
export type Element = { type: string; name: string; selector?: string; testId?: string; tag?: string; source?: string; confidence?: number };
export type Page = { id: string; path: string; title: string; url?: string; status?: number; state: 'observed' | 'candidate' | 'blocked' | 'error'; elements: Element[]; screenshot?: string; source?: string; authentication?: string; errors?: string[]; links?: string[] };
export type CapabilityEvidence = { routes: string[]; apiRoutes: string[]; elements: string[]; methods: string[] };
export type DetectedCapability = { id: string; category: string; label: string; confidence: number; status: 'detected' | 'candidate'; rationale: string; evidence: CapabilityEvidence; recommendedChecks: string[] };
export type NegativeScenarioPlan = { id: string; capability: string; label: string; execution: 'safe-probe' | 'requires-fixture'; checks: string[] };
export type CapabilityProfile = { version: string; detectedAt: string; domainHints: string[]; totalCatalogCapabilities: number; detectedCount: number; capabilities: DetectedCapability[]; negativeScenarios?: NegativeScenarioPlan[] };
export type CrudOperation = 'list' | 'detail' | 'create' | 'update' | 'delete' | 'duplicate' | 'delete-in-use';
export type CrudResourcePlan = { id: string; name: string; routes: string[]; apiRoutes: string[]; evidenceElements: string[]; operations: Record<CrudOperation, 'AVAILABLE' | 'PLANNED' | 'REQUIRES_FIXTURE' | 'NOT_OBSERVED'>; safeChecks: string[]; fixtureChecks: string[]; confidence: number };
export type CrudPlan = { version: string; generatedAt: string; resources: CrudResourcePlan[]; totals: { resources: number; available: number; planned: number; requiresFixture: number }; limitations: string[] };
export type RoleActionPlan = { version: string; generatedAt: string; roles: string[]; rows: Array<{ role: string; page: string; authentication: string; actions: string[]; expectation: 'EXPECTED' | 'CANDIDATE' | 'REQUIRES_RUNTIME'; checks: string[] }>; totals: { rows: number; expected: number; candidate: number; runtime: number }; limitations: string[] };
export type Inventory = { pages: Page[]; routes: unknown[]; api: unknown[]; filesScanned: number; warnings: string[]; generatedAt: string; capabilities?: CapabilityProfile; crudPlan?: CrudPlan; roleActionPlan?: RoleActionPlan };
export type Flow = { id: string; name: string; source: string; platform: string; status: string; reason?: string };
export type Step = { id?: string; index?: number; action?: string; status: string; durationMs?: number; errorMessage?: string; [key: string]: unknown };
export type Artifact = { type?: string; path?: string; name?: string; url?: string };
export type Result = { flowId: string; status: string; steps: Step[]; artifacts: (Artifact | string)[]; runId?: string; finishedAt?: string };
export type JobWorkspace = { projectSlug: string; runLabel: string; projectPath: string; runPath: string; milestonesPath: string };
export type Job = { id: string; name: string; status: string; phase: string; progress: number; createdAt: string; finishedAt?: string; message?: string; logs: { time: string; category: string; message: string }[]; inventory?: Inventory; flows?: Flow[]; results?: Result[]; qualityAudit?: QualityAuditState; findingStatuses?: Record<string, FindingWorkflowStatus>; config?: Partial<Config>; workspace?: JobWorkspace };
export type Capability = { available: boolean; message: string; devices?: string[] };
export type SystemStatus = Record<'docker' | 'playwright' | 'maestro' | 'adb', Capability>;
export type LegacyRun = { id: string; name: string; status: string; mode: string; createdAt: string; message?: string; stepResults?: Step[]; result?: { status: string; steps: Step[]; artifacts: Artifact[] } };
export type EvidenceAsset = { type: 'report' | 'screenshot' | 'video' | 'other'; name: string; label: string; url: string; relativePath: string; size: number; updatedAt: string };
export type EvidenceFinding = { groupId?: string; area?: string; name?: string; detail?: string; browser?: string; viewport?: string; route?: string; location?: string; screenshot?: string; passed?: boolean; applicable?: boolean; outcome?: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE' };
export type FindingWorkflowStatus = 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'PASSED';
export type EvidenceMetadata = { passed?: number; total?: number; failed?: number; notApplicable?: number; routes?: string[]; browsers?: string[]; viewports?: string[]; operations?: string[]; bookingCode?: string; findings?: EvidenceFinding[] };
export type RunHistoryEntry = { runLabel: string; project: string; status: string; phase?: string; progress?: number; createdAt?: string; updatedAt?: string; quality?: { status?: string; total?: number; passed?: number; failed?: number; notApplicable?: number; visualRegression?: QualityAuditState['visualRegression'] } };
export type EvidenceGroup = { id: string; title: string; category: string; status: string; summary: string; folder: string; report?: EvidenceAsset; assets: EvidenceAsset[]; screenshots: EvidenceAsset[]; videos: EvidenceAsset[]; metadata?: EvidenceMetadata };
export type ZannoraEvidence = { project: string; generatedAt: string; groups: EvidenceGroup[]; totals: { groups: number; passed: number; failed: number; reports: number; screenshots: number; videos: number; assets: number } };
export type View = 'overview' | 'process' | 'projects' | 'discovery' | 'map' | 'flows' | 'runs' | 'findings' | 'reports' | 'evidence' | 'settings' | 'new' | 'live';
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
  qualityAudit: {
    enabled: true,
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: ['desktop', 'tablet', 'mobile'],
    maxRoutes: 0,
    routeOffset: 0,
    navigationTimeoutMs: 60000,
    accessibility: true,
    visualRegression: { mode: 'required', updateBaseline: false, pixelThreshold: 0.1, allowedDiffPercent: 0.5 },
    denseData: { enabled: true, syntheticRows: 100, longTextLength: 240 },
    stateTesting: { enabled: true, hover: true, focus: true, disabled: true, loading: true, empty: true, error: true },
    screenReader: { mode: 'semantic', timeoutMs: 10000 },
    negativeTesting: { enabled: true, emptyFormValidation: true, duplicateSubmissionGuard: true, networkFailureHandling: true, transactionalScenarios: true, mutationFixturePath: '', runMutations: false },
  },
});

// Feature flag: enable mobile support
export const ENABLE_MOBILE_SUPPORT = true;

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
  scorePercent?: number;
  errorBreakdown?: {
    userAppErrors: number;
    qcEngineErrors: number;
  };
  browsers?: QualityAuditBrowser[];
  viewports?: QualityAuditViewport[];
  reportPath?: string;
  message?: string;
  categories?: Record<string, { total: number; passed: number; failed: number; notApplicable?: number; userAppErrors?: number; qcEngineErrors?: number }>;
  visualRegression?: { mode?: 'off' | 'capture' | 'required'; baselinesCompared?: number; baselinesCaptured?: number; changed?: number; missing?: number };
};
export type TargetExecutionMode = 'local' | 'internet' | 'server';
export type ServiceTargetConfig = {
  mode: TargetExecutionMode;
  url: string;
  repositoryUrl: string;
  branch: string;
  sameRepoAsFrontend?: boolean;
};
export type EnvProvisionEntry = {
  directory: string;
  templateFile: string;
  targetEnvFile: string;
  keysPopulated: string[];
  aiInferredKeys: string[];
  notes: string[];
};
export type EnvProvisionResult = {
  entries: EnvProvisionEntry[];
  warnings: string[];
};
export type ProvisionedRoleAccount = {
  role: string;
  name?: string;
  identifier: string;
  identifierField: string;
  source: 'seeder' | 'register-api' | 'db-insert' | 'cli' | 'manual';
  verified: boolean;
  verificationNote?: string;
  loginPath?: string;
  homePath?: string;
};
export type BatchCommandPlan = {
  version: string;
  generatedAt: string;
  platform: 'web' | 'android';
  longScreenshotPlanPath: string;
  videoPlanPath: string;
  screenshotCommands: Array<{ id: string; role: string; pageId: string; pagePath: string; pageTitle: string; outputFilename: string }>;
  videoCommands: Array<{ role: string; outputFilename: string; steps: Array<{ kind: string; label: string; pagePath?: string }> }>;
};
export type LongScreenshotArtifact = {
  id: string;
  role: string;
  pageId: string;
  pagePath: string;
  pageTitle: string;
  filename: string;
  path: string;
  url: string;
  width: number;
  height: number;
  segmentCount: number;
  status: 'CAPTURED' | 'FAILED';
  error?: string;
};
export type RoleVideoArtifact = {
  role: string;
  filename: string;
  path: string;
  url: string;
  durationSec: number;
  sizeBytes: number;
  chapters: Array<{ startSec: number; page: string; feature?: string }>;
  status: 'RECORDED' | 'FAILED';
  error?: string;
};
export type CoverageGapItem = {
  id: string;
  role: string;
  pagePath: string;
  pageTitle: string;
  phaseFailed: 'ENV' | 'EMULATOR' | 'AUTH' | 'RECON' | 'LONG_SS' | 'VIDEO';
  category:
    | 'auth-failed'
    | 'rbac-forbidden'
    | 'dynamic-param-unresolved'
    | 'backend-5xx'
    | 'ui-crash'
    | 'timeout'
    | 'navigation-missing'
    | 'video-missing'
    | 'env-misconfigured';
  httpStatus?: number;
  redirectedTo?: string;
  failedApiCalls?: Array<{ method: string; url: string; status: number }>;
  consoleOrDeviceErrors?: string[];
  errorScreenshotUrl?: string;
  technicalReason: string;
  aiDiagnosis?: {
    summaryId: string;
    likelyCause: string;
    recommendedFix: string;
    ownerRole: 'frontend' | 'backend' | 'mobile' | 'infra';
  };
};
export type Phase1ReconSummary = {
  discoveredAt: string;
  approvedAt?: string;
  platform: 'web' | 'android';
  totalRoles: number;
  totalPages: number;
  totalInteractiveFeatures: number;
  roles: Array<{
    role: string;
    pagesCount: number;
    interactiveFeaturesCount: number;
    accountVerified: boolean;
  }>;
  batch1TotalScreenshots?: number;
  batch1CapturedCount?: number;
  batch2TotalRoleVideos?: number;
  batch2RecordedCount?: number;
  aiExecutiveSummary?: string;
};

export type Config = {
  name: string; sourceType?: 'existing-target' | 'local-folder' | 'github'; localPath?: string; repositoryUrl: string; ref: string; baseUrl: string;
  backendUrl?: string; backendMode?: 'existing' | 'local' | 'repo';
  runMode: 'managed-local' | 'existing-target' | 'demo'; stack: 'auto' | 'custom' | 'laravel'; services: Service[];
  database: { engine: 'none' | 'mysql' | 'postgres' | 'sqlite'; source: 'empty' | 'sql' | 'migrate' | 'seed'; sqlUploadId?: string; migrationCommand?: string; seedCommand?: string; provisionCommand?: string };
  envUploadId?: string; accounts: Account[]; autoProvisionAccounts?: boolean;
  rules: { maxPages: number; maxDepth: number; includePaths: string[]; excludePaths: string[]; loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string };
  platform: 'web' | 'android'; appId?: string; deviceId?: string; useServerEmulator?: boolean;
  frontendTarget?: ServiceTargetConfig; backendTarget?: ServiceTargetConfig; mobileTarget?: ServiceTargetConfig;
  executeFlows: boolean; businessFlowReview: { mode: 'required' | 'auto' }; qualityAudit: QualityAuditConfig;
  apkUploadId?: string; apkFilename?: string; apkPackageId?: string;
};
export type Element = { type: string; name: string; selector?: string; testId?: string; tag?: string; source?: string; confidence?: number };
export type InteractiveFeatureItem = { kind: 'tab' | 'accordion' | 'drawer' | 'filter' | 'modal-trigger' | 'link'; label: string; selector?: string; bounds?: { x: number; y: number } };
export type Page = {
  id: string; path: string; title: string; url?: string; status?: number; state: 'observed' | 'candidate' | 'blocked' | 'error';
  elements: Element[]; screenshot?: string; source?: string; authentication?: string; errors?: string[]; links?: string[]; apiEndpoints?: string[];
  role?: string; scrollHeight?: number; viewportHeight?: number; isScrollable?: boolean; scrollContainerSelector?: string;
  interactiveFeatures?: InteractiveFeatureItem[]; resolvedConcretePath?: string;
};
export type CapabilityEvidence = { routes: string[]; apiRoutes: string[]; elements: string[]; methods: string[] };
export type DetectedCapability = { id: string; category: string; label: string; confidence: number; status: 'detected' | 'candidate'; rationale: string; evidence: CapabilityEvidence; recommendedChecks: string[] };
export type NegativeScenarioPlan = { id: string; capability: string; label: string; execution: 'safe-probe' | 'requires-fixture'; checks: string[] };
export type CapabilityProfile = { version: string; detectedAt: string; domainHints: string[]; totalCatalogCapabilities: number; detectedCount: number; capabilities: DetectedCapability[]; negativeScenarios?: NegativeScenarioPlan[] };
export type CrudOperation = 'list' | 'detail' | 'create' | 'update' | 'delete' | 'duplicate' | 'delete-in-use';
export type CrudResourcePlan = { id: string; name: string; routes: string[]; apiRoutes: string[]; evidenceElements: string[]; operations: Record<CrudOperation, 'AVAILABLE' | 'PLANNED' | 'REQUIRES_FIXTURE' | 'NOT_OBSERVED'>; safeChecks: string[]; fixtureChecks: string[]; confidence: number };
export type CrudPlan = { version: string; generatedAt: string; resources: CrudResourcePlan[]; totals: { resources: number; available: number; planned: number; requiresFixture: number }; limitations: string[] };
export type RoleActionPlan = { version: string; generatedAt: string; roles: string[]; rows: Array<{ role: string; page: string; authentication: string; actions: string[]; expectation: 'EXPECTED' | 'CANDIDATE' | 'REQUIRES_RUNTIME'; checks: string[] }>; totals: { rows: number; expected: number; candidate: number; runtime: number }; limitations: string[] };
export type FeatureScenarioKind = 'happy' | 'negative' | 'boundary' | 'permission' | 'recovery' | 'integrity';
export type FeatureScenario = { id: string; kind: FeatureScenarioKind; label: string; checks: string[]; execution: 'safe-probe' | 'requires-fixture' | 'requires-runtime'; status: 'PLANNED' | 'READY' | 'BLOCKED' };
export type FeatureContract = { id: string; capabilityId: string; label: string; category: string; status: 'READY_FOR_REVIEW' | 'REQUIRES_REVIEW' | 'CANDIDATE'; confidence: number; actors: string[]; routes: string[]; apiRoutes: string[]; preconditions: string[]; inputData: string[]; expectedUi: string[]; expectedApi: string[]; expectedData: string[]; scenarios: FeatureScenario[]; evidence: { routes: string[]; apiRoutes: string[]; elements: string[] }; limitations: string[] };
export type FeatureContractPlan = { version: string; generatedAt: string; total: number; readyForReview: number; requiresReview: number; candidate: number; scenarioTotals: Record<FeatureScenarioKind, number>; contracts: FeatureContract[]; limitations: string[] };
export type BusinessFlowStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'BLOCKED';
export type BusinessFlowStep = { order: number; action: string; route?: string; expected: string; evidence?: string[] };
export type BusinessFlow = {
  id: string; title: string; summary: string; category: string; actors: string[]; trigger: string; preconditions: string[];
  steps: BusinessFlowStep[]; expectedOutcome: string[]; negativeScenarios: string[]; recoveryScenarios: string[];
  evidence: { capabilities: string[]; routes: string[]; apiRoutes: string[]; elements: string[] };
  confidence: number; critical: boolean; status: BusinessFlowStatus; source: 'observed' | 'inferred'; limitations: string[]; approvedAt?: string;
};
export type BusinessFlowMap = {
  version: string; generatedAt: string; status: 'AWAITING_REVIEW' | 'APPROVED' | 'PARTIAL' | 'BLOCKED';
  productProfile: { domainHints: string[]; capabilities: string[]; actors: string[] };
  summary: { total: number; approved: number; needsReview: number; blocked: number; critical: number };
  flows: BusinessFlow[]; limitations: string[];
};
export type Inventory = { pages: Page[]; routes: unknown[]; api: unknown[]; filesScanned: number; warnings: string[]; generatedAt: string; rolesDiscovered?: string[]; capabilities?: CapabilityProfile; crudPlan?: CrudPlan; roleActionPlan?: RoleActionPlan; featureContractPlan?: FeatureContractPlan };
export type Flow = { id: string; name: string; source: string; platform: string; status: string; reason?: string };
export type Step = { id?: string; index?: number; action?: string; status: string; durationMs?: number; errorCode?: string; errorMessage?: string; errorOrigin?: 'user_target_application' | 'qc_maestro_engine'; [key: string]: unknown };
export type Artifact = { type?: string; path?: string; name?: string; url?: string };
export type Result = { flowId: string; status: string; steps: Step[]; artifacts: (Artifact | string)[]; runId?: string; finishedAt?: string; errorOrigin?: 'user_target_application' | 'qc_maestro_engine' };
export type JobWorkspace = { projectSlug: string; runLabel: string; projectPath: string; runPath: string; milestonesPath: string };
export type Job = {
  id: string;
  name: string;
  status: string;
  phase: string;
  progress: number;
  createdAt: string;
  finishedAt?: string;
  message?: string;
  logs: { time: string; category: string; message: string }[];
  envProvisioning?: EnvProvisionResult;
  provisionedAccounts?: ProvisionedRoleAccount[];
  reconSummary?: Phase1ReconSummary;
  commandPlan?: BatchCommandPlan;
  longScreenshots?: LongScreenshotArtifact[];
  roleVideos?: RoleVideoArtifact[];
  coverageGaps?: CoverageGapItem[];
  inventory?: Inventory;
  businessFlowMap?: BusinessFlowMap;
  flows?: Flow[];
  results?: Result[];
  qualityAudit?: QualityAuditState;
  findingStatuses?: Record<string, FindingWorkflowStatus>;
  config?: Partial<Config>;
  workspace?: JobWorkspace;
  parentJobId?: string;
  kind?: 'baseline' | 'incremental-room';
  commitInfo?: {
    sha: string;
    message: string;
    author: string;
    branch: string;
    filesChanged: string[];
    diffSummary?: string;
    repoUrl?: string;
  };
  impactReport?: {
    impactedModules: string[];
    impactedRoutes: string[];
    totalFlowsTested: number;
    passed: number;
    failed: number;
    summary: string;
  };
};
export type Capability = { available: boolean; message: string; devices?: string[] };
export type SystemStatus = Record<'docker' | 'playwright' | 'maestro' | 'adb', Capability>;
export type LegacyRun = { id: string; name: string; status: string; mode: string; createdAt: string; message?: string; stepResults?: Step[]; result?: { status: string; steps: Step[]; artifacts: Artifact[] } };
export type EvidenceAsset = { type: 'report' | 'screenshot' | 'video' | 'other'; name: string; label: string; url: string; relativePath: string; size: number; updatedAt: string };
export type EvidenceFinding = { groupId?: string; area?: string; name?: string; detail?: string; browser?: string; viewport?: string; route?: string; location?: string; screenshot?: string; passed?: boolean; applicable?: boolean; outcome?: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE' };
export type FindingWorkflowStatus = 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'PASSED';
export type EvidenceMetadata = { passed?: number; total?: number; failed?: number; notApplicable?: number; routes?: string[]; browsers?: string[]; viewports?: string[]; operations?: string[]; bookingCode?: string; findings?: EvidenceFinding[] };
export type RunHistoryEntry = { runLabel: string; project: string; status: string; phase?: string; progress?: number; createdAt?: string; updatedAt?: string; quality?: { status?: string; total?: number; passed?: number; failed?: number; notApplicable?: number; visualRegression?: QualityAuditState['visualRegression'] } };
export type EvidenceGroup = { id: string; title: string; category: string; status: string; summary: string; folder: string; report?: EvidenceAsset; assets: EvidenceAsset[]; screenshots: EvidenceAsset[]; videos: EvidenceAsset[]; metadata?: EvidenceMetadata };
export type QualityEvidence = { project: string; generatedAt: string; groups: EvidenceGroup[]; totals: { groups: number; passed: number; failed: number; reports: number; screenshots: number; videos: number; assets: number } };
export type View = 'overview' | 'new' | 'discovery' | 'map' | 'flows' | 'runs' | 'findings' | 'reports' | 'evidence';
export const initialConfig = (): Config => ({
  name: '',
  sourceType: 'github',
  repositoryUrl: '',
  ref: 'main',
  baseUrl: 'http://127.0.0.1:5000',
  backendUrl: 'http://127.0.0.1:5001',
  backendMode: 'repo',
  runMode: 'managed-local',
  stack: 'auto',
  services: [],
  database: { engine: 'mysql', source: 'migrate' },
  accounts: [],
  autoProvisionAccounts: true,
  rules: {
    maxPages: 120,
    maxDepth: 8,
    includePaths: [],
    excludePaths: ['/logout', '/delete'],
    loginPath: '/login',
    emailSelector: "input[name='email'], #email, input[type='email']",
    passwordSelector: "input[type='password'], #password",
    submitSelector: "button[type='submit'], .btn-primary",
    successUrl: '/dashboard',
  },
  platform: 'web',
  deviceId: 'qc_worker_headless',
  useServerEmulator: true,
  frontendTarget: {
    mode: 'server',
    url: 'http://127.0.0.1:5000',
    repositoryUrl: '',
    branch: 'main',
  },
  backendTarget: {
    mode: 'server',
    url: 'http://127.0.0.1:5001',
    repositoryUrl: '',
    branch: 'main',
  },
  mobileTarget: {
    mode: 'server',
    url: 'http://10.0.2.2:5001',
    repositoryUrl: '',
    branch: 'main',
    sameRepoAsFrontend: false,
  },
  executeFlows: true,
  businessFlowReview: { mode: 'required' },
  qualityAudit: {
    enabled: false,
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

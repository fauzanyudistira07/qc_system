import type { InventoryPage } from './source-scanner.ts';
import type { ManagedService } from '../project-runner.ts';
import type { WebRunResult } from '../playwright-adapter.ts';
import type { CapabilityProfile } from './capability-model.ts';
import type { CrudPlan } from './crud-planner.ts';
import type { RoleActionPlan } from './role-planner.ts';
import type { FeatureContractPlan } from './feature-contract.ts';
import type { BusinessFlowMap } from './business-flow.ts';

export type QualityAuditBrowser = 'chromium' | 'firefox' | 'webkit';
export type QualityAuditViewport = 'desktop' | 'tablet' | 'mobile';
export type VisualRegressionMode = 'off' | 'capture' | 'required';
export type QualityAuditConfig = {
  enabled: boolean;
  browsers: QualityAuditBrowser[];
  viewports: QualityAuditViewport[];
  maxRoutes: number;
  routeOffset: number;
  navigationTimeoutMs: number;
  accessibility?: boolean;
  stateTesting?: {
    enabled?: boolean;
    hover?: boolean;
    focus?: boolean;
    disabled?: boolean;
    loading?: boolean;
    empty?: boolean;
    error?: boolean;
  };
  screenReader?: {
    mode?: 'semantic' | 'external';
    command?: string;
    timeoutMs?: number;
  };
  visualRegression?: {
    mode?: VisualRegressionMode;
    baselineDir?: string;
    updateBaseline?: boolean;
    pixelThreshold?: number;
    allowedDiffPercent?: number;
  };
  denseData?: {
    enabled?: boolean;
    syntheticRows?: number;
    longTextLength?: number;
  };
  negativeTesting?: {
    enabled?: boolean;
    emptyFormValidation?: boolean;
    duplicateSubmissionGuard?: boolean;
    networkFailureHandling?: boolean;
    transactionalScenarios?: boolean;
    fixtureReportPath?: string;
    mutationFixturePath?: string;
    runMutations?: boolean;
  };
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
  visualRegression?: { mode?: VisualRegressionMode; baselinesCompared?: number; baselinesCaptured?: number; changed?: number; missing?: number };
};
export type FindingWorkflowStatus = 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'PASSED';

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
  secretsToRedact: string[];
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

export type BatchLongScreenshotCommand = {
  id: string;
  role: string;
  pageId: string;
  pagePath: string;
  pageTitle: string;
  targetUrl?: string;
  scrollContainerSelector?: string;
  outputFilename: string;
};

export type BatchVideoFeatureStep = {
  kind: 'navigate' | 'click-feature' | 'scroll-full' | 'wait';
  label: string;
  pagePath?: string;
  selector?: string;
  bounds?: { x: number; y: number };
  scrollContainerSelector?: string;
  pauseMs?: number;
};

export type BatchVideoRoleCommand = {
  role: string;
  outputFilename: string;
  loginPath?: string;
  steps: BatchVideoFeatureStep[];
};

export type BatchCommandPlan = {
  version: string;
  generatedAt: string;
  platform: 'web' | 'android';
  longScreenshotPlanPath: string;
  videoPlanPath: string;
  screenshotCommands: BatchLongScreenshotCommand[];
  videoCommands: BatchVideoRoleCommand[];
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

export type RoleVideoChapter = {
  startSec: number;
  page: string;
  feature?: string;
};

export type RoleVideoArtifact = {
  role: string;
  filename: string;
  path: string;
  url: string;
  durationSec: number;
  sizeBytes: number;
  chapters: RoleVideoChapter[];
  status: 'RECORDED' | 'FAILED';
  error?: string;
};

export type CoverageGapPhase = 'ENV' | 'EMULATOR' | 'AUTH' | 'RECON' | 'LONG_SS' | 'VIDEO';
export type CoverageGapItem = {
  id: string;
  role: string;
  pagePath: string;
  pageTitle: string;
  phaseFailed: CoverageGapPhase;
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

export type DiscoveryConfig = {
  name: string; sourceType?: 'existing-target' | 'local-folder' | 'github'; localPath?: string; repositoryUrl: string; ref: string; baseUrl: string;
  backendUrl?: string; backendMode?: 'existing' | 'local' | 'repo';
  runMode: 'managed-local' | 'existing-target' | 'demo'; stack: 'auto' | 'custom' | 'laravel';
  services: ManagedService[]; envUploadId?: string;
  database: { engine: 'none' | 'mysql' | 'postgres' | 'sqlite'; source: 'empty' | 'sql' | 'migrate' | 'seed'; sqlUploadId?: string; migrationCommand?: string; seedCommand?: string; provisionCommand?: string };
  accounts: Array<{ name?: string; email: string; password: string; role?: string }>;
  autoProvisionAccounts?: boolean;
  rules: { maxPages: number; maxDepth: number; includePaths: string[]; excludePaths: string[]; loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string };
  platform: 'web' | 'android'; appId?: string; deviceId?: string; useServerEmulator?: boolean;
  frontendTarget?: ServiceTargetConfig; backendTarget?: ServiceTargetConfig; mobileTarget?: ServiceTargetConfig;
  executeFlows: boolean; businessFlowReview?: { mode: 'required' | 'auto' }; qualityAudit?: QualityAuditConfig;
  apkUploadId?: string; apkFilename?: string; apkPackageId?: string;
};
export type Inventory = {
  pages: InventoryPage[];
  routes: Array<{ path: string; method: string; source: string }>;
  api: Array<{ path: string; method: string; source: string }>;
  filesScanned: number;
  warnings: string[];
  generatedAt: string;
  rolesDiscovered?: string[];
  capabilities?: CapabilityProfile;
  crudPlan?: CrudPlan;
  roleActionPlan?: RoleActionPlan;
  featureContractPlan?: FeatureContractPlan;
};
export type GeneratedFlow = { id: string; name: string; source: string; platform: 'web' | 'android'; status: 'READY' | 'REVIEW_REQUIRED' | 'PASSED' | 'FAILED' | 'INFRA_ERROR'; reason?: string; pageId?: string };
export type DiscoveryJob = {
  id: string; name: string; status: 'QUEUED' | 'RUNNING' | 'WAITING_REVIEW' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
  phase: string; progress: number; createdAt: string; finishedAt?: string; message?: string;
  logs: Array<{ time: string; category: string; message: string }>;
  config: Omit<DiscoveryConfig, 'accounts'> & { accounts: Array<{ name?: string; email: string; role?: string }> };
  envProvisioning?: EnvProvisionResult;
  provisionedAccounts?: ProvisionedRoleAccount[];
  reconSummary?: Phase1ReconSummary;
  commandPlan?: BatchCommandPlan;
  longScreenshots?: LongScreenshotArtifact[];
  roleVideos?: RoleVideoArtifact[];
  coverageGaps?: CoverageGapItem[];
  inventory?: Inventory; businessFlowMap?: BusinessFlowMap; flows: GeneratedFlow[];
  results: Array<WebRunResult & { flowId: string; runId: string; finishedAt: string }>;
  qualityAudit?: QualityAuditState;
  findingStatuses?: Record<string, FindingWorkflowStatus>;
  workspace?: { projectSlug: string; runLabel: string; projectPath: string; runPath: string; milestonesPath: string };
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
    summary?: string;
  };
};

import type { InventoryPage } from './source-scanner.ts';
import type { ManagedService } from '../project-runner.ts';
import type { WebRunResult } from '../playwright-adapter.ts';
import type { CapabilityProfile } from './capability-model.ts';
import type { CrudPlan } from './crud-planner.ts';
import type { RoleActionPlan } from './role-planner.ts';

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
  browsers?: QualityAuditBrowser[];
  viewports?: QualityAuditViewport[];
  reportPath?: string;
  message?: string;
  categories?: Record<string, { total: number; passed: number; failed: number; notApplicable?: number }>;
  visualRegression?: { mode?: VisualRegressionMode; baselinesCompared?: number; baselinesCaptured?: number; changed?: number; missing?: number };
};
export type FindingWorkflowStatus = 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'PASSED';

export type DiscoveryConfig = {
  name: string; repositoryUrl: string; ref: string; baseUrl: string;
  runMode: 'managed-local' | 'existing-target' | 'demo'; stack: 'auto' | 'custom' | 'laravel';
  services: ManagedService[]; envUploadId?: string;
  database: { engine: 'none' | 'mysql' | 'postgres' | 'sqlite'; source: 'empty' | 'sql' | 'migrate' | 'seed'; sqlUploadId?: string; migrationCommand?: string; seedCommand?: string; provisionCommand?: string };
  accounts: Array<{ name?: string; email: string; password: string; role?: string }>;
  rules: { maxPages: number; maxDepth: number; includePaths: string[]; excludePaths: string[]; loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string };
  platform: 'web' | 'android'; appId?: string; deviceId?: string; executeFlows: boolean; qualityAudit?: QualityAuditConfig;
  apkUploadId?: string; apkFilename?: string; apkPackageId?: string;
};
export type Inventory = { pages: InventoryPage[]; routes: Array<{ path: string; method: string; source: string }>; api: Array<{ path: string; method: string; source: string }>; filesScanned: number; warnings: string[]; generatedAt: string; capabilities?: CapabilityProfile; crudPlan?: CrudPlan; roleActionPlan?: RoleActionPlan };
export type GeneratedFlow = { id: string; name: string; source: string; platform: 'web' | 'android'; status: 'READY' | 'REVIEW_REQUIRED' | 'PASSED' | 'FAILED' | 'INFRA_ERROR'; reason?: string; pageId?: string };
export type DiscoveryJob = {
  id: string; name: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
  phase: string; progress: number; createdAt: string; finishedAt?: string; message?: string;
  logs: Array<{ time: string; category: string; message: string }>;
  config: Omit<DiscoveryConfig, 'accounts'> & { accounts: Array<{ name?: string; email: string; role?: string }> };
  inventory?: Inventory; flows: GeneratedFlow[];
  results: Array<WebRunResult & { flowId: string; runId: string; finishedAt: string }>;
  qualityAudit?: QualityAuditState;
  findingStatuses?: Record<string, FindingWorkflowStatus>;
  workspace?: { projectSlug: string; runLabel: string; projectPath: string; runPath: string; milestonesPath: string };
};

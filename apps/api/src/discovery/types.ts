import type { InventoryPage } from './source-scanner.ts';
import type { ManagedService } from '../project-runner.ts';
import type { WebRunResult } from '../playwright-adapter.ts';
import type { CapabilityProfile } from './capability-model.ts';

export type QualityAuditBrowser = 'chromium' | 'firefox' | 'webkit';
export type QualityAuditViewport = 'desktop' | 'tablet' | 'mobile';
export type QualityAuditConfig = {
  enabled: boolean;
  browsers: QualityAuditBrowser[];
  viewports: QualityAuditViewport[];
  maxRoutes: number;
  routeOffset: number;
  navigationTimeoutMs: number;
};
export type QualityAuditState = {
  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';
  startedAt?: string;
  finishedAt?: string;
  total?: number;
  passed?: number;
  failed?: number;
  browsers?: QualityAuditBrowser[];
  viewports?: QualityAuditViewport[];
  reportPath?: string;
  message?: string;
};

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
export type Inventory = { pages: InventoryPage[]; routes: Array<{ path: string; method: string; source: string }>; api: Array<{ path: string; method: string; source: string }>; filesScanned: number; warnings: string[]; generatedAt: string; capabilities?: CapabilityProfile };
export type GeneratedFlow = { id: string; name: string; source: string; platform: 'web' | 'android'; status: 'READY' | 'REVIEW_REQUIRED' | 'PASSED' | 'FAILED' | 'INFRA_ERROR'; reason?: string; pageId?: string };
export type DiscoveryJob = {
  id: string; name: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
  phase: string; progress: number; createdAt: string; finishedAt?: string; message?: string;
  logs: Array<{ time: string; category: string; message: string }>;
  config: Omit<DiscoveryConfig, 'accounts'> & { accounts: Array<{ name?: string; email: string; role?: string }> };
  inventory?: Inventory; flows: GeneratedFlow[];
  results: Array<WebRunResult & { flowId: string; runId: string; finishedAt: string }>;
  qualityAudit?: QualityAuditState;
  workspace?: { projectSlug: string; runLabel: string; projectPath: string; runPath: string; milestonesPath: string };
};

import type { InventoryPage } from './source-scanner.ts';
import type { ManagedService } from '../project-runner.ts';
import type { WebRunResult } from '../playwright-adapter.ts';

export type DiscoveryConfig = {
  name: string; repositoryUrl: string; ref: string; baseUrl: string;
  runMode: 'managed-local' | 'existing-target' | 'demo'; stack: 'auto' | 'custom' | 'laravel';
  services: ManagedService[]; envUploadId?: string;
  database: { engine: 'none' | 'mysql' | 'postgres' | 'sqlite'; source: 'empty' | 'sql' | 'migrate' | 'seed'; sqlUploadId?: string; migrationCommand?: string; seedCommand?: string; provisionCommand?: string };
  accounts: Array<{ name?: string; email: string; password: string; role?: string }>;
  rules: { maxPages: number; maxDepth: number; includePaths: string[]; excludePaths: string[]; loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string };
  platform: 'web' | 'android'; appId?: string; deviceId?: string; executeFlows: boolean;
  apkUploadId?: string; apkFilename?: string; apkPackageId?: string;
};
export type Inventory = { pages: InventoryPage[]; routes: Array<{ path: string; method: string; source: string }>; api: Array<{ path: string; method: string; source: string }>; filesScanned: number; warnings: string[]; generatedAt: string };
export type GeneratedFlow = { id: string; name: string; source: string; platform: 'web' | 'android'; status: 'READY' | 'REVIEW_REQUIRED' | 'PASSED' | 'FAILED' | 'INFRA_ERROR'; reason?: string; pageId?: string };
export type DiscoveryJob = {
  id: string; name: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
  phase: string; progress: number; createdAt: string; finishedAt?: string; message?: string;
  logs: Array<{ time: string; category: string; message: string }>;
  config: Omit<DiscoveryConfig, 'accounts'> & { accounts: Array<{ name?: string; email: string; role?: string }> };
  inventory?: Inventory; flows: GeneratedFlow[];
  results: Array<WebRunResult & { flowId: string; runId: string; finishedAt: string }>;
};

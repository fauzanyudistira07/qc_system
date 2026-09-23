export type DatabaseConfig = {
  engine: 'none' | 'mysql' | 'postgres' | 'sqlite';
  source: 'empty' | 'sql' | 'migrate' | 'seed';
  sqlUploadId?: string;
  migrationCommand?: string;
  seedCommand?: string;
  provisionCommand?: string;
};

export type TestAccount = { name?: string; email: string; password: string; role?: string };

export type PreparedDatabase = {
  /** Runtime-only. Never serialize this object into jobs, artifacts, or logs. */
  environment: Record<string, string>;
  /** Idempotent; failures are surfaced so callers can retry cleanup. */
  cleanup: () => Promise<void>;
};

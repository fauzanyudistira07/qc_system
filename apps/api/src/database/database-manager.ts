import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { boundedProcess, type ProcessResult } from './process.ts';
import { validateDatabase, validateSql } from './sql-validation.ts';
import type { DatabaseConfig, PreparedDatabase } from './types.ts';

export type { DatabaseConfig, TestAccount, PreparedDatabase } from './types.ts';
export { validateDatabase, validateSql } from './sql-validation.ts';

type PrepareOptions = {
  config: DatabaseConfig; runId: string; networkName: string; workspace: string;
  sqlContent?: string; signal?: AbortSignal; log: (message: string) => void;
};
const OWNER_LABEL = 'qc.database.owner';
const IMAGES = { mysql: 'mysql:8', postgres: 'postgres:16', sqlite: 'python:3.12-alpine' } as const;

function check(result: ProcessResult, operation: string): string {
  if (result.reason || result.code !== 0) throw new Error(`${operation} failed (${result.reason ?? 'non-zero exit'}). No database output is exposed because it may contain credentials or imported data.`);
  return result.stdout.trim();
}

/** Bootstrap only. Application migration/seed/provision commands belong in the service container. */
export async function prepareDatabase(options: PrepareOptions): Promise<PreparedDatabase> {
  const { config, runId, networkName, signal, log } = options;
  const errors = validateDatabase(config);
  if (config.source === 'sql') errors.push(...validateSql(options.sqlContent ?? '', config.engine));
  if (errors.length) throw new Error(errors.join(' '));
  signal?.throwIfAborted();
  if (config.engine === 'none') return { environment: {}, cleanup: async () => {} };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(runId)) throw new Error('Invalid run identifier.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(networkName) || ['host', 'bridge', 'none'].includes(networkName)) throw new Error('A dedicated run network is required.');
  const workspace = await realpath(options.workspace);
  if (!(await lstat(workspace)).isDirectory() || workspace === path.parse(workspace).root) throw new Error('A run workspace directory is required.');
  const docker = (args: string[], extra: { input?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; ignoreAbort?: boolean } = {}) => boundedProcess('docker', args, {
    signal: extra.ignoreAbort ? undefined : signal, timeoutMs: extra.timeoutMs ?? 30_000,
    env: extra.env, input: extra.input, maxOutputBytes: 128 * 1024
  });
  // The project runner creates this network. Never attach to a user-supplied/shared network.
  let network: { Driver: string; Labels?: Record<string, string> };
  try { network = JSON.parse(check(await docker(['network', 'inspect', networkName]), 'Network inspection'))[0]; }
  catch { throw new Error('Cannot inspect the dedicated run network. Ensure Docker is running.'); }
  if (network.Driver !== 'bridge' || network.Labels?.['qc.managed'] !== 'true' || network.Labels?.['qc.run_id'] !== runId) throw new Error('Database requires a bridge network owned by this run (qc.managed=true, qc.run_id).');
  const owner = randomBytes(16).toString('hex');
  const name = `qc-db-${runId.toLowerCase().slice(0,40)}-${owner.slice(0,12)}`;
  let containerId: string | undefined, sqliteDir: string | undefined, cleanupDone = false, cleanupPromise: Promise<void> | undefined;
  const cleanup = (): Promise<void> => {
    if (cleanupDone) return Promise.resolve();
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      // Name fallback handles a lost/timed-out docker create response.
      const inspected = await docker(['container', 'inspect', containerId ?? name, '--format', '{{json .Config.Labels}}'], { ignoreAbort: true });
      if (inspected.code === 0 && !inspected.reason) {
        const labels = JSON.parse(inspected.stdout) as Record<string, string>;
        if (labels[OWNER_LABEL] !== owner || labels['qc.run_id'] !== runId) throw new Error('Cleanup refused: database container ownership changed.');
        check(await docker(['container', 'rm', '--force', '--volumes', containerId ?? name], { ignoreAbort: true }), 'Database cleanup');
      } else {
        // Only a successful listing proves absence; daemon failures must be retried.
        const remaining = check(await docker(['container', 'ls', '-aq', '--filter', `label=${OWNER_LABEL}=${owner}`], { ignoreAbort: true }), 'Database cleanup verification');
        if (remaining) throw new Error('Database cleanup could not confirm container removal. Retry cleanup.');
      }
      if (sqliteDir) {
        const relative = path.relative(workspace, sqliteDir);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Cleanup refused: SQLite directory escaped workspace.');
        await rm(sqliteDir, { recursive: true, force: true });
      }
      cleanupDone = true;
    })().finally(() => { cleanupPromise = undefined; });
    return cleanupPromise;
  };
  try {
    log('Preparing isolated test database.');
    // Pulling is handled by Docker create with a bounded timeout; no global install.
    const common = ['create', '--name', name, '--label', 'qc.managed=true', '--label', `qc.run_id=${runId}`, '--label', `${OWNER_LABEL}=${owner}`,
      '--network', config.engine === 'sqlite' ? 'none' : networkName, '--memory', '768m', '--cpus', '1', '--pids-limit', '256',
      '--security-opt', 'no-new-privileges:true', '--log-driver', 'none'];
    if (config.engine === 'sqlite') {
      // The caller must bind this returned directory into its service at /qc-database.
      // It contains only a generated database, never repository source or executables.
      sqliteDir = await mkdtemp(path.join(workspace, 'database-'));
      if (sqliteDir.includes(',')) throw new Error('SQLite workspace paths cannot contain commas.');
      const importer = [
        'import sqlite3, sys',
        'db = sqlite3.connect("/qc-database/testing.sqlite")',
        'db.enable_load_extension(False)',
        'denied = {sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_CREATE_VTABLE, sqlite3.SQLITE_DROP_VTABLE}',
        'def authorize(action, arg1, arg2, dbname, trigger):',
        '    if action in denied: return sqlite3.SQLITE_DENY',
        '    if action == sqlite3.SQLITE_PRAGMA and (arg1 or "").lower() != "foreign_keys": return sqlite3.SQLITE_DENY',
        '    if action == sqlite3.SQLITE_FUNCTION and (arg2 or "").lower() not in {"length", "lower", "upper", "abs", "coalesce", "ifnull", "datetime", "date", "strftime"}: return sqlite3.SQLITE_DENY',
        '    return sqlite3.SQLITE_OK',
        'db.set_authorizer(authorize)',
        'db.executescript(sys.stdin.read())',
        'db.commit()',
        'db.close()',
        'import os; os.chmod("/qc-database/testing.sqlite", 0o666)'
      ].join('\n');
      containerId = check(await docker([...common, '--read-only', '--cap-drop', 'ALL', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
        '--mount', `type=bind,source=${sqliteDir},target=/qc-database`, '-i', IMAGES.sqlite, 'python', '-c', importer], { timeoutMs: 180_000 }), 'SQLite container creation');
      check(await docker(['start', '-ai', containerId], { input: config.source === 'sql' ? options.sqlContent : '', timeoutMs: 120_000 }), 'SQLite import');
      log('SQLite test database prepared.');
      return { environment: { DB_CONNECTION: 'sqlite', DB_DATABASE: '/qc-database/testing.sqlite', DATABASE_URL: 'sqlite:////qc-database/testing.sqlite', QC_SQLITE_DIRECTORY: sqliteDir, QC_SQLITE_MOUNT: '/qc-database' }, cleanup };
    }
    const password = randomBytes(24).toString('hex'), adminPassword = randomBytes(32).toString('hex');
    const db = 'qc_testing', user = 'qc_app';
    const env: NodeJS.ProcessEnv = { ...process.env };
    const flags: string[] = [];
    if (config.engine === 'mysql') {
      Object.assign(env, { MYSQL_ROOT_PASSWORD: adminPassword, MYSQL_DATABASE: db, MYSQL_USER: user, MYSQL_PASSWORD: password });
      flags.push('--tmpfs', '/var/lib/mysql:rw,nosuid,size=1g', '-e', 'MYSQL_ROOT_PASSWORD', '-e', 'MYSQL_DATABASE', '-e', 'MYSQL_USER', '-e', 'MYSQL_PASSWORD', IMAGES.mysql, '--local-infile=0', '--secure-file-priv=NULL');
    } else {
      Object.assign(env, { POSTGRES_PASSWORD: adminPassword, POSTGRES_USER: 'qc_bootstrap', POSTGRES_DB: db });
      flags.push('--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=1g', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER', '-e', 'POSTGRES_DB', IMAGES.postgres);
    }
    containerId = check(await docker([...common, ...flags], { env, timeoutMs: 180_000 }), 'Database container creation');
    check(await docker(['start', containerId]), 'Database startup');
    const mysql = ['mysql', '--host=127.0.0.1', `--user=${user}`, `--database=${db}`, '--connect-timeout=3', '--batch', '--skip-column-names', '--local-infile=0', '--binary-mode=1'];
    const postgres = ['psql', '--no-psqlrc', '--host=127.0.0.1', '--username=qc_bootstrap', `--dbname=${db}`, '--set=ON_ERROR_STOP=1', '--no-password'];
    const deadline = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const result = await docker(['exec', '-i', '-e', config.engine === 'mysql' ? 'MYSQL_PWD' : 'PGPASSWORD', containerId,
        ...(config.engine === 'mysql' ? mysql : postgres)], { input: 'SELECT 1;\n', env: { ...process.env, MYSQL_PWD: password, PGPASSWORD: adminPassword, PGCONNECT_TIMEOUT: '3' }, timeoutMs: 5_000 });
      if (result.code === 0 && !result.reason) { ready = true; break; }
      if (result.reason === 'aborted') signal?.throwIfAborted();
      await delay(750, undefined, { signal });
    }
    if (!ready) throw new Error('Test database was not ready within 120 seconds.');
    if (config.engine === 'postgres') {
      // Only bootstrap uses the administrator. The dump is always imported as qc_app.
      check(await docker(['exec', '-i', '-e', 'PGPASSWORD', containerId, ...postgres], {
        env: { ...process.env, PGPASSWORD: adminPassword }, input: `CREATE ROLE ${user} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;\nREVOKE ALL ON DATABASE ${db} FROM PUBLIC;\nGRANT CONNECT, TEMPORARY ON DATABASE ${db} TO ${user};\nREVOKE ALL ON SCHEMA public FROM PUBLIC;\nGRANT USAGE, CREATE ON SCHEMA public TO ${user};\n`
      }), 'Scoped database account creation');
    }
    if (config.source === 'sql') {
      log('Importing validated SQL into the run database.');
      check(await docker(['exec', '-i', '-e', config.engine === 'mysql' ? 'MYSQL_PWD' : 'PGPASSWORD', containerId,
        ...(config.engine === 'mysql' ? mysql : ['psql', '--no-psqlrc', '--host=127.0.0.1', `--username=${user}`, `--dbname=${db}`, '--set=ON_ERROR_STOP=1', '--no-password', '--single-transaction'])],
      { input: options.sqlContent, env: { ...process.env, MYSQL_PWD: password, PGPASSWORD: password }, timeoutMs: 120_000 }), 'SQL import');
    }
    const port = config.engine === 'mysql' ? '3306' : '5432';
    const connection = config.engine === 'mysql' ? 'mysql' : 'pgsql';
    log('Test database is ready. Application bootstrap commands may now run in the service container.');
    return { environment: {
      DB_CONNECTION: connection, DB_HOST: name, DB_PORT: port, DB_DATABASE: db, DB_USERNAME: user, DB_PASSWORD: password,
      DATABASE_URL: `${config.engine === 'mysql' ? 'mysql' : 'postgresql'}://${user}:${password}@${name}:${port}/${db}`,
      ...(config.engine === 'mysql' ? { MYSQL_HOST: name, MYSQL_TCP_PORT: port, MYSQL_DATABASE: db, MYSQL_USER: user, MYSQL_PASSWORD: password }
        : { PGHOST: name, PGPORT: port, PGDATABASE: db, PGUSER: user, PGPASSWORD: password })
    }, cleanup };
  } catch (error) {
    try { await cleanup(); } catch { throw new Error('Database setup failed and automatic cleanup could not finish. Retry cleanup of run-owned database resources.'); }
    throw error;
  }
}

import type { DatabaseConfig } from './types.ts';

export const MAX_SQL_BYTES = 32 * 1024 * 1024;

export function validateDatabase(config: DatabaseConfig): string[] {
  const errors: string[] = [];
  if (!config || !['none', 'mysql', 'postgres', 'sqlite'].includes(config.engine)) return ['Select a supported database engine.'];
  if (!['empty', 'sql', 'migrate', 'seed'].includes(config.source)) errors.push('Select a supported database source.');
  if (config.engine === 'none' && (config.source !== 'empty' || config.sqlUploadId || config.migrationCommand || config.seedCommand || config.provisionCommand)) errors.push('Database commands and uploads require a database engine.');
  if (config.source === 'migrate' && !config.migrationCommand?.trim()) errors.push('Migration source requires an explicit migration command.');
  if (config.source === 'seed' && !config.seedCommand?.trim()) errors.push('Seed source requires an explicit seeder command.');
  if (config.sqlUploadId && !/^[a-zA-Z0-9_-]{1,128}$/.test(config.sqlUploadId)) errors.push('Invalid SQL upload identifier.');
  for (const key of ['migrationCommand', 'seedCommand', 'provisionCommand'] as const) {
    const value = config[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 4096 || /[\0\r\n]/.test(value))) errors.push('Database commands must be single-line strings of at most 4096 characters.');
  }
  return errors;
}

/** Deliberately conservative dump subset; this is defense in depth, not a SQL sandbox. */
export function validateSql(text: string, engine: DatabaseConfig['engine']): string[] {
  if (!['mysql', 'postgres', 'sqlite'].includes(engine)) return ['SQL import requires a database engine.'];
  if (typeof text !== 'string' || !text.trim()) return ['SQL dump is empty.'];
  if (Buffer.byteLength(text) > MAX_SQL_BYTES) return ['SQL dump exceeds the 32 MiB limit.'];
  if (text.includes('\0')) return ['SQL dump contains binary data. Export a plain SQL dump.'];
  const errors = new Set<string>();
  // COPY data is not SQL. Remove it before lexing, but only accept the literal stdin form.
  let source = text.replace(/^COPY\s+([^\r\n]+)\s+FROM\s+stdin;\r?\n[\s\S]*?^\\\.\s*$/gim, (block: string, target: string) => {
    if (engine !== 'postgres' || !/^(?:public\.)?(?:"[\w]+"|[\w]+)\s*\((?:[\w",\s]+)\)$/i.test(target.trim())) errors.add('Only PostgreSQL COPY table (columns) FROM stdin is supported.');
    return `COPY ${target} FROM stdin;`;
  });
  let sql = '';
  for (let i = 0; i < source.length;) {
    const c = source[i], next = source[i + 1];
    if (c === '-' && next === '-' || c === '#' && engine === 'mysql') {
      const end = source.indexOf('\n', i); i = end < 0 ? source.length : end + 1; sql += ' '; continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) { errors.add('Unterminated SQL comment.'); break; }
      if (source[i + 2] === '!' || source.slice(i + 2, i + 4).toUpperCase() === 'M!') errors.add('Executable version comments are unsupported. Export without executable comments.');
      sql += ' '; i = end + 2; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c; let content = '', closed = false; i++;
      while (i < source.length) {
        if (source[i] === '\\') { content += '__'; i += 2; continue; }
        if (source[i] === quote) {
          if (source[i + 1] === quote) { content += '_'; i += 2; continue; }
          closed = true; i++; break;
        }
        content += source[i++];
      }
      if (!closed) errors.add('Unterminated SQL string or identifier.');
      sql += quote === "'" ? "'VALUE'" : ` ${content.replace(/[^\w.$]/g, '_')} `;
      continue;
    }
    if (c === '\\' || c === '$' && /^\$(?:[A-Za-z_][\w]*)?\$/.test(source.slice(i))) errors.add('Client commands and dollar-quoted executable blocks are unsupported.');
    sql += c; i++;
  }
  if (/\b(?:USE|DATABASE|SCHEMA|TABLESPACE|DEFINER|GRANT|REVOKE|ROLE|USER|PASSWORD|SUPERUSER|EXTENSION|TRIGGER|PROCEDURE|FUNCTION|EVENT|SERVER|FOREIGN\s+DATA|PROGRAM|INFILE|OUTFILE|DUMPFILE|LOAD_FILE|LOAD_EXTENSION|ATTACH|DETACH|VACUUM|INTO\s+DIRECTORY|SET\s+GLOBAL|SET\s+PERSIST|ALTER\s+SYSTEM)\b/i.test(sql)) errors.add('Dump contains database switching, privileges, executable objects, or filesystem/server operations. Export only application tables and data.');
  if (/\b(?:mysql|sys|performance_schema|information_schema|pg_catalog|pg_toast)\s*\./i.test(sql)) errors.add('System database references are forbidden.');
  for (const match of sql.matchAll(/\b([a-zA-Z_][\w$]*)\s*\.\s*[a-zA-Z_][\w$]*/g)) {
    if (!(engine === 'postgres' && match[1].toLowerCase() === 'public')) errors.add('Qualified cross-database references are unsupported; export unqualified tables (PostgreSQL public is allowed).');
  }
  for (const part of sql.split(';')) {
    const statement = part.trim(); if (!statement) continue;
    if (/^(?:BEGIN(?:\s+TRANSACTION)?|START\s+TRANSACTION|COMMIT|ROLLBACK)$/i.test(statement)) continue;
    if (/^(?:CREATE\s+(?:TABLE|(?:UNIQUE\s+)?INDEX|SEQUENCE)|ALTER\s+(?:TABLE|SEQUENCE)|DROP\s+(?:TABLE|INDEX|SEQUENCE)|INSERT\s+INTO)\b/i.test(statement)) {
      if (/\b(?:SELECT|EXECUTE|CALL|DO|WITH|INHERITS|PARTITION|OWNER|SECURITY|ACCESS\s+METHOD|ENGINE\s*=\s*(?!InnoDB\b|MyISAM\b|MEMORY\b)\w+)\b/i.test(statement)) errors.add('Dump contains unsupported executable or server-specific table definitions.');
      continue;
    }
    if (engine === 'postgres' && /^COPY\s+(?:public\s*\.\s*)?\w+\s*\([\w\s,]+\)\s+FROM\s+stdin$/i.test(statement)) continue;
    if (engine === 'postgres' && /^SELECT\s+(?:pg_catalog\s*\.\s*)?setval\s*\(\s*'VALUE'\s*,\s*\d+\s*,\s*(?:true|false)\s*\)$/i.test(statement)) continue;
    if (engine === 'sqlite' && /^PRAGMA\s+foreign_keys\s*=\s*(?:ON|OFF|0|1)$/i.test(statement)) continue;
    if (engine === 'mysql' && /^SET\s+(?:NAMES\s+(?:utf8mb4|utf8)|(?:FOREIGN_KEY_CHECKS|UNIQUE_CHECKS)\s*=\s*[01])$/i.test(statement)) continue;
    if (engine === 'postgres' && /^SET\s+(?:statement_timeout|lock_timeout|idle_in_transaction_session_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security)\s*=\s*(?:\d+|on|off|content|warning|'VALUE')$/i.test(statement)) continue;
    errors.add('Unsupported SQL statement. Use a single-database tables/data dump without client commands, ownership, grants, routines, or custom SQL.');
  }
  return [...errors];
}

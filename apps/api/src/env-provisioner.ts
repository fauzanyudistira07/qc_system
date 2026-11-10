import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { copyFile, opendir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EnvProvisionEntry, EnvProvisionResult } from './discovery/types.ts';
import { GeminiService } from './gemini-service.ts';

const TEMPLATE_PRIORITY = [
  '.env.example',
  'example.env',
  '.env.sample',
  '.env.dist',
  '.env.template',
];

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  '.next',
  '.dart_tool',
  '.gradle',
  'storage',
  '.qc-artifacts',
]);

function isPlaceholder(value: string): boolean {
  const cleaned = value.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return true;
  if (/^(?:null|none|undefined|your[_-].*|changeme.*|change_me.*|replace[_-].*|example.*|secret.*|insert_.*|todo.*|<[^>]+>|\*+)$/i.test(cleaned)) {
    return true;
  }
  return cleaned === 'base64:' || cleaned === 'SomeRandomString';
}

function parseEnvLines(raw: string): Array<{ type: 'kv'; key: string; value: string; comment?: string } | { type: 'raw'; line: string }> {
  const out: Array<{ type: 'kv'; key: string; value: string; comment?: string } | { type: 'raw'; line: string }> = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      out.push({ type: 'raw', line });
      continue;
    }
    const key = match[1];
    let val = match[2] ?? '';
    let inlineComment: string | undefined;
    if (!val.startsWith('"') && !val.startsWith("'")) {
      const hashIdx = val.indexOf(' #');
      if (hashIdx >= 0) {
        inlineComment = val.slice(hashIdx);
        val = val.slice(0, hashIdx);
      }
    }
    out.push({ type: 'kv', key, value: val.trim(), comment: inlineComment });
  }
  return out;
}

function serializeEnvValue(val: string): string {
  if (/[\s#"'`$]/.test(val)) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return val;
}

async function discoverTemplateDirectories(rootDir: string, maxDepth = 3): Promise<Array<{ dir: string; templatePath: string }>> {
  const found: Array<{ dir: string; templatePath: string }> = [];

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let templatePath: string | undefined;
    for (const candidate of TEMPLATE_PRIORITY) {
      const candidatePath = path.join(dir, candidate);
      try {
        const s = await stat(candidatePath);
        if (s.isFile()) {
          templatePath = candidatePath;
          break;
        }
      } catch {}
    }
    const existingEnvPath = path.join(dir, '.env');
    const hasExistingEnv = fs.existsSync(existingEnvPath);
    if (templatePath || hasExistingEnv) {
      found.push({ dir, templatePath: templatePath || existingEnvPath });
    }

    let handle;
    try {
      handle = await opendir(dir);
    } catch {
      return;
    }
    for await (const entry of handle) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(rootDir, 0);
  return found;
}

function randomSecretHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

function laravelAppKey(): string {
  return `base64:${randomBytes(32).toString('base64')}`;
}

function safePortFromUrl(url: string | undefined, fallback: number): string {
  if (!url) return String(fallback);
  try {
    const parsed = new URL(url);
    return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch {
    return String(fallback);
  }
}

function buildDemoReplacements(options: {
  dir: string;
  rootDir: string;
  frontendUrl: string;
  backendUrl: string;
  platform: 'web' | 'android';
  dbEnv: Record<string, string>;
}): { map: Record<string, string>; secrets: string[] } {
  const relDir = path.relative(options.rootDir, options.dir).toLowerCase();
  const isMobileDir = options.platform === 'android' && (relDir.includes('mobile') || fs.existsSync(path.join(options.dir, 'pubspec.yaml')));
  const isLaravel = fs.existsSync(path.join(options.dir, 'artisan')) || fs.existsSync(path.join(options.dir, 'composer.json'));
  const bePort = safePortFromUrl(options.backendUrl, 8000);
  const fePort = safePortFromUrl(options.frontendUrl, 5173);
  const resolvedApiForClient = isMobileDir ? `http://10.0.2.2:${bePort}` : options.backendUrl;

  const jwtSecret = randomSecretHex(32);
  const sessionSecret = randomSecretHex(24);
  const appSecret = randomSecretHex(24);
  const appKey = laravelAppKey();
  const secrets = [jwtSecret, sessionSecret, appSecret, appKey];

  const dbConn = options.dbEnv.DB_CONNECTION || (options.dbEnv.DATABASE_URL?.startsWith('postgres') ? 'pgsql' : 'mysql');
  const dbHost = options.dbEnv.DB_HOST || '127.0.0.1';
  const dbPort = options.dbEnv.DB_PORT || (dbConn === 'pgsql' ? '5432' : '3306');
  const dbName = options.dbEnv.DB_DATABASE || 'qc_sandbox';
  const dbUser = options.dbEnv.DB_USERNAME || 'qc_tester';
  const dbPass = options.dbEnv.DB_PASSWORD || '';
  if (dbPass) secrets.push(dbPass);

  const map: Record<string, string> = {
    APP_ENV: 'local',
    NODE_ENV: 'development',
    APP_DEBUG: 'true',
    APP_URL: isLaravel ? options.backendUrl : options.frontendUrl,
    FRONTEND_URL: options.frontendUrl,
    CORS_ALLOWED_ORIGINS: `${options.frontendUrl},http://127.0.0.1:${fePort},http://localhost:${fePort}`,
    SANCTUM_STATEFUL_DOMAINS: `127.0.0.1:${fePort},localhost:${fePort},127.0.0.1`,
    BACKEND_URL: resolvedApiForClient,
    API_URL: resolvedApiForClient,
    API_BASE_URL: resolvedApiForClient,
    BASE_URL: isMobileDir ? resolvedApiForClient : options.frontendUrl,
    VITE_API_URL: resolvedApiForClient,
    VITE_API_BASE_URL: resolvedApiForClient,
    VITE_BACKEND_URL: resolvedApiForClient,
    NEXT_PUBLIC_API_URL: resolvedApiForClient,
    NEXT_PUBLIC_API_BASE_URL: resolvedApiForClient,
    NUXT_PUBLIC_API_BASE: resolvedApiForClient,
    REACT_APP_API_URL: resolvedApiForClient,
    PORT: isLaravel ? bePort : fePort,
    APP_KEY: isLaravel ? appKey : appSecret,
    JWT_SECRET: jwtSecret,
    AUTH_SECRET: jwtSecret,
    NEXTAUTH_SECRET: jwtSecret,
    NEXTAUTH_URL: options.frontendUrl,
    SESSION_SECRET: sessionSecret,
    COOKIE_SECRET: sessionSecret,
    ENCRYPTION_KEY: randomSecretHex(16),
    DB_CONNECTION: dbConn,
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_DATABASE: dbName,
    DB_NAME: dbName,
    DB_USERNAME: dbUser,
    DB_USER: dbUser,
    DB_PASSWORD: dbPass,
    DB_PASS: dbPass,
    MAIL_MAILER: 'log',
    MAIL_DRIVER: 'log',
    QUEUE_CONNECTION: 'sync',
    CACHE_DRIVER: 'file',
    CACHE_STORE: 'file',
    SESSION_DRIVER: 'file',
    BROADCAST_DRIVER: 'log',
    BROADCAST_CONNECTION: 'log',
    FILESYSTEM_DISK: 'local',
    LOG_CHANNEL: 'stack',
  };

  if (options.dbEnv.DATABASE_URL) {
    map.DATABASE_URL = options.dbEnv.DATABASE_URL;
  }

  for (const [k, v] of Object.entries(options.dbEnv)) {
    if (v !== undefined && v !== '') {
      map[k] = v;
    }
  }

  return { map, secrets };
}

function heuristicFallbackValue(key: string): string {
  const upper = key.toUpperCase();
  if (/ENABLED|ACTIVE|ALLOW|ENABLE/.test(upper)) return 'true';
  if (/PORT/.test(upper)) return '8000';
  if (/TIMEOUT|TTL|EXPIR/.test(upper)) return '3600';
  if (/HOST/.test(upper)) return '127.0.0.1';
  if (/URL|ENDPOINT/.test(upper)) return 'http://127.0.0.1:8000';
  if (/EMAIL|MAIL_FROM_ADDRESS/.test(upper)) return 'demo-sandbox@local.qc';
  if (/NAME/.test(upper)) return 'QCSandboxDemo';
  if (/SECRET|TOKEN|KEY|SALT|SIGN/.test(upper)) return randomSecretHex(16);
  return 'qc_demo_value';
}

export async function provisionEnvFiles(options: {
  sourceDir: string;
  platform: 'web' | 'android';
  frontendUrl: string;
  backendUrl: string;
  dbEnv?: Record<string, string>;
  uploadedEnvFilePath?: string;
  rootDir?: string;
}): Promise<EnvProvisionResult> {
  const warnings: string[] = [];
  const entries: EnvProvisionEntry[] = [];
  const secretsToRedact = new Set<string>();
  const dbEnv = options.dbEnv ?? {};

  // Load explicit uploaded .env overrides if provided by user
  const uploadedKv = new Map<string, string>();
  if (options.uploadedEnvFilePath) {
    try {
      const uploadedRaw = await readFile(options.uploadedEnvFilePath, 'utf8');
      for (const parsed of parseEnvLines(uploadedRaw)) {
        if (parsed.type === 'kv') {
          uploadedKv.set(parsed.key, parsed.value.replace(/^["']|["']$/g, ''));
          if (/key|secret|token|password/i.test(parsed.key) && parsed.value.length >= 6) {
            secretsToRedact.add(parsed.value.replace(/^["']|["']$/g, ''));
          }
        }
      }
    } catch {
      warnings.push(`File env upload tidak terbaca: ${options.uploadedEnvFilePath}`);
    }
  }

  const dirs = await discoverTemplateDirectories(options.sourceDir);
  if (dirs.length === 0) {
    // Still synthesize root .env so backend/frontend scripts have sane demo defaults
    const rootEnvPath = path.join(options.sourceDir, '.env');
    const { map, secrets } = buildDemoReplacements({
      dir: options.sourceDir,
      rootDir: options.sourceDir,
      frontendUrl: options.frontendUrl,
      backendUrl: options.backendUrl,
      platform: options.platform,
      dbEnv,
    });
    for (const s of secrets) secretsToRedact.add(s);
    const lines = Object.entries(map).map(([k, v]) => `${k}=${serializeEnvValue(uploadedKv.get(k) ?? v)}`);
    await writeFile(rootEnvPath, `${lines.join('\n')}\n`, 'utf8');
    entries.push({
      directory: '.',
      templateFile: '(auto-synthesized)',
      targetEnvFile: '.env',
      keysPopulated: Object.keys(map),
      aiInferredKeys: [],
      notes: ['Tidak ditemukan .env.example / example.env; .env demo dibuat otomatis untuk sandbox.'],
    });
    return { entries, warnings, secretsToRedact: [...secretsToRedact] };
  }

  for (const target of dirs) {
    const templateRaw = await readFile(target.templatePath, 'utf8').catch(() => '');
    const parsedLines = parseEnvLines(templateRaw);
    const existingEnvPath = path.join(target.dir, '.env');
    const existingKv = new Map<string, string>();
    if (fs.existsSync(existingEnvPath)) {
      const existingRaw = await readFile(existingEnvPath, 'utf8').catch(() => '');
      for (const item of parseEnvLines(existingRaw)) {
        if (item.type === 'kv') existingKv.set(item.key, item.value);
      }
    }

    const { map: demoMap, secrets } = buildDemoReplacements({
      dir: target.dir,
      rootDir: options.sourceDir,
      frontendUrl: options.frontendUrl,
      backendUrl: options.backendUrl,
      platform: options.platform,
      dbEnv,
    });
    for (const s of secrets) secretsToRedact.add(s);

    const unknownKeys: string[] = [];
    for (const item of parsedLines) {
      if (item.type !== 'kv') continue;
      if (uploadedKv.has(item.key) || Object.prototype.hasOwnProperty.call(demoMap, item.key)) continue;
      const existing = existingKv.get(item.key);
      if (existing && !isPlaceholder(existing)) continue;
      if (isPlaceholder(item.value)) {
        unknownKeys.push(item.key);
      }
    }

    const aiHints: Record<string, string> = {};
    const aiInferredKeys: string[] = [];
    if (unknownKeys.length > 0 && GeminiService.isConfigured()) {
      const inferred = await GeminiService.inferEnvAndAuthSchema({
        unknownEnvKeys: unknownKeys,
        authSnippets: [],
        routeSnippets: [],
      }).catch(() => null);
      if (inferred?.envHints) {
        for (const k of unknownKeys) {
          const hint = inferred.envHints[k];
          if (typeof hint === 'string' && hint.trim() && !isPlaceholder(hint)) {
            aiHints[k] = hint.trim();
            aiInferredKeys.push(k);
          }
        }
      }
    }

    const writtenKeys = new Set<string>();
    const outLines: string[] = [];
    for (const item of parsedLines) {
      if (item.type === 'raw') {
        outLines.push(item.line);
        continue;
      }
      const { key, value, comment } = item;
      let chosen: string;
      const isForceOverrideKey =
        key.startsWith('DB_') ||
        key === 'DATABASE_URL' ||
        key === 'APP_URL' ||
        key === 'FRONTEND_URL' ||
        key === 'BACKEND_URL' ||
        key === 'API_URL' ||
        key === 'API_BASE_URL' ||
        key === 'VITE_API_URL' ||
        key === 'VITE_API_BASE_URL' ||
        key === 'NEXT_PUBLIC_API_URL' ||
        key === 'MAIL_MAILER' ||
        key === 'MAIL_DRIVER' ||
        key === 'QUEUE_CONNECTION' ||
        key === 'CACHE_DRIVER' ||
        key === 'CACHE_STORE';

      if (uploadedKv.has(key)) {
        chosen = uploadedKv.get(key)!;
      } else if (isForceOverrideKey && Object.prototype.hasOwnProperty.call(demoMap, key)) {
        chosen = demoMap[key];
      } else if (existingKv.has(key) && !isPlaceholder(existingKv.get(key)!)) {
        chosen = existingKv.get(key)!.replace(/^["']|["']$/g, '');
      } else if (Object.prototype.hasOwnProperty.call(demoMap, key)) {
        chosen = demoMap[key];
      } else if (!isPlaceholder(value)) {
        chosen = value.replace(/^["']|["']$/g, '');
      } else if (aiHints[key]) {
        chosen = aiHints[key];
      } else {
        chosen = heuristicFallbackValue(key);
      }

      if (/secret|password|key|token/i.test(key) && chosen.length >= 6) {
        secretsToRedact.add(chosen);
      }
      writtenKeys.add(key);
      outLines.push(`${key}=${serializeEnvValue(chosen)}${comment || ''}`);
    }

    // Ensure critical DB & URL keys are present even if omitted in template
    const mustEnsure = ['APP_KEY', 'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'APP_URL'];
    for (const reqKey of mustEnsure) {
      if (!writtenKeys.has(reqKey) && Object.prototype.hasOwnProperty.call(demoMap, reqKey)) {
        if (reqKey === 'APP_KEY' && !fs.existsSync(path.join(target.dir, 'artisan'))) continue;
        outLines.push(`${reqKey}=${serializeEnvValue(demoMap[reqKey])}`);
        writtenKeys.add(reqKey);
      }
    }

    await writeFile(existingEnvPath, `${outLines.join('\n')}\n`, 'utf8');

    const relDir = path.relative(options.sourceDir, target.dir) || '.';
    entries.push({
      directory: relDir,
      templateFile: path.basename(target.templatePath),
      targetEnvFile: path.relative(options.sourceDir, existingEnvPath),
      keysPopulated: [...writtenKeys],
      aiInferredKeys,
      notes: [
        `Dibuat dari ${path.basename(target.templatePath)} dengan kredensial DB sandbox dan secret demo acak.`,
        ...(aiInferredKeys.length > 0 ? [`${aiInferredKeys.length} key tambahan diisi bersama Gemini.`] : []),
      ],
    });
  }

  return {
    entries,
    warnings,
    secretsToRedact: [...secretsToRedact],
  };
}

export async function copyUploadedEnvIfExists(uploadedEnvFilePath: string, destinationDir: string): Promise<boolean> {
  try {
    const info = await stat(uploadedEnvFilePath);
    if (!info.isFile()) return false;
    await copyFile(uploadedEnvFilePath, path.join(destinationDir, '.env'));
    return true;
  } catch {
    return false;
  }
}

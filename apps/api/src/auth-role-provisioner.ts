import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { opendir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ProvisionedRoleAccount } from './discovery/types.ts';
import { GeminiService } from './gemini-service.ts';

const execFileAsync = promisify(execFile);

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

const ROLE_NOISE = new Set([
  'auth', 'guest', 'web', 'api', 'sanctum', 'verified', 'throttle', 'cors', 'true', 'false',
  'null', 'undefined', 'string', 'number', 'object', 'array', 'required', 'nullable',
  'get', 'post', 'put', 'patch', 'delete', 'middleware', 'role', 'roles', 'id', 'name',
]);

export type RuntimeRoleCredential = {
  role: string;
  name: string;
  identifier: string;
  identifierField: string;
  password: string;
  token?: string;
  loginPath: string;
  homePath?: string;
  source: ProvisionedRoleAccount['source'];
  verified: boolean;
  verificationNote?: string;
};

export type DiscoveredAuthSchema = {
  roles: string[];
  identifierField: string;
  loginPath: string;
  loginEndpoints: string[];
  registerEndpoints: string[];
  seederAccounts: Array<{ role: string; identifier: string; password: string }>;
};

function sanitizeRole(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function generateRunPassword(): string {
  return `QcSandbox#${randomBytes(5).toString('hex')}`;
}

function generateIdentifier(role: string, field: string, index: number): string {
  const slug = sanitizeRole(role) || `role${index}`;
  if (/email/i.test(field)) return `qc.${slug}@sandbox.local`;
  if (/phone|hp|telp|wa/i.test(field)) return `08120001${String(100 + index).padStart(3, '0')}`;
  if (/nis|nim|nip|nik|code|kode/i.test(field)) return `9001${String(10 + index).padStart(3, '0')}`;
  return `qc_${slug}_demo`;
}

async function scanAuthAndRoleFiles(sourceDir: string): Promise<{
  roles: Set<string>;
  identifierVotes: Record<string, number>;
  loginPaths: Set<string>;
  loginEndpoints: Set<string>;
  registerEndpoints: Set<string>;
  seederAccounts: Array<{ role: string; identifier: string; password: string }>;
  authSnippets: string[];
  routeSnippets: string[];
}> {
  const roles = new Set<string>();
  const identifierVotes: Record<string, number> = { email: 0, username: 0, nis: 0, nip: 0, phone: 0 };
  const loginPaths = new Set<string>();
  const loginEndpoints = new Set<string>();
  const registerEndpoints = new Set<string>();
  const seederAccounts: Array<{ role: string; identifier: string; password: string }> = [];
  const authSnippets: string[] = [];
  const routeSnippets: string[] = [];

  let filesVisited = 0;

  async function walk(dir: string, depth: number) {
    if (depth > 6 || filesVisited >= 1500) return;
    let handle;
    try {
      handle = await opendir(dir);
    } catch {
      return;
    }
    for await (const entry of handle) {
      if (filesVisited >= 1500) break;
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(path.join(dir, entry.name), depth + 1);
        }
        continue;
      }
      if (!/\.(?:[cm]?[jt]sx?|vue|svelte|php|py|dart|kt|java|sql|blade\.php)$/i.test(entry.name)) continue;
      filesVisited++;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(sourceDir, abs).replace(/\\/g, '/');
      const content = await readFile(abs, 'utf8').catch(() => '');
      if (!content || content.length > 300_000) continue;

      const isAuthRelevant = /(?:auth|login|register|role|user|seed|migration|route|middleware|guard|permission|acl)/i.test(rel) ||
        /(?:Hash::make|bcrypt|password_hash|middleware\(|allowedRoles|role\s*[:=]|login)/i.test(content);

      if (!isAuthRelevant) continue;

      if (authSnippets.length < 10 && /(?:login|auth|seed|role)/i.test(rel)) {
        authSnippets.push(`// ${rel}\n${content.slice(0, 600)}`);
      }
      if (routeSnippets.length < 25 && /(?:route|router|app\.|Route::)/i.test(rel + '\n' + content.slice(0, 400))) {
        routeSnippets.push(`${rel}`);
      }

      // 1. Role detections from middleware / enums / arrays
      for (const m of content.matchAll(/role[s]?\s*:\s*([a-zA-Z0-9_|, -]+)/gi)) {
        for (const candidate of m[1].split(/[|,]/)) {
          const clean = sanitizeRole(candidate);
          if (clean.length >= 2 && clean.length <= 28 && !ROLE_NOISE.has(clean)) roles.add(clean);
        }
      }
      for (const m of content.matchAll(/enum\s*\(\s*['"](?:role|user_role|tipe|type)['"]\s*,\s*\[([^\]]+)\]/gi)) {
        for (const item of m[1].matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)) {
          const clean = sanitizeRole(item[1]);
          if (clean.length >= 2 && !ROLE_NOISE.has(clean)) roles.add(clean);
        }
      }
      for (const m of content.matchAll(/(?:allowedRoles|roles|hasRole|role\s*===?|userRole\s*===?)\s*(?:\(|:|\[|\s)*['"]([a-zA-Z0-9_-]+)['"]/gi)) {
        const clean = sanitizeRole(m[1]);
        if (clean.length >= 2 && clean.length <= 28 && !ROLE_NOISE.has(clean)) roles.add(clean);
      }
      for (const m of content.matchAll(/['"]role['"]\s*=>\s*['"]([a-zA-Z0-9_-]+)['"]/gi)) {
        const clean = sanitizeRole(m[1]);
        if (clean.length >= 2 && !ROLE_NOISE.has(clean)) roles.add(clean);
      }

      // 2. Identifier field detection inside login / auth logic
      if (/login|signin|auth/i.test(rel + content.slice(0, 1500))) {
        if (/\bnis[n]?\b/i.test(content)) identifierVotes.nis += 2;
        if (/\bnip\b/i.test(content)) identifierVotes.nip += 2;
        if (/\busername\b/i.test(content)) identifierVotes.username += 2;
        if (/\b(?:phone|no_hp|telepon|mobile)\b/i.test(content)) identifierVotes.phone += 1;
        if (/\bemail\b/i.test(content)) identifierVotes.email += 2;
      }

      // 3. Login & Register path discovery
      for (const m of content.matchAll(/['"](\/(?:api\/(?:v\d+\/)?)?(?:auth\/)?(?:login|sign-in|signin))['"]/gi)) {
        const p = m[1];
        if (p.includes('/api/')) loginEndpoints.add(p);
        else loginPaths.add(p);
      }
      for (const m of content.matchAll(/['"](\/(?:api\/(?:v\d+\/)?)?(?:auth\/)?(?:register|signup|sign-up))['"]/gi)) {
        registerEndpoints.add(m[1]);
      }

      // 4. Seeder demo credentials extraction (Laravel / JS seeder blocks)
      if (/seed|factory|fixture|\.sql$/i.test(rel)) {
        for (const block of content.matchAll(/\{[^{}]{10,450}\}|\[[^\[\]]{10,450}\]/g)) {
          const text = block[0];
          const emailMatch = /['"](?:email|username|nis)['"]\s*(?:=>|:)\s*['"]([^'"]+)['"]/i.exec(text);
          const roleMatch = /['"]role['"]\s*(?:=>|:)\s*['"]([a-zA-Z0-9_-]+)['"]/i.exec(text);
          const passLiteralMatch = /(?:Hash::make|bcrypt|password_hash|bcryptSync)\s*\(\s*['"]([^'"]+)['"]\s*\)/i.exec(text);
          const plainPassMatch = /['"]password['"]\s*(?:=>|:)\s*['"]([^'"$]{4,40})['"]/i.exec(text);
          const pwd = passLiteralMatch?.[1] || plainPassMatch?.[1];
          if (emailMatch?.[1] && pwd) {
            const roleName = sanitizeRole(roleMatch?.[1] || (emailMatch[1].includes('admin') ? 'admin' : 'user'));
            if (roleName) {
              roles.add(roleName);
              seederAccounts.push({ role: roleName, identifier: emailMatch[1], password: pwd });
            }
          }
        }
      }
    }
  }

  await walk(sourceDir, 0);
  return { roles, identifierVotes, loginPaths, loginEndpoints, registerEndpoints, seederAccounts, authSnippets, routeSnippets };
}

export async function discoverAuthSchema(sourceDir: string, fallbackToDefaultUser = true): Promise<DiscoveredAuthSchema> {
  const scanned = await scanAuthAndRoleFiles(sourceDir);

  let aiSchema = null;
  if (GeminiService.isConfigured() && (scanned.authSnippets.length > 0 || scanned.roles.size === 0)) {
    aiSchema = await GeminiService.inferEnvAndAuthSchema({
      unknownEnvKeys: [],
      authSnippets: scanned.authSnippets,
      routeSnippets: scanned.routeSnippets,
    }).catch(() => null);
  }

  const allRoles = new Set<string>(scanned.roles);
  if (aiSchema?.roles) {
    for (const r of aiSchema.roles) {
      const clean = sanitizeRole(r);
      if (clean && !ROLE_NOISE.has(clean)) allRoles.add(clean);
    }
  }
  if (allRoles.size === 0 && fallbackToDefaultUser) {
    allRoles.add('user');
  }

  const bestVote = Object.entries(scanned.identifierVotes).sort((a, b) => b[1] - a[1])[0];
  const identifierField = aiSchema?.identifierField || (bestVote && bestVote[1] > 0 ? bestVote[0] : 'email');

  const loginPath = [...scanned.loginPaths][0] || aiSchema?.loginPath || '/login';
  const loginEndpoints = [...new Set([
    ...scanned.loginEndpoints,
    ...(aiSchema?.authEndpoints || []),
    '/api/v1/web/auth/login',
    '/api/v1/auth/login',
    '/api/v1/login',
    '/api/login',
    '/api/auth/login',
    '/login',
  ])];
  const registerEndpoints = [...new Set([
    ...scanned.registerEndpoints,
    '/api/v1/register',
    '/api/register',
    '/api/auth/register',
    '/register',
  ])];

  return {
    roles: [...allRoles].slice(0, 8),
    identifierField,
    loginPath,
    loginEndpoints,
    registerEndpoints,
    seederAccounts: scanned.seederAccounts,
  };
}

async function tryApiLogin(
  backendUrl: string,
  endpoints: string[],
  identifierField: string,
  identifier: string,
  password: string
): Promise<{ ok: boolean; token?: string; note: string }> {
  const base = backendUrl.replace(/\/+$/, '');
  const payloadVariants = [
    { [identifierField]: identifier, email: identifier, username: identifier, password },
    { [identifierField]: identifier, password },
  ];

  for (const ep of endpoints) {
    const url = ep.startsWith('http') ? ep : `${base}${ep.startsWith('/') ? '' : '/'}${ep}`;
    for (const payload of payloadVariants) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
          redirect: 'manual',
        });
        if (res.status >= 200 && res.status < 400) {
          const text = await res.text().catch(() => '');
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          const token =
            json?.token ||
            json?.access_token ||
            json?.data?.token ||
            json?.data?.access_token ||
            undefined;
          if (token || res.status === 200 || res.status === 204 || (res.status >= 300 && res.status < 400 && !String(res.headers.get('location') || '').includes('login'))) {
            return { ok: true, token: typeof token === 'string' ? token : undefined, note: `Verified via ${ep} (HTTP ${res.status})` };
          }
        }
      } catch {}
    }
  }
  return { ok: false, note: 'Belum terverifikasi via API endpoint (akan dicoba via form UI)' };
}

async function tryApiRegister(
  backendUrl: string,
  endpoints: string[],
  account: { name: string; role: string; identifierField: string; identifier: string; password: string }
): Promise<{ ok: boolean; endpoint?: string }> {
  const base = backendUrl.replace(/\/+$/, '');
  const body = {
    name: account.name,
    [account.identifierField]: account.identifier,
    email: account.identifier.includes('@') ? account.identifier : `qc.${sanitizeRole(account.role)}@sandbox.local`,
    username: account.identifier,
    password: account.password,
    password_confirmation: account.password,
    role: account.role,
  };
  for (const ep of endpoints) {
    const url = ep.startsWith('http') ? ep : `${base}${ep.startsWith('/') ? '' : '/'}${ep}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, endpoint: ep };
      }
    } catch {}
  }
  return { ok: false };
}

async function tryDockerSeedAccount(
  backendContainer: { name: string; workdir: string } | undefined,
  account: { name: string; role: string; identifierField: string; identifier: string; password: string }
): Promise<{ ok: boolean; note?: string }> {
  if (!backendContainer) return { ok: false };
  // Try Laravel Tinker-safe inline PHP (checks User model and inserts/updates without echoing password)
  const phpPayload = `
    require 'vendor/autoload.php';
    $app = require 'bootstrap/app.php';
    $kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
    $kernel->bootstrap();
    $model = class_exists('App\\\\Models\\\\User') ? 'App\\\\Models\\\\User' : (class_exists('App\\\\User') ? 'App\\\\User' : null);
    if (!$model) { exit(2); }
    $table = (new $model)->getTable();
    $cols = Illuminate\\Support\\Facades\\Schema::getColumnListing($table);
    $data = [];
    if (in_array('name', $cols)) $data['name'] = ${JSON.stringify(account.name)};
    $idField = in_array(${JSON.stringify(account.identifierField)}, $cols) ? ${JSON.stringify(account.identifierField)} : (in_array('email', $cols) ? 'email' : 'username');
    if (in_array('email', $cols) && $idField !== 'email') $data['email'] = ${JSON.stringify(`qc.${sanitizeRole(account.role)}@sandbox.local`)};
    $data[$idField] = ${JSON.stringify(account.identifier)};
    if (in_array('password', $cols)) $data['password'] = password_hash(${JSON.stringify(account.password)}, PASSWORD_BCRYPT);
    if (in_array('role', $cols)) $data['role'] = ${JSON.stringify(account.role)};
    if (in_array('email_verified_at', $cols)) $data['email_verified_at'] = date('Y-m-d H:i:s');
    $model::updateOrCreate([$idField => $data[$idField]], $data);
    echo "SEEDED_OK";
  `.trim().replace(/\n\s+/g, ' ');

  try {
    const { stdout } = await execFileAsync('docker', [
      'exec',
      '--workdir',
      backendContainer.workdir,
      backendContainer.name,
      '/bin/sh',
      '-lc',
      `test -f artisan && php -r '${phpPayload.replace(/'/g, `'\\''`)}'`,
    ], { timeout: 15_000 });
    if (stdout.includes('SEEDED_OK')) {
      return { ok: true, note: 'Akun dibuat langsung di DB sandbox via backend Laravel container.' };
    }
  } catch {}
  return { ok: false };
}

export async function provisionRoleAccounts(options: {
  sourceDir?: string;
  backendUrl?: string;
  frontendUrl?: string;
  explicitAccounts?: Array<{ name?: string; email: string; password: string; role?: string }>;
  autoProvisionAccounts?: boolean;
  backendContainer?: { name: string; workdir: string };
  secretsOut?: Set<string>;
}): Promise<{
  publicAccounts: ProvisionedRoleAccount[];
  runtimeCredentials: Map<string, RuntimeRoleCredential>;
  schema: DiscoveredAuthSchema;
}> {
  const explicit = (options.explicitAccounts || []).filter((a) => Boolean(a.email?.trim()));
  const schema: DiscoveredAuthSchema = options.sourceDir && fs.existsSync(options.sourceDir)
    ? await discoverAuthSchema(options.sourceDir, explicit.length === 0)
    : {
        roles: explicit.length > 0 ? [] : ['user'],
        identifierField: 'email',
        loginPath: '/login',
        loginEndpoints: ['/api/v1/web/auth/login', '/api/v1/auth/login', '/api/v1/login', '/api/login', '/login'],
        registerEndpoints: ['/api/v1/register', '/api/register', '/register'],
        seederAccounts: [],
      };

  const runtimeCredentials = new Map<string, RuntimeRoleCredential>();
  const publicAccounts: ProvisionedRoleAccount[] = [];
  const backendCheckBase = options.backendUrl || options.frontendUrl || '';

  // Include roles from explicit overrides in the role list
  const targetRoles = [...new Set([
    ...schema.roles,
    ...explicit.map((a) => sanitizeRole(a.role || 'user')).filter(Boolean),
  ])];

  for (const [idx, role] of targetRoles.entries()) {
    const manual = explicit.find((a) => sanitizeRole(a.role || 'user') === role)
      || (idx === 0 && explicit.length === 1 && !explicit[0].role ? explicit[0] : undefined);

    if (manual && manual.password?.trim()) {
      options.secretsOut?.add(manual.password);
      const probe = backendCheckBase
        ? await tryApiLogin(backendCheckBase, schema.loginEndpoints, schema.identifierField, manual.email, manual.password)
        : { ok: false, note: 'Manual account (belum diuji ke endpoint)' };

      const cred: RuntimeRoleCredential = {
        role,
        name: manual.name || `QC ${role}`,
        identifier: manual.email.trim(),
        identifierField: schema.identifierField,
        password: manual.password,
        token: probe.token,
        loginPath: schema.loginPath,
        source: 'manual',
        verified: probe.ok,
        verificationNote: probe.note,
      };
      runtimeCredentials.set(role, cred);
      publicAccounts.push({
        role: cred.role,
        name: cred.name,
        identifier: cred.identifier,
        identifierField: cred.identifierField,
        source: 'manual',
        verified: cred.verified,
        verificationNote: cred.verificationNote,
        loginPath: cred.loginPath,
      });
      continue;
    }

    if (options.autoProvisionAccounts === false) continue;

    // Tier 1: Seeder credential already discovered for this role
    const seeded = schema.seederAccounts.find((s) => sanitizeRole(s.role) === role);
    if (seeded) {
      options.secretsOut?.add(seeded.password);
      const probe = backendCheckBase
        ? await tryApiLogin(backendCheckBase, schema.loginEndpoints, schema.identifierField, seeded.identifier, seeded.password)
        : { ok: false, note: 'Dari seeder repository (siap login UI)' };

      const cred: RuntimeRoleCredential = {
        role,
        name: `Demo ${role}`,
        identifier: seeded.identifier,
        identifierField: schema.identifierField,
        password: seeded.password,
        token: probe.token,
        loginPath: schema.loginPath,
        source: 'seeder',
        verified: probe.ok,
        verificationNote: probe.note,
      };
      runtimeCredentials.set(role, cred);
      publicAccounts.push({
        role: cred.role,
        name: cred.name,
        identifier: cred.identifier,
        identifierField: cred.identifierField,
        source: 'seeder',
        verified: cred.verified,
        verificationNote: cred.verificationNote,
        loginPath: cred.loginPath,
      });
      continue;
    }

    // Tier 2 / Tier 3: Auto-generate ephemeral credential and attempt register / DB container seed
    const demoIdentifier = generateIdentifier(role, schema.identifierField, idx + 1);
    const demoPassword = generateRunPassword();
    options.secretsOut?.add(demoPassword);

    let provisionSource: ProvisionedRoleAccount['source'] = 'register-api';
    let createdOk = false;
    let creationNote = '';

    if (options.backendContainer) {
      const seededInContainer = await tryDockerSeedAccount(options.backendContainer, {
        name: `QC Demo ${role}`,
        role,
        identifierField: schema.identifierField,
        identifier: demoIdentifier,
        password: demoPassword,
      });
      if (seededInContainer.ok) {
        provisionSource = 'db-insert';
        createdOk = true;
        creationNote = seededInContainer.note || '';
      }
    }

    if (!createdOk && backendCheckBase) {
      const reg = await tryApiRegister(backendCheckBase, schema.registerEndpoints, {
        name: `QC Demo ${role}`,
        role,
        identifierField: schema.identifierField,
        identifier: demoIdentifier,
        password: demoPassword,
      });
      if (reg.ok) {
        provisionSource = 'register-api';
        createdOk = true;
        creationNote = `Terdaftar otomatis via ${reg.endpoint}`;
      }
    }

    const probe = backendCheckBase
      ? await tryApiLogin(backendCheckBase, schema.loginEndpoints, schema.identifierField, demoIdentifier, demoPassword)
      : { ok: false, note: 'Target offline saat validasi API; akan dicoba saat login UI.' };

    const cred: RuntimeRoleCredential = {
      role,
      name: `QC Demo ${role}`,
      identifier: demoIdentifier,
      identifierField: schema.identifierField,
      password: demoPassword,
      token: probe.token,
      loginPath: schema.loginPath,
      source: provisionSource,
      verified: probe.ok,
      verificationNote: creationNote ? `${creationNote} · ${probe.note}` : probe.note,
    };
    runtimeCredentials.set(role, cred);
    publicAccounts.push({
      role: cred.role,
      name: cred.name,
      identifier: cred.identifier,
      identifierField: cred.identifierField,
      source: cred.source,
      verified: cred.verified,
      verificationNote: cred.verificationNote,
      loginPath: cred.loginPath,
    });
  }

  return { publicAccounts, runtimeCredentials, schema };
}

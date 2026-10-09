import childProcess, { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NormalizedFlow } from '@qc/flow-schema';
import { executeWebFlow, type RunStepResult, type WebRunResult } from './playwright-adapter.ts';
import { detectProjectRuntime, ensureRuntimeImage } from './runtimes/index.ts';

export function resolveGitToken(root?: string): string | undefined {
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();
  if (process.env.GH_TOKEN?.trim()) return process.env.GH_TOKEN.trim();
  const searchDirs = [root, process.cwd(), path.resolve(process.cwd(), '..'), path.resolve(process.cwd(), '../..')].filter(Boolean) as string[];
  for (const dir of searchDirs) {
    try {
      const envPath = path.join(dir, '.env');
      if (fs.existsSync(envPath)) {
        const text = fs.readFileSync(envPath, 'utf8');
        const match = text.match(/^\s*(?:GITHUB_TOKEN|GH_TOKEN)\s*=\s*(["']?)(.*?)\1\s*$/m);
        if (match && match[2]?.trim()) {
          const found = match[2].trim();
          process.env.GITHUB_TOKEN = found;
          return found;
        }
      }
    } catch {}
  }
  return undefined;
}

export type ManagedService = {
  id: string;
  name: string;
  kind?: string;
  workingDir: string;
  installCommand: string;
  startCommand: string;
  healthCheck: string;
  port?: number;
  dependsOn: string[];
  runtimeImage?: string;
};

export type ManagedProject = {
  sourceType?: 'github' | 'local-folder';
  sourcePath?: string;
  repositoryUrl?: string;
  ref: string;
  baseUrl: string;
  environment: string;
  stack?: 'laravel' | 'custom' | 'auto';
  envFilePath?: string;
  retainClone?: boolean;
  services: ManagedService[];
};

export type ServiceRuntime = {
  id: string;
  name: string;
  status: 'PENDING' | 'INSTALLING' | 'STARTING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'STOPPED';
  message?: string;
};

export type RunnerUpdate = {
  phase?: string;
  progress?: number;
  message?: string;
  services?: ServiceRuntime[];
  stepResults?: RunStepResult[];
};

export type RunnerContext = { runId: string; sourceDir: string; workspace: string; networkName: string; services: ManagedService[]; containers: Map<string, { name: string; workdir: string }> };
export type RunnerHooks = { update: (update: RunnerUpdate) => void; signal?: AbortSignal; onSource?: (sourceDir: string) => Promise<void>; prepare?: (context: RunnerContext) => Promise<Record<string, string>>; beforeStart?: (context: RunnerContext) => Promise<void>; execute?: (sourceDir: string) => Promise<WebRunResult>; cleanup?: () => Promise<void> };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function copySourceDirectory(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (['.git', 'node_modules', 'vendor', '.qc-artifacts'].includes(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copySourceDirectory(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

async function exists(file: string) {
  return Boolean(await stat(file).catch(() => undefined));
}

async function ensureDockerHostSpace() {
  if (process.platform !== 'win32') return;
  const { statfs } = await import('node:fs/promises') as unknown as { statfs: (path: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }> };
  const configuredMinBytes = Number(process.env.QC_MIN_DOCKER_DISK_BYTES ?? 50 * 1024 * 1024);
  const requiredBytes = Number.isFinite(configuredMinBytes) ? configuredMinBytes : 50 * 1024 * 1024;
  const workspaceDrive = path.parse(process.cwd()).root;
  const probePaths = [...new Set([workspaceDrive])];
  for (const probePath of probePaths) {
    const filesystem = await statfs(probePath).catch(() => undefined);
    if (!filesystem) continue;
    const availableBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
    if (availableBytes < requiredBytes) {
      const availableGb = (availableBytes / 1024 ** 3).toFixed(2);
      throw new Error(`ruang disk host Docker tidak mencukupi pada ${path.parse(probePath).root || probePath}: tersisa ${availableGb} GiB, perlu minimal ${(requiredBytes / 1024 ** 3).toFixed(2)} GiB. Bebaskan ruang di drive tersebut lalu jalankan ulang QC.`);
    }
  }
}

async function secretValuesFromEnvFile(file: string) {
  const source = await readFile(file, 'utf8').catch(() => '');
  const secrets: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !/token|secret|password|passwd|api[_-]?key|private|credential|authorization/i.test(match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    if (value.length >= 4) secrets.push(value);
  }
  return [...new Set(secrets)];
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; } catch { return undefined; }
}

const ignoredDiscoveryDirectories = new Set(['.git', '.github', '.qc-artifacts', 'node_modules', 'vendor', 'storage', 'dist', 'build', 'coverage']);

async function findManifestDirectories(sourceDir: string, filename: string, maxDepth = 2) {
  const directories: string[] = [];
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (await exists(path.join(directory, filename))) directories.push(directory);
    if (depth >= maxDepth) return;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || ignoredDiscoveryDirectories.has(entry.name)) continue;
      await visit(path.join(directory, entry.name), depth + 1);
    }
  };
  await visit(sourceDir, 0);
  return directories;
}

export function serverPort(port: number, fallback = 5000): number {
  if (Number.isInteger(port) && port >= 5000 && port <= 6000) return port;
  // Map any outside port into 5000-6000 range
  const mapped = 5000 + (Math.abs(port) % 1001);
  return mapped >= 5000 && mapped <= 6000 ? mapped : fallback;
}

function basePort(baseUrl: string, fallback: number, enforceServerRange = true) {
  try {
    const raw = Number(new URL(baseUrl).port) || fallback;
    return enforceServerRange ? serverPort(raw, fallback) : raw;
  } catch {
    return enforceServerRange ? serverPort(fallback, fallback) : fallback;
  }
}

function isLaravelPreset(service: ManagedService) {
  return service.installCommand.includes('composer') || service.startCommand.includes('artisan') || service.name.includes('laravel') || (service.name === 'vite-frontend' && service.installCommand === 'npm ci' && service.startCommand.includes('npm run dev'));
}

function hasExplicitRuntime(services: ManagedService[]) {
  return services.some((service) => Boolean(service.runtimeImage?.trim()) || (!isLaravelPreset(service) && (service.installCommand.trim() || service.startCommand.trim())));
}

function relativeWorkingDir(sourceDir: string, directory: string) {
  const relative = path.relative(sourceDir, directory).split(path.sep).join('/');
  return relative || '.';
}

function serviceSlug(sourceDir: string, directory: string) {
  return relativeWorkingDir(sourceDir, directory).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
}

async function detectServices(sourceDir: string, project: ManagedProject) {
  const configured = project.services ?? [];
  if (configured.length > 0 && (project.stack === 'custom' || hasExplicitRuntime(configured))) return configured;

  const composerDirs = await findManifestDirectories(sourceDir, 'composer.json');
  const laravelDirs: string[] = [];
  for (const directory of composerDirs) if (await exists(path.join(directory, 'artisan'))) laravelDirs.push(directory);

  const packageDirs = await findManifestDirectories(sourceDir, 'package.json');
  const nodeServices: ManagedService[] = [];
  for (const [index, directory] of packageDirs.entries()) {
    const packageJson = await readJson<{ scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; packageManager?: string }>(path.join(directory, 'package.json'));
    const scripts = packageJson?.scripts ?? {};
    const script = scripts.dev ? 'dev' : scripts.start ? 'start' : scripts.serve ? 'serve' : undefined;
    if (!script) continue;
    const isRoot = directory === sourceDir;
    const port = isRoot && laravelDirs.length > 0 ? 5173 : basePort(project.baseUrl, script === 'dev' ? 5173 + index : 3000 + index);
    const packageManager = packageJson?.packageManager ?? '';
    const hasPnpmLock = await exists(path.join(directory, 'pnpm-lock.yaml'));
    const hasYarnLock = await exists(path.join(directory, 'yarn.lock'));
    const hasPackageLock = await exists(path.join(directory, 'package-lock.json'));
    const tool = packageManager.startsWith('pnpm') || hasPnpmLock ? 'pnpm' : packageManager.startsWith('yarn') || hasYarnLock ? 'yarn' : 'npm';
    const isNext = Boolean(scripts[script]?.includes('next') || (scripts.build && scripts.build.includes('next')) || packageJson?.dependencies?.next || packageJson?.devDependencies?.next);
    const hasPrisma = await exists(path.join(directory, 'prisma', 'schema.prisma'));
    const hasNodeModules = await exists(path.join(directory, 'node_modules'));
    let installCommand = hasNodeModules
      ? (hasPrisma ? 'npx prisma generate' : '')
      : (tool === 'pnpm'
        ? `pnpm install${hasPnpmLock ? ' --frozen-lockfile' : ''}`
        : tool === 'yarn'
        ? `yarn install${hasYarnLock ? ' --frozen-lockfile' : ''}`
        : hasPackageLock
        ? 'npm ci --prefer-offline --no-audit --no-fund || npm install --prefer-offline --no-audit --no-fund --progress=false'
        : 'npm install --prefer-offline --no-audit --no-fund --progress=false');
    if (!hasNodeModules && hasPrisma) {
      installCommand = `${installCommand} && npx prisma generate`;
    }
    const startCommand = isNext
      ? `${tool} run ${script}${tool === 'yarn' ? '' : ' --'} -p ${port}`
      : `${tool} run ${script}${tool === 'yarn' ? '' : ' --'} --host 0.0.0.0 --port=${port}`;
    const detectedNode = await detectProjectRuntime(directory);
    nodeServices.push({
      id: isRoot ? 'node-app' : `node-${serviceSlug(sourceDir, directory)}`,
      name: isRoot ? 'node-app' : `node-${relativeWorkingDir(sourceDir, directory)}`,
      kind: laravelDirs.length > 0 ? 'frontend' : 'custom',
      workingDir: relativeWorkingDir(sourceDir, directory),
      installCommand,
      startCommand,
      healthCheck: laravelDirs.length > 0 ? '' : project.baseUrl,
      port,
      runtimeImage: detectedNode.recommendedImage,
      dependsOn: laravelDirs.length > 0 ? laravelDirs.map((directory) => `laravel-${serviceSlug(sourceDir, directory)}`) : []
    });
  }

  const services: ManagedService[] = [];
  for (const [index, directory] of laravelDirs.entries()) {
    const port = index === 0 ? basePort(project.baseUrl, 5000) : 5000 + index;
    const detectedPhp = await detectProjectRuntime(directory);
    services.push({
      id: `laravel-${serviceSlug(sourceDir, directory)}`,
      name: directory === sourceDir ? 'laravel-backend' : `laravel-${relativeWorkingDir(sourceDir, directory)}`,
      kind: 'backend',
      workingDir: relativeWorkingDir(sourceDir, directory),
      installCommand: detectedPhp.installCommand,
      startCommand: `php artisan serve --host=0.0.0.0 --port=${port}`,
      healthCheck: index === 0 ? project.baseUrl : `http://127.0.0.1:${port}/`,
      port,
      runtimeImage: detectedPhp.recommendedImage,
      dependsOn: []
    });
  }
  if (services.length > 0) return [...services, ...nodeServices];
  if (nodeServices.length > 0) return nodeServices;

  const pythonRequirements = await findManifestDirectories(sourceDir, 'requirements.txt');
  const pythonProjects = pythonRequirements.length > 0 ? pythonRequirements : await findManifestDirectories(sourceDir, 'pyproject.toml');
  const djangoDirs = await findManifestDirectories(sourceDir, 'manage.py');
  if (pythonProjects.length > 0 || djangoDirs.length > 0) {
    const directory = djangoDirs[0] ?? pythonProjects[0];
    const port = basePort(project.baseUrl, 5000);
    const hasRequirements = await exists(path.join(directory, 'requirements.txt'));
    return [{ id: 'python-app', name: 'python-app', kind: 'backend', workingDir: relativeWorkingDir(sourceDir, directory), installCommand: hasRequirements ? 'python -m pip install -r requirements.txt' : 'python -m pip install -e .', startCommand: djangoDirs.length > 0 ? `python manage.py runserver 0.0.0.0:${port}` : `python -m uvicorn app:app --host 0.0.0.0 --port ${port}`, healthCheck: project.baseUrl, port, runtimeImage: 'python:3.12-slim', dependsOn: [] }];
  }

  const goDirs = await findManifestDirectories(sourceDir, 'go.mod');
  if (goDirs.length > 0) {
    const directory = goDirs[0];
    return [{ id: 'go-app', name: 'go-app', kind: 'backend', workingDir: relativeWorkingDir(sourceDir, directory), installCommand: 'go mod download', startCommand: 'go run .', healthCheck: project.baseUrl, port: basePort(project.baseUrl, 5000), runtimeImage: 'golang:1.27-bookworm', dependsOn: [] }];
  }

  const composeFiles = [...await findManifestDirectories(sourceDir, 'docker-compose.yml'), ...await findManifestDirectories(sourceDir, 'docker-compose.yaml')];
  const dockerfileDirs = await findManifestDirectories(sourceDir, 'Dockerfile');
  if (composeFiles.length > 0) throw new Error('Docker Compose auto-run belum diizinkan pada sandbox runner. Daftarkan service satu per satu dengan runtime image dan command biasa.');
  if (dockerfileDirs.length > 0) throw new Error('Dockerfile auto-build belum diizinkan pada sandbox runner. Pilih Custom stack dan isi runtime image serta command secara eksplisit.');
  if (configured.length > 0) return configured;
  throw new Error('stack repository tidak terdeteksi. Isi runtime service manual pada Advanced settings.');
}

export async function cloneRepository(repositoryUrl: string, ref: string, sourceDir: string, root: string, env: NodeJS.ProcessEnv, gitToken: string | undefined, onOutput: (message: string) => void) {
  const token = gitToken || resolveGitToken(root);
  const isGitRepo = await exists(path.join(sourceDir, '.git'));
  let gitEnv = env;
  if (token) {
    gitEnv = {
      ...env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
    };
  }
  const secrets = token ? [token] : [];
  if (isGitRepo) {
    onOutput('Repository sudah ada di workspace; memperbarui referensi dari origin…');
    await runProcess('git', ['fetch', '--depth', '1', 'origin', ref], { cwd: sourceDir, env: gitEnv, commandLabel: 'git fetch ref', timeoutMs: 120_000, onOutput });
    await runProcess('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: sourceDir, env: gitEnv, commandLabel: 'git checkout ref', timeoutMs: 60_000 });
    return;
  }
  if (await exists(sourceDir)) {
    await rm(sourceDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(async () => {
      if (process.platform === 'win32') {
        await runProcess('cmd', ['/c', 'rmdir', '/s', '/q', sourceDir], { cwd: root, env, commandLabel: 'clean sourceDir' }).catch(() => {});
      }
    });
  }
  const cloneTargetUrl = token && repositoryUrl.startsWith('https://github.com/')
    ? repositoryUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`)
    : repositoryUrl;
  const args = ['clone', '--depth', '1', '--filter=blob:none', '--no-tags', cloneTargetUrl, sourceDir];
  try {
    await runProcess('git', args, { cwd: root, env, commandLabel: 'git clone', timeoutMs: 180_000, onOutput });
  } catch (error) {
    if (!gitToken) throw error;
    await rm(sourceDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(async () => {
      if (process.platform === 'win32') {
        await runProcess('cmd', ['/c', 'rmdir', '/s', '/q', sourceDir], { cwd: root, env, commandLabel: 'clean sourceDir' }).catch(() => {});
      }
    });
    const anonymousEnv = { ...env };
    delete anonymousEnv.GIT_CONFIG_COUNT;
    delete anonymousEnv.GIT_CONFIG_KEY_0;
    delete anonymousEnv.GIT_CONFIG_VALUE_0;
    gitEnv = anonymousEnv;
    onOutput('Autentikasi token gagal/timeout; mencoba clone tanpa auth untuk repository public…');
    await runProcess('git', args, { cwd: root, env: anonymousEnv, commandLabel: 'git clone public fallback', timeoutMs: 120_000, onOutput });
  }
  await runProcess('git', ['fetch', '--depth', '1', 'origin', ref], { cwd: sourceDir, env: gitEnv, commandLabel: 'git fetch ref', timeoutMs: 120_000, onOutput });
  await runProcess('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: sourceDir, env: gitEnv, commandLabel: 'git checkout ref', timeoutMs: 60_000 });
}

function redact(value: string, additionalSecrets: string[] = []) {
  const environmentSecrets = Object.entries(process.env)
    .filter(([name, secret]) => secret && /token|secret|password|api[_-]?key|private|credential|authorization/i.test(name))
    .map(([, secret]) => secret as string);
  const secrets = [process.env.GITHUB_TOKEN, process.env.GH_TOKEN, ...environmentSecrets, ...additionalSecrets]
    .filter((secret): secret is string => Boolean(secret && secret.length >= 4))
    .sort((left, right) => right.length - left.length);
  let safe = value;
  for (const secret of secrets) safe = safe.replaceAll(secret, '[REDACTED]');
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) safe = safe.replaceAll(Buffer.from(`x-access-token:${token}`).toString('base64'), '[REDACTED]');
  return safe.replace(/((?:password|passwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*)([^\s"'&,]+)/gi, '$1[REDACTED]');
}

function commandError(command: string, code: number | null, output: string, secrets: string[] = []) {
  const tail = redact(output.trim(), secrets).split(/\r?\n/).slice(-4).join(' | ');
  return new Error(`${command} gagal${code == null ? '' : ` (exit ${code})`}${tail ? `: ${tail}` : ''}`);
}

function runProcess(file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; commandLabel: string; timeoutMs?: number; heartbeatMs?: number; onOutput?: (output: string) => void; onHeartbeat?: (elapsedMs: number, idleMs: number) => void; secrets?: string[] }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const startedAt = Date.now();
    let lastOutputAt = startedAt;
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      void stopProcess(child).finally(() => {
        if (!settled) {
          settled = true;
          clearInterval(heartbeat);
          const tail = redact(output.trim(), options.secrets).split(/\r?\n/).filter(Boolean).slice(-6).join(' | ');
          const silence = Date.now() - lastOutputAt;
          reject(new Error(`${options.commandLabel} timeout setelah ${options.timeoutMs ?? 180_000}ms${tail ? `; output terakhir: ${tail}` : `; tidak ada output selama ${silence}ms`}`));
        }
      });
    }, options.timeoutMs ?? 180_000);
    const heartbeat = options.onHeartbeat ? setInterval(() => options.onHeartbeat?.(Date.now() - startedAt, Date.now() - lastOutputAt), options.heartbeatMs ?? 60_000) : undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      callback();
    };
    const collect = (chunk: Buffer) => {
      lastOutputAt = Date.now();
      const text = chunk.toString();
      output = `${output}${text}`.slice(-12_000);
      options.onOutput?.(redact(text, options.secrets).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? '');
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.once('error', (error) => finish(() => reject(new Error(`${options.commandLabel} tidak dapat dijalankan: ${error.message}`))));
    child.once('close', (code) => finish(() => code === 0 ? resolve() : reject(commandError(options.commandLabel, code, output, options.secrets))));
  });
}

async function stopProcess(child: ChildProcess) {
  if (child.exitCode !== null || child.killed || !child.pid) return;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { killer.kill(); resolve(); }, 3_000);
      killer.once('close', () => { clearTimeout(timer); resolve(); });
      killer.once('error', () => { clearTimeout(timer); resolve(); });
    });
    child.kill();
    return;
  }
  child.kill('SIGTERM');
  await wait(500);
  if (child.exitCode === null) child.kill('SIGKILL');
}

const runtimeEnvironmentNames = new Set([
  'path', 'pathext', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'homedrive', 'homepath',
  'appdata', 'localappdata', 'programdata', 'programfiles', 'programfiles(x86)', 'commonprogramfiles',
  'comspec', 'os', 'processor_architecture', 'number_of_processors', 'systemdrive', 'lang', 'lc_all',
  'ci', 'term', 'force_color', 'no_color'
]);

function makeRuntimeEnvironment(environment: string) {
  const clean: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (runtimeEnvironmentNames.has(name.toLowerCase()) && value !== undefined) clean[name] = value;
  }
  clean.APP_ENV = environment;
  clean.COMPOSER_PROCESS_TIMEOUT = '0';
  return clean;
}

function safeContainerImage(service: ManagedService) {
  const start = service.startCommand.trim().toLowerCase();
  const install = service.installCommand.trim().toLowerCase();
  const inferred = service.runtimeImage?.trim()
    || (/\bcomposer\b/.test(install) ? 'qc-runtime:php-8.2' : undefined)
    || (/\b(?:npm|pnpm|yarn|node|corepack)\b/.test(`${start} ${install}`) ? 'node:22-alpine' : undefined)
    || (/\b(?:php|artisan|composer)\b/.test(`${start} ${install}`) ? 'qc-runtime:php-8.2' : undefined)
    || (/\b(?:python|pip|manage\.py)\b/.test(`${start} ${install}`) ? 'python:3.12-slim' : undefined)
    || (/\b(?:go|golang)\b/.test(`${start} ${install}`) ? 'golang:1.22-alpine' : undefined);
  if (!inferred) throw new Error(`runtime image wajib diisi untuk service ${service.name}; gunakan image Linux yang memiliki /bin/sh.`);
  if (!/^[a-z0-9][a-z0-9._/:@-]*$/i.test(inferred) || inferred.includes('..')) throw new Error(`runtime image tidak valid untuk service ${service.name}.`);
  return inferred;
}

function containerPort(service: ManagedService) {
  if (service.port !== undefined) {
    if (!Number.isInteger(service.port) || service.port < 1 || service.port > 65535) throw new Error(`port service ${service.name} harus antara 1 dan 65535.`);
    return serverPort(service.port);
  }
  try {
    const url = new URL(service.healthCheck);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      const rawPort = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
      return serverPort(rawPort);
    }
  } catch { /* health check may be intentionally empty */ }
  return undefined;
}

function sandboxLimits() {
  const memory = process.env.QC_SANDBOX_MEMORY_LIMIT ?? '2g';
  const cpus = Number(process.env.QC_SANDBOX_CPU_LIMIT ?? '2');
  const pids = Number(process.env.QC_SANDBOX_PIDS_LIMIT ?? '256');
  if (!/^\d+(?:m|g)$/i.test(memory) || !Number.isFinite(cpus) || cpus <= 0 || cpus > 16 || !Number.isInteger(pids) || pids < 32 || pids > 2048) {
    throw new Error('QC_SANDBOX_MEMORY_LIMIT, QC_SANDBOX_CPU_LIMIT, atau QC_SANDBOX_PIDS_LIMIT tidak valid.');
  }
  return { memory, cpus: String(cpus), pids: String(pids) };
}

function containerWorkingDirectory(sourceDir: string, cwd: string) {
  const relative = path.relative(sourceDir, cwd).split(path.sep).join('/');
  return `/workspace${relative ? `/${relative}` : ''}`;
}

function serviceContainerName(runId: string, service: ManagedService) {
  const serviceName = (service.id || service.name).replace(/[^a-z0-9-]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '').slice(0, 24) || 'service';
  return `qc-${runId.replaceAll('-', '').slice(0, 12)}-${serviceName}`;
}

function startProcess(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, onOutput?: (output: string) => void, secrets: string[] = []) {
  const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) as ChildProcess & { spawnError?: Error };
  child.stdout?.on('data', (chunk: Buffer) => onOutput?.(redact(chunk.toString(), secrets).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? ''));
  child.stderr?.on('data', (chunk: Buffer) => onOutput?.(redact(chunk.toString(), secrets).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? ''));
  child.once('error', (error) => { child.spawnError = error; onOutput?.(redact(error.message, secrets)); });
  return child;
}

function orderServices(services: ManagedService[]) {
  const byName = new Map(services.flatMap((service) => [[service.id, service], [service.name, service]]));
  const result: ManagedService[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (service: ManagedService) => {
    if (visited.has(service.id)) return;
    if (visiting.has(service.id)) throw new Error(`dependency cycle pada service ${service.name}`);
    visiting.add(service.id);
    for (const dependency of service.dependsOn ?? []) {
      const target = byName.get(dependency);
      if (!target) throw new Error(`dependency ${dependency} untuk service ${service.name} tidak ditemukan`);
      visit(target);
    }
    visiting.delete(service.id);
    visited.add(service.id);
    result.push(service);
  };
  services.forEach(visit);
  return result;
}

function safeWorkingDirectory(sourceDir: string, workingDir: string) {
  const resolved = path.resolve(sourceDir, workingDir || '.');
  const root = path.resolve(sourceDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`working directory service keluar dari repository: ${workingDir}`);
  return resolved;
}

async function waitForHealth(url: string, timeoutMs: number, onProgress?: (message: string) => void) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'belum ada response';
  while (Date.now() < deadline) {
    try {
      const remainingMs = Math.max(1000, deadline - Date.now());
      const attemptTimeout = Math.min(25_000, remainingMs);
      const response = await fetch(url, { signal: AbortSignal.timeout(attemptTimeout) });
      if (response.ok || (response.status >= 200 && response.status < 500)) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    onProgress?.(`menunggu health check (${lastError})`);
    await wait(1000);
  }
  throw new Error(`health check timeout ${url}: ${lastError}`);
}

export async function runManagedProject(flow: NormalizedFlow, runId: string, project: ManagedProject, artifactRoot: string, root: string, hooks: RunnerHooks): Promise<WebRunResult> {
  const workspace = path.join(artifactRoot, 'workspaces', runId);
  const sourceDir = path.join(workspace, 'source');
  const children: ChildProcess[] = [];
  const containerNames: string[] = [];
  const containerByService = new Map<string, { name: string; workdir: string }>();
  const networkName = `qc-${runId.replaceAll('-', '').slice(0, 16)}-net`;
  let networkCreated = false;
  let ordered: ManagedService[] = [];
  let serviceStates: ServiceRuntime[] = [];
  let environmentSource: string | undefined;
  let projectSecrets: string[] = [];
  const updateServices = () => hooks.update({ services: serviceStates.map((service) => ({ ...service })) });
  const updateService = (service: ManagedService, status: ServiceRuntime['status'], message?: string) => {
    const state = serviceStates.find((item) => item.id === service.id);
    if (state) { state.status = status; state.message = message; }
    updateServices();
  };
  const env = makeRuntimeEnvironment(project.environment);
  const gitEnv: NodeJS.ProcessEnv = { ...env, GIT_TERMINAL_PROMPT: '0' };
  const gitToken = resolveGitToken(root);
  if (gitToken) {
    gitEnv.GIT_CONFIG_COUNT = '1';
    gitEnv.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader';
    gitEnv.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${Buffer.from(`x-access-token:${gitToken}`).toString('base64')}`;
  }

  try {
    if (!/^[a-z0-9-]+$/i.test(runId)) throw new Error('invalid run id');
    try {
      const existing = childProcess.execSync(`docker ps -aq --filter label=qc.run_id=${runId}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (existing) {
        childProcess.execSync(`docker rm -fv ${existing.split(/\s+/).join(' ')}`, { stdio: 'ignore' });
      }
    } catch {}
    await mkdir(workspace, { recursive: true });
    hooks.signal?.throwIfAborted();
    hooks.update({ phase: 'CLONING', progress: 5, message: 'Mengambil repository dari GitHub…' });
    if (project.sourceType === 'local-folder' || (!project.sourceType && project.sourcePath)) {
      const localPath = path.resolve(project.sourcePath ?? '');
      const sourceInfo = await stat(localPath).catch(() => undefined);
      if (!sourceInfo?.isDirectory()) throw new Error(`folder lokal tidak ditemukan: ${localPath}`);
      hooks.update({ phase: 'COPYING_SOURCE', progress: 5, message: `Menyalin folder kerja ke workspace QC: ${localPath}` });
      await copySourceDirectory(localPath, sourceDir);
    } else {
      if (!project.repositoryUrl?.trim()) throw new Error('repository GitHub wajib diisi untuk source github.');
      const repository = new URL(project.repositoryUrl);
      if (!['http:', 'https:'].includes(repository.protocol)) throw new Error('repository URL harus memakai HTTP(S)');
      if (repository.username || repository.password) throw new Error('repository URL tidak boleh menyimpan username/password; gunakan GITHUB_TOKEN di secret store lokal.');
      await cloneRepository(project.repositoryUrl, project.ref, sourceDir, root, gitEnv, gitToken, (message) => hooks.update({ message: `Git: ${message}` }));
    }
    hooks.signal?.throwIfAborted();
    await hooks.onSource?.(sourceDir);

    if (project.envFilePath?.trim()) {
      const envPath = path.isAbsolute(project.envFilePath) ? project.envFilePath : path.resolve(root, project.envFilePath);
      const envInfo = await stat(envPath).catch(() => undefined);
      if (!envInfo?.isFile()) throw new Error(`file environment tidak ditemukan: ${project.envFilePath}`);
      if (!/^\.env(?:\.[a-z0-9_-]+)?$/i.test(path.basename(envPath))) throw new Error('file environment harus bernama .env atau .env.<environment>.');
      await copyFile(envPath, path.join(sourceDir, '.env'));
      environmentSource = path.join(sourceDir, '.env');
      projectSecrets.push(...await secretValuesFromEnvFile(environmentSource));
      hooks.update({ phase: 'ENVIRONMENT_READY', progress: 15, message: 'File environment project dipasang.' });
    } else {
      if (!await exists(path.join(sourceDir, '.env')) && await exists(path.join(sourceDir, '.env.example'))) {
        await copyFile(path.join(sourceDir, '.env.example'), path.join(sourceDir, '.env'));
        environmentSource = path.join(sourceDir, '.env');
        projectSecrets.push(...await secretValuesFromEnvFile(environmentSource));
        hooks.update({ phase: 'ENVIRONMENT_READY', progress: 15, message: '`.env` dibuat dari `.env.example`; gunakan env file project untuk kredensial nyata.' });
      } else {
        environmentSource = await exists(path.join(sourceDir, '.env')) ? path.join(sourceDir, '.env') : undefined;
        if (environmentSource) projectSecrets.push(...await secretValuesFromEnvFile(environmentSource));
        hooks.update({ phase: 'ENVIRONMENT_READY', progress: 15, message: 'Menggunakan environment yang tersedia di repository.' });
      }
    }

    hooks.update({ phase: 'DETECTING_STACK', progress: 18, message: 'Mendeteksi stack dan service repository…' });
    ordered = orderServices(await detectServices(sourceDir, project));
    serviceStates = ordered.map((service) => ({ id: service.id, name: service.name, status: 'PENDING' }));
    updateServices();
    for (const service of ordered.filter((item) => /artisan|composer/i.test(`${item.installCommand} ${item.startCommand}`))) {
      const serviceDir = safeWorkingDirectory(sourceDir, service.workingDir);
      const serviceEnv = path.join(serviceDir, '.env');
      if (await exists(serviceEnv)) {
        projectSecrets.push(...await secretValuesFromEnvFile(serviceEnv));
        continue;
      }
      if (environmentSource && await exists(environmentSource)) await copyFile(environmentSource, serviceEnv);
      else if (await exists(path.join(serviceDir, '.env.example'))) await copyFile(path.join(serviceDir, '.env.example'), serviceEnv);
      if (await exists(serviceEnv)) projectSecrets.push(...await secretValuesFromEnvFile(serviceEnv));
    }

    const unsupportedDockerCommand = ordered.find((service) => /\bdocker\s+(?:compose|build|run)\b/i.test(`${service.installCommand} ${service.startCommand}`));
    if (unsupportedDockerCommand) throw new Error(`service ${unsupportedDockerCommand.name} meminta Docker/Compose di dalam repo. Nested Docker belum diizinkan pada sandbox; isi image runtime dan command aplikasi biasa.`);
    await ensureDockerHostSpace();
    const limits = sandboxLimits();
    await runProcess('docker', ['network', 'rm', networkName], { cwd: root, env, commandLabel: 'cleanup stale network' }).catch(() => undefined);
    networkCreated = true;
    await runProcess('docker', ['network', 'create', '--label', 'qc.managed=true', '--label', `qc.run_id=${runId}`, networkName], { cwd: root, env, commandLabel: 'membuat jaringan sandbox', timeoutMs: 60_000, secrets: projectSecrets });
    const runnerContext = { runId, sourceDir, workspace, networkName, services: ordered, containers: containerByService };
    const additionalEnvironment = await hooks.prepare?.(runnerContext) ?? {};
    projectSecrets.push(...Object.entries(additionalEnvironment).filter(([key]) => /password|token|secret|accounts/i.test(key)).map(([, value]) => value));
    for (const service of ordered) {
      hooks.signal?.throwIfAborted();
      const rawImage = safeContainerImage(service);
      hooks.update({ message: `Memeriksa ketersediaan runtime library: ${rawImage}...` });
      const image = await ensureRuntimeImage(rawImage, (msg) => hooks.update({ message: msg }));
      const name = serviceContainerName(runId, service);
      const aliases = [...new Set([service.id, service.name].map((value) => value.replace(/[^a-z0-9-]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '').slice(0, 48)).filter(Boolean))];
      const port = containerPort(service);
      const serviceWorkdir = containerWorkingDirectory(sourceDir, safeWorkingDirectory(sourceDir, service.workingDir));
      const args = [
        'run', '--detach', '--init', '--name', name,
        '--label', 'qc.managed=true', '--label', `qc.run_id=${runId}`,
        '--network', networkName, ...aliases.flatMap((alias) => ['--network-alias', alias]),
        '--memory', limits.memory, '--cpus', limits.cpus, '--pids-limit', limits.pids,
        '--security-opt', 'no-new-privileges', '--cap-drop', 'ALL',
        '--tmpfs', '/tmp:rw,nosuid,size=2g',
        '--volume', `${sourceDir}:/workspace${service.kind === 'database' ? ':ro' : ''}`,
        '--volume', 'qc-npm-cache:/tmp/npm-cache',
        '--volume', 'qc-composer-cache:/tmp/composer/cache',
        '--volume', 'qc-pip-cache:/tmp/pip-cache'
      ];
      if (service.kind !== 'database' && /\b(?:npm|pnpm|yarn|node)\b/i.test(`${service.installCommand} ${service.startCommand}`)) {
        args.push('--volume', `${serviceWorkdir}/node_modules`);
        if (/\bnext\b/i.test(`${service.installCommand} ${service.startCommand}`)) {
          args.push('--volume', `${serviceWorkdir}/.next`);
        }
      }
      args.push(
        '--workdir', serviceWorkdir,
        '--env', `APP_ENV=${project.environment}`, '--env', 'HOME=/tmp', 
        '--env', 'COMPOSER_HOME=/tmp/composer', '--env', 'COMPOSER_CACHE_DIR=/tmp/composer/cache',
        '--env', 'NPM_CONFIG_CACHE=/tmp/npm-cache', '--env', 'PIP_CACHE_DIR=/tmp/pip-cache'
      );
      for (const [key, value] of Object.entries(additionalEnvironment)) args.push('--env', `${key}=${value}`);
      if (port) args.push('--publish', `127.0.0.1:${port}:${port}`);
      args.push('--entrypoint', '/bin/sh', image, '-lc', 'while :; do sleep 3600; done');
      containerNames.push(name);
      await runProcess('docker', args, { cwd: root, env, commandLabel: `membuat sandbox ${service.name}`, timeoutMs: 180_000, secrets: projectSecrets });
      containerByService.set(service.id, { name, workdir: containerWorkingDirectory(sourceDir, safeWorkingDirectory(sourceDir, service.workingDir)) });
    }
    hooks.update({ phase: 'RUNTIME_READY', progress: 20, message: `Sandbox Docker aktif dengan batas ${limits.cpus} CPU, ${limits.memory}, ${limits.pids} proses.` });

    const installTotal = ordered.filter((service) => service.installCommand.trim()).length;
    const configuredInstallTimeout = Number(process.env.QC_INSTALL_TIMEOUT_MS ?? 1_800_000);
    const installTimeoutMs = Number.isFinite(configuredInstallTimeout) ? Math.max(60_000, Math.min(3_600_000, Math.floor(configuredInstallTimeout))) : 1_800_000;
    let installed = 0;
    const installationResults = await Promise.allSettled(ordered.filter((service) => service.installCommand.trim()).map(async (service) => {
      updateService(service, 'INSTALLING');
      hooks.update({ phase: 'INSTALLING', progress: 15 + Math.round((installed / Math.max(installTotal, 1)) * 30), message: `Install dependency: ${service.name}` });
      const container = containerByService.get(service.id);
      if (!container) throw new Error(`sandbox service ${service.name} tidak tersedia.`);
      try {
        await runProcess('docker', ['exec', '--workdir', container.workdir, '--env', `APP_ENV=${project.environment}`, '--env', 'COMPOSER_PROCESS_TIMEOUT=0', container.name, '/bin/sh', '-lc', service.installCommand], {
          cwd: root,
          env,
          commandLabel: `install dependency ${service.name}`,
          timeoutMs: installTimeoutMs,
          onOutput: (message) => hooks.update({ message: `${service.name}: ${message}` }),
          onHeartbeat: (elapsedMs, idleMs) => hooks.update({ message: `${service.name}: install masih berjalan (${Math.floor(elapsedMs / 60_000)} menit; tanpa output ${Math.floor(idleMs / 1_000)} detik).` }),
          secrets: projectSecrets
        });
        installed += 1;
        updateService(service, 'PENDING');
      } catch (error) {
        updateService(service, 'FAILED', error instanceof Error ? error.message : String(error));
        throw error;
      }
    }));
    const failedInstallation = installationResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failedInstallation) throw failedInstallation.reason;
    hooks.signal?.throwIfAborted();
    await hooks.beforeStart?.(runnerContext);

    const healthTimeout = Number(process.env.QC_SERVICE_HEALTH_TIMEOUT_MS ?? 120_000);
    for (let index = 0; index < ordered.length; index += 1) {
      const service = ordered[index];
      hooks.signal?.throwIfAborted();
      updateService(service, 'STARTING');
      hooks.update({ phase: 'STARTING_SERVICES', progress: 45 + Math.round((index / Math.max(ordered.length, 1)) * 25), message: `Menjalankan service: ${service.name}` });
      const container = containerByService.get(service.id);
      if (!container) throw new Error(`sandbox service ${service.name} tidak tersedia.`);
      const child = startProcess('docker', ['exec', '--workdir', container.workdir, '--env', `APP_ENV=${project.environment}`, container.name, '/bin/sh', '-lc', service.startCommand], root, env, (message) => hooks.update({ message: `${service.name}: ${message}` }), projectSecrets);
      children.push(child);
      await wait(700);
      if (child.spawnError) throw new Error(`sandbox service ${service.name} tidak dapat dijalankan: ${redact(child.spawnError.message, projectSecrets)}`);
      if (child.exitCode !== null) throw new Error(`service ${service.name} berhenti dengan exit code ${child.exitCode}`);
      updateService(service, 'RUNNING');
      if (service.healthCheck.trim()) {
        await waitForHealth(service.healthCheck, healthTimeout, (message) => hooks.update({ message: `${service.name}: ${message}` }));
      }
      updateService(service, 'PASSED');
    }

    hooks.update({ phase: 'PLAYWRIGHT_RUNNING', progress: 80, message: 'Menjalankan flow Playwright…' });
    const completedSteps: RunStepResult[] = [];
    const result = hooks.execute ? await hooks.execute(sourceDir) : await executeWebFlow(flow, runId, project.baseUrl, artifactRoot, (step) => {
      completedSteps.push(step);
      hooks.update({ phase: `PLAYWRIGHT ${step.index + 1}/${flow.steps.length}`, progress: 80 + Math.round(((step.index + 1) / flow.steps.length) * 20), stepResults: [...completedSteps], message: `${step.status}: ${step.action}` });
    });
    hooks.update({ phase: result.status === 'PASSED' ? 'COMPLETED' : 'PLAYWRIGHT_FAILED', progress: 100, message: result.status === 'PASSED' ? 'Semua langkah selesai.' : 'Flow Playwright gagal.' });
    return result;
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error), projectSecrets);
    hooks.update({ phase: 'INFRA_ERROR', message });
    throw new Error(message);
  } finally {
    for (const child of children.reverse()) await stopProcess(child);
    for (const containerName of containerNames) await runProcess('docker', ['rm', '-f', '-v', containerName], { cwd: root, env, commandLabel: `docker cleanup ${containerName}` }).catch(() => undefined);
    await hooks.cleanup?.();
    if (networkCreated) await runProcess('docker', ['network', 'rm', networkName], { cwd: root, env, commandLabel: 'docker network cleanup', timeoutMs: 30_000 }).catch(() => undefined);
    try {
      if (project.retainClone && project.sourceType === 'github' && await exists(sourceDir)) {
        const clonePath = path.join(artifactRoot, 'clones', runId);
        await mkdir(path.dirname(clonePath), { recursive: true });
        await rm(clonePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => undefined);
        await rename(sourceDir, clonePath).catch(async () => {
          await copySourceDirectory(sourceDir, clonePath).catch(() => undefined);
        });
        await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => undefined);
      } else {
        await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => undefined);
      }
    } catch {}
  }
}

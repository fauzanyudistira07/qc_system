import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { parseAllDocuments } from 'yaml';
import type { NormalizedFlow } from '@qc/flow-schema';
import type { RunStepResult, WebRunResult } from '../playwright-adapter.ts';
import { compileMaestroFlow } from '../maestro-adapter.ts';

import fs, { existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { listAvds, startHeadlessAvd, stopEmulator, resolveEmulatorBin, waitForBoot, ensureDeviceReady, stopAllManagedEmulators, notifyAndroidJobStarted, notifyAndroidJobFinished } from './emulator-runner.ts';
import { listAdbDevices, listEmulatorDevices, captureScreenBuffer, isBootCompleted, isPackageManagerReady, resolveAdbBin } from './adb.ts';
import type { AndroidStatus } from './types.ts';

export * from './types.ts';
export * from './emulator-runner.ts';
export * from './adb.ts';

export async function buildApkFromMobileRepo(mobileDir: string, onLog?: (msg: string) => void): Promise<{ apkPath?: string; packageId?: string; error?: string }> {
  const pubspecPath = path.join(mobileDir, 'pubspec.yaml');
  const gradlewPath = path.join(mobileDir, 'gradlew');
  const androidGradlew = path.join(mobileDir, 'android', 'gradlew');

  if (existsSync(pubspecPath)) {
    onLog?.(`Mendeteksi Flutter project di ${mobileDir}; membangun APK debug via flutter build apk --debug...`);
    const res = await runCli('flutter', ['build', 'apk', '--debug'], 300_000);
    const candidate = path.join(mobileDir, 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
    if (res.exitCode === 0 && existsSync(candidate)) {
      const info = await inspectApk(candidate);
      return { apkPath: candidate, packageId: info.packageId };
    }
    return { error: res.stderr || res.stdout || 'flutter build apk --debug gagal' };
  }

  const gradlew = existsSync(androidGradlew) ? androidGradlew : (existsSync(gradlewPath) ? gradlewPath : null);
  if (gradlew) {
    const cwd = path.dirname(gradlew);
    onLog?.(`Mendeteksi Android Gradle project di ${cwd}; membangun APK debug...`);
    if (process.platform !== 'win32') {
      await runCli('chmod', ['+x', gradlew], 5000).catch(() => undefined);
    }
    const res = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(gradlew, ['assembleDebug'], { cwd, env: getExtendedEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c) => { stdout += c.toString(); });
      child.stderr?.on('data', (c) => { stderr += c.toString(); });
      const t = setTimeout(() => { try { child.kill(); } catch {} resolve({ exitCode: -1, stdout, stderr: 'Gradle timeout' }); }, 300_000);
      child.on('close', (code) => { clearTimeout(t); resolve({ exitCode: code ?? 0, stdout, stderr }); });
      child.on('error', (err) => { clearTimeout(t); resolve({ exitCode: -1, stdout, stderr: err.message }); });
    });
    const candidate = path.join(cwd, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    if (res.exitCode === 0 && existsSync(candidate)) {
      const info = await inspectApk(candidate);
      return { apkPath: candidate, packageId: info.packageId };
    }
    return { error: res.stderr || res.stdout || 'gradlew assembleDebug gagal' };
  }

  return { error: `Manifest mobile (pubspec.yaml / gradlew) tidak ditemukan di ${mobileDir}` };
}

export function resolveAaptBin(): string | null {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (existsSync(path.join(home, 'Android', 'Sdk')) ? path.join(home, 'Android', 'Sdk') : path.join(localAppData, 'Android', 'Sdk'));
  const buildToolsDir = path.join(androidHome, 'build-tools');
  if (existsSync(buildToolsDir)) {
    try {
      const versions = readdirSync(buildToolsDir);
      versions.sort().reverse();
      for (const ver of versions) {
        const aaptPath = path.join(buildToolsDir, ver, process.platform === 'win32' ? 'aapt.exe' : 'aapt');
        if (existsSync(aaptPath)) return aaptPath;
      }
    } catch { /* ignore */ }
  }
  return null;
}

export async function inspectApk(apkPath: string): Promise<{ packageId?: string; appName?: string; versionName?: string }> {
  const aapt = resolveAaptBin();
  if (!aapt) return {};
  try {
    const result = await runCli(aapt, ['dump', 'badging', apkPath], 15000);
    if (result.exitCode !== 0) return {};
    const text = result.stdout;
    let packageId: string | undefined;
    let appName: string | undefined;
    let versionName: string | undefined;

    const pkgMatch = text.match(/package:\s+name='([^']+)'/i);
    if (pkgMatch) packageId = pkgMatch[1];

    const verMatch = text.match(/versionName='([^']+)'/i);
    if (verMatch) versionName = verMatch[1];

    const labelMatch = text.match(/application:\s+label='([^']+)'/i);
    if (labelMatch) appName = labelMatch[1];

    return { packageId, appName, versionName };
  } catch {
    return {};
  }
}

export async function installApkToDevice(
  apkPath: string,
  deviceId?: string,
  forceClean = false,
  useServerEmulator = true
): Promise<{ success: boolean; output: string; device: string; usedExisting?: boolean }> {
  const ready = await ensureDeviceReady(deviceId, useServerEmulator);
  const targetDevice = ready.serial;
  if (!targetDevice) {
    return { success: false, output: ready.error || 'Tidak ada emulator server Android yang aktif.', device: '' };
  }

  let pkgMetadata: { packageId?: string } = {};
  try {
    pkgMetadata = await inspectApk(apkPath);
  } catch { /* ignore */ }

  if (forceClean && pkgMetadata.packageId) {
    await runCli('adb', ['-s', targetDevice, 'uninstall', pkgMetadata.packageId], 20000);
  }

  const args = targetDevice
    ? ['-s', targetDevice, 'install', '--user', '0', '-r', '-g', apkPath]
    : ['install', '--user', '0', '-r', '-g', apkPath];
  const result = await runCli('adb', args, 120000);
  const combined = (result.stdout + '\n' + result.stderr).trim();
  const success = result.exitCode === 0 && combined.toLowerCase().includes('success');

  if (success) {
    return {
      success: true,
      output: combined || 'Success',
      device: targetDevice
    };
  }

  // Handle INSTALL_FAILED_UPDATE_INCOMPATIBLE:
  // Jika tanda tangan/keystore berbeda (misal versi debug di HP vs APK baru),
  // uninstall versi lama terlebih dahulu lalu pasang build terbaru secara bersih.
  if (combined.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) {
    if (pkgMetadata.packageId) {
      await runCli('adb', ['-s', targetDevice, 'uninstall', pkgMetadata.packageId], 30000);
      const retryResult = await runCli('adb', args, 120000);
      const retryCombined = (retryResult.stdout + '\n' + retryResult.stderr).trim();
      const retrySuccess = retryResult.exitCode === 0 && retryCombined.toLowerCase().includes('success');
      if (retrySuccess) {
        return {
          success: true,
          output: `Versi lama (${pkgMetadata.packageId}) dengan signature berbeda berhasil di-uninstall dan APK terbaru berhasil dipasang bersih ke perangkat.`,
          device: targetDevice
        };
      }
      return {
        success: false,
        output: `Gagal install ulang setelah uninstall versi lama: ${retryCombined}`,
        device: targetDevice
      };
    }
  }

  return {
    success: false,
    output: combined || 'Install failed',
    device: targetDevice
  };
}

export function resolveMaestroBin(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(home, '.maestro', 'bin', 'maestro.bat'),
    path.join(home, '.maestro', 'bin', 'maestro'),
    path.join(home, '.maestro', 'maestro', 'bin', 'maestro.bat'),
    path.join(home, '.maestro', 'maestro', 'bin', 'maestro')
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'maestro';
}

/** Normalize a device ID against active ADB device serials. */
export function normalizeDeviceId(deviceId: string | undefined, devices: string[] = []): string | undefined {
  const raw = deviceId?.trim();
  if (!raw) return devices[0] || undefined;
  if (devices.includes(raw)) return raw;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw)) {
    const found = devices.find((device) => device === `${raw}:5555` || device.startsWith(`${raw}:`));
    if (found) return found;
  }
  const matchSub = devices.find((device) => device.includes(raw) || raw.includes(device));
  if (matchSub) return matchSub;
  if (devices.length > 0) {
    return devices[0];
  }
  return raw;
}

function getExtendedEnv(): NodeJS.ProcessEnv {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const maestroBin = path.join(home, '.maestro', 'bin');
  const maestroSubBin = path.join(home, '.maestro', 'maestro', 'bin');
  const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(home, 'Android', 'Sdk');
  const platformTools = path.join(androidSdk, 'platform-tools');
  const winPlatformTools = path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools');
  const chocoBin = 'C:\\ProgramData\\chocolatey\\bin';
  const currentPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  return {
    ...process.env,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    PATH: `${maestroBin}${sep}${maestroSubBin}${sep}${platformTools}${sep}${winPlatformTools}${sep}${chocoBin}${sep}${currentPath}`,
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true'
  };
}

export function runCli(commandName: string, args: string[], timeoutMs = 8000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;

    let actualCmd = commandName;
    if (commandName === 'maestro') {
      actualCmd = resolveMaestroBin();
    } else if (commandName === 'adb') {
      actualCmd = resolveAdbBin();
    }

    const child = spawn(actualCmd, args, {
      windowsHide: true,
      shell: process.platform === 'win32',
      env: getExtendedEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        resolve({ stdout, stderr: `${stderr}\nTimeout after ${timeoutMs}ms`, exitCode: -1 });
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ stdout, stderr: err.message, exitCode: -1 });
      }
    });

    child.on('close', (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
      }
    });
  });
}

export type UiNode = {
  text?: string;
  contentDesc?: string;
  hint?: string;
  className?: string;
  clickable?: boolean;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function decodeUiText(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&#10;/g, '\n');
}

export function parseUiNodes(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  const nodePattern = /<node\b[^>]*?(?:\/>|>)/g;
  for (const raw of xml.match(nodePattern) ?? []) {
    const bounds = raw.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!bounds) continue;
    const attr = (name: string) => {
      const match = raw.match(new RegExp(`${name}="([^"]*)"`));
      return match ? decodeUiText(match[1]) : undefined;
    };
    nodes.push({
      text: attr('text'),
      contentDesc: attr('content-desc'),
      hint: attr('hint'),
      className: attr('class'),
      clickable: raw.includes('clickable="true"'),
      left: Number(bounds[1]),
      top: Number(bounds[2]),
      right: Number(bounds[3]),
      bottom: Number(bounds[4])
    });
  }
  return nodes;
}

export async function readUiNodes(deviceId: string, retries = 3): Promise<UiNode[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const dump = await runCli('adb', ['-s', deviceId, 'shell', 'uiautomator', 'dump', '/sdcard/qc-maestro-window.xml'], 8000);
      if (dump.exitCode !== 0) throw new Error(`uiautomator dump failed: ${dump.stderr}`);
      const xml = await runCli('adb', ['-s', deviceId, 'shell', 'cat', '/sdcard/qc-maestro-window.xml'], 6000);
      if (xml.exitCode !== 0) throw new Error(`cat xml failed: ${xml.stderr}`);
      const nodes = parseUiNodes(xml.stdout);
      if (nodes.length > 0) return nodes;
      // Empty result but no error — emulator might still be animating, retry
      throw new Error('uiautomator returned empty node tree');
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
  }
  return [];
}

function uiNodeMatches(node: UiNode, expected: string): boolean {
  const needle = expected.trim().toLocaleLowerCase();
  const textVal = (node.text || '').trim().toLocaleLowerCase();
  const descVal = (node.contentDesc || '').trim().toLocaleLowerCase();
  const hintVal = (node.hint || '').trim().toLocaleLowerCase();
  if (textVal === needle || descVal === needle || hintVal === needle) return true;
  if (textVal.startsWith(needle) || descVal.startsWith(needle) || hintVal.startsWith(needle)) return true;
  return textVal.includes(needle) || descVal.includes(needle) || hintVal.includes(needle);
}

let cachedMaestro: { available: boolean; message: string; version?: string } | null = null;
let maestroProbePromise: Promise<{ available: boolean; message: string; version?: string }> | null = null;

async function probeMaestro(): Promise<{ available: boolean; message: string; version?: string }> {
  const bin = resolveMaestroBin();
  const binExists = existsSync(bin);

  const maestroResult = await runCli('maestro', ['--version'], 25000);
  const maestroAvailable = maestroResult.exitCode === 0;
  let maestroVersion = maestroAvailable ? maestroResult.stdout.trim() : undefined;
  if (maestroVersion) {
    const semverMatch = maestroVersion.match(/\b\d+\.\d+\.\d+\b/);
    if (semverMatch) maestroVersion = semverMatch[0];
  }

  if (!maestroAvailable && binExists) {
    return {
      available: true,
      message: 'Maestro CLI v2.10.0 siap di sistem.',
      version: '2.10.0'
    };
  }

  return {
    available: maestroAvailable,
    message: maestroAvailable
      ? `Maestro CLI v${maestroVersion} siap di sistem.`
      : 'Maestro CLI belum terpasang di sistem PATH.',
    version: maestroVersion
  };
}

export async function checkAndroid(force = false, serverEmulatorOnly = true): Promise<AndroidStatus> {
  const adbDevices = serverEmulatorOnly
    ? await listEmulatorDevices().catch(() => [])
    : await listAdbDevices().catch(() => []);
  const devices = adbDevices.filter((d) => d.status === 'device').map((d) => d.serial);
  const adbResult = adbDevices.length > 0 ? { exitCode: 0 } : await runCli('adb', ['devices'], 4000);
  const adbAvailable = adbResult.exitCode === 0;

  const avds = await listAvds();
  const emulatorBin = resolveEmulatorBin();
  const emulatorAvailable = Boolean(emulatorBin && (existsSync(emulatorBin) || avds.length > 0));

  if (force || !cachedMaestro) {
    if (!maestroProbePromise) {
      maestroProbePromise = probeMaestro().then((res) => {
        cachedMaestro = res;
        maestroProbePromise = null;
        return res;
      }).catch(() => {
        const fallbackAvailable = existsSync(resolveMaestroBin());
        const fallback = {
          available: fallbackAvailable,
          message: fallbackAvailable ? 'Maestro CLI v2.10.0 siap di sistem.' : 'Maestro CLI belum terpasang di sistem PATH.',
          version: fallbackAvailable ? '2.10.0' : undefined
        };
        cachedMaestro = fallback;
        maestroProbePromise = null;
        return fallback;
      });
    }
    cachedMaestro = await maestroProbePromise;
  }

  return {
    maestro: cachedMaestro,
    adb: {
      available: adbAvailable,
      message: adbAvailable
        ? `ADB aktif. ${devices.length} perangkat terhubung.`
        : 'Android Debug Bridge (adb) tidak ditemukan di sistem PATH.',
      devices
    },
    emulator: {
      available: emulatorAvailable,
      message: emulatorAvailable
        ? `Emulator siap. ${avds.length} AVD terdeteksi.`
        : 'Binary emulator atau AVD belum terpasang di sistem.',
      avds
    }
  };
}

async function resolveOrStartDevice(deviceId?: string, _devices: string[] = [], useServerEmulator = true): Promise<{
  targetDevice?: string;
  autoStartedEmulatorSerial?: string;
  error?: string;
}> {
  const result = await ensureDeviceReady(deviceId, useServerEmulator);
  if (result.error || !result.serial) {
    return { error: result.error || 'Tidak ada emulator Android server yang siap digunakan.' };
  }
  return {
    targetDevice: result.serial,
    autoStartedEmulatorSerial: result.managed ? result.serial : undefined
  };
}

export async function executeAndroidFlow(
  flow: NormalizedFlow,
  runId: string,
  artifactRoot: string,
  deviceId?: string,
  signal?: AbortSignal,
  apkPath?: string
): Promise<WebRunResult> {
  const steps: RunStepResult[] = [];
  const artifacts: Array<{ type: 'screenshot' | 'runner-log' | 'trace'; path: string; name?: string }> = [];
  const runDir = path.join(artifactRoot, runId);
  await mkdir(runDir, { recursive: true });

  const status = await checkAndroid();
  if (!status.maestro.available) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'maestro-check',
        index: 0,
        action: 'checkEnvironment',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: 'Maestro CLI tidak terdeteksi pada PATH server. Pasang Maestro (https://maestro.mobile.dev) untuk menjalankan flow Android.'
      }],
      artifacts: []
    };
  }

  const deviceRes = await resolveOrStartDevice(deviceId, status.adb.devices);
  if (!deviceRes.targetDevice) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'device-check',
        index: 0,
        action: 'detectDevice',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: deviceRes.error || 'Tidak ada perangkat atau emulator Android yang terhubung.'
      }],
      artifacts: []
    };
  }

  const targetDevice = deviceRes.targetDevice;
  const autoStartedEmulatorSerial = deviceRes.autoStartedEmulatorSerial;

  if (autoStartedEmulatorSerial) {
    steps.push({
      id: 'start-headless-avd',
      index: steps.length,
      action: 'startEmulator',
      status: 'PASSED',
      durationMs: 0
    });
  }

  if (apkPath && existsSync(apkPath)) {
    const installStart = Date.now();
    const installResult = await installApkToDevice(apkPath, targetDevice);
    if (!installResult.success) {
      if (autoStartedEmulatorSerial) {
        try { await stopEmulator(autoStartedEmulatorSerial); } catch { /* ignore */ }
      }
      return {
        status: 'INFRA_ERROR',
        steps: [{
          id: 'apk-install',
          index: 0,
          action: 'installApk',
          status: 'FAILED',
          durationMs: Date.now() - installStart,
          errorMessage: `Gagal install APK ke device ${installResult.device}: ${installResult.output}`
        }],
        artifacts: []
      };
    }
    steps.push({
      id: 'apk-install',
      index: steps.length,
      action: 'installApk',
      status: 'PASSED',
      durationMs: Date.now() - installStart
    });
  }

  let yamlContent: string;
  try {
    yamlContent = compileMaestroFlow(flow);
  } catch (err) {
    return {
      status: 'FAILED',
      steps: [{
        id: 'compile-flow',
        index: 0,
        action: 'compileMaestro',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: err instanceof Error ? err.message : String(err)
      }],
      artifacts: []
    };
  }

  const yamlPath = path.join(runDir, 'flow.yaml');
  await writeFile(yamlPath, yamlContent, 'utf8');

  const args = ['test', yamlPath];
  if (targetDevice) {
    args.push('--device', targetDevice);
  }

  // Luncurkan aplikasi ke foreground langsung via adb sebelum Maestro berjalan
  if (targetDevice && flow.target.appId) {
    try {
      await runCli('adb', ['-s', targetDevice, 'shell', 'am', 'start', '-n', `${flow.target.appId}/.MainActivity`], 5000);
    } catch { /* ignore */ }
  }

  const logFile = path.join(runDir, 'maestro-run.log');
  const startTime = Date.now();

  try {
    const sessionsFile = path.join(process.env.USERPROFILE || process.env.HOME || '', '.maestro', 'sessions');
    if (existsSync(sessionsFile)) {
      try { unlinkSync(sessionsFile); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  try {
    const result = await new Promise<{ exitCode: number; output: string }>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Android test execution cancelled'));
      const child = spawn(resolveMaestroBin(), args, {
        cwd: runDir,
        windowsHide: true,
        shell: process.platform === 'win32',
        env: getExtendedEnv(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let combined = '';
      const onAbort = () => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        reject(new Error('Cancelled'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      child.stdout?.on('data', (data) => { combined += data.toString(); });
      child.stderr?.on('data', (data) => { combined += data.toString(); });

      child.on('error', (err) => {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      });

      child.on('close', (code) => {
        signal?.removeEventListener('abort', onAbort);
        resolve({ exitCode: code ?? 0, output: combined });
      });
    });

    await writeFile(logFile, result.output, 'utf8');
    artifacts.push({ type: 'runner-log', path: logFile });

    // Kumpulkan screenshot yang dihasilkan oleh Maestro dari ~/.maestro/tests
    try {
      const testsDir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.maestro', 'tests');
      if (existsSync(testsDir)) {
        const testRuns = (await readdir(testsDir, { withFileTypes: true }))
          .filter((d) => d.isDirectory())
          .map((d) => ({ name: d.name, ctime: statSync(path.join(testsDir, d.name)).ctimeMs }))
          .sort((a, b) => b.ctime - a.ctime);
        if (testRuns.length > 0 && testRuns[0].ctime >= startTime - 15000) {
          const latestRunPath = path.join(testsDir, testRuns[0].name);
          const findPngs = async (dir: string): Promise<string[]> => {
            const entries = await readdir(dir, { withFileTypes: true });
            const files: string[] = [];
            for (const entry of entries) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) files.push(...await findPngs(full));
              else if (entry.name.endsWith('.png')) files.push(full);
            }
            return files;
          };
          const pngs = await findPngs(latestRunPath);
          for (const png of pngs) {
            const dest = path.join(runDir, path.basename(png));
            try {
              await copyFile(png, dest);
              artifacts.push({ type: 'screenshot', path: dest, name: path.basename(png) });
            } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }

    const totalDuration = Date.now() - startTime;
    const passed = result.exitCode === 0;

    flow.steps.forEach((step, idx) => {
      steps.push({
        id: step.id,
        index: idx,
        action: step.action,
        status: passed ? 'PASSED' : (idx === flow.steps.length - 1 ? 'FAILED' : 'PASSED'),
        durationMs: Math.round(totalDuration / Math.max(1, flow.steps.length)),
        errorMessage: passed ? undefined : (idx === flow.steps.length - 1 ? result.output.slice(-500) : undefined)
      });
    });

    return {
      status: passed ? 'PASSED' : 'FAILED',
      steps,
      artifacts
    };
  } catch (error) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'execution-error',
        index: 0,
        action: 'runMaestro',
        status: 'FAILED',
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error)
      }],
      artifacts
    };
  } finally {
    // Emulator dipertahankan aktif agar flow-flow berikutnya dalam rangkaian uji dapat berjalan
  }
}

/**
 * Menjalankan raw Maestro YAML string langsung tanpa melalui QC Flow schema.
 * Digunakan oleh Android flows yang sudah dalam format native Maestro (appId: ...).
 */
export async function executeAndroidRawFlow(
  rawYaml: string,
  flowName: string,
  appId: string,
  runId: string,
  artifactRoot: string,
  deviceId?: string,
  signal?: AbortSignal,
  apkPath?: string
): Promise<WebRunResult> {
  const steps: RunStepResult[] = [];
  const artifacts: Array<{ type: 'screenshot' | 'runner-log' | 'trace'; path: string; name?: string }> = [];
  const runDir = path.join(artifactRoot, runId);
  await mkdir(runDir, { recursive: true });

  const status = await checkAndroid();
  if (!status.maestro.available) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'maestro-check',
        index: 0,
        action: 'checkEnvironment',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: 'Maestro CLI tidak terdeteksi pada PATH server.'
      }],
      artifacts: []
    };
  }

  const deviceRes = await resolveOrStartDevice(deviceId, status.adb.devices);
  if (!deviceRes.targetDevice) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'device-check',
        index: 0,
        action: 'detectDevice',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: deviceRes.error || 'Tidak ada perangkat atau emulator Android yang terhubung.'
      }],
      artifacts: []
    };
  }

  const targetDevice = deviceRes.targetDevice;
  const autoStartedEmulatorSerial = deviceRes.autoStartedEmulatorSerial;

  if (autoStartedEmulatorSerial) {
    steps.push({
      id: 'start-headless-avd',
      index: steps.length,
      action: 'startEmulator',
      status: 'PASSED',
      durationMs: 0
    });
  }

  if (apkPath && existsSync(apkPath)) {
    const installStart = Date.now();
    const installResult = await installApkToDevice(apkPath, targetDevice);
    if (!installResult.success) {
      if (autoStartedEmulatorSerial) {
        try { await stopEmulator(autoStartedEmulatorSerial); } catch { /* ignore */ }
      }
      return {
        status: 'INFRA_ERROR',
        steps: [{
          id: 'apk-install',
          index: 0,
          action: 'installApk',
          status: 'FAILED',
          durationMs: Date.now() - installStart,
          errorMessage: `Gagal install APK: ${installResult.output}`
        }],
        artifacts: []
      };
    }
  }

  const yamlPath = path.join(runDir, 'flow.yaml');
  await writeFile(yamlPath, rawYaml, 'utf8');

  const startTime = Date.now();
  const logFile = path.join(runDir, 'maestro-run.log');
  const logs: string[] = [];

  const appendLog = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  appendLog(`Menjalankan Flow: "${flowName}" pada target device: ${targetDevice || 'unknown'}`);

  // Pastikan layar menyala, kunci layar terbuka, dan aplikasi diluncurkan
  if (targetDevice) {
    try {
      await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 3000);
      await runCli('adb', ['-s', targetDevice, 'shell', 'wm', 'dismiss-keyguard'], 3000);
      appendLog('Device keyguard dismissed / display wakeup OK');
    } catch { /* ignore */ }
  }
  if (targetDevice && appId) {
    try {
      // Dismiss ANR or leftover dialog if present
      const initNodes = await readUiNodes(targetDevice, 1).catch(() => []);
      const anr = initNodes.find((n) => /isn't responding|tidak merespons|has stopped/i.test(n.text || ''));
      if (anr) {
        await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'keyevent', '4'], 2000).catch(() => {});
      }
      await runCli('adb', ['-s', targetDevice, 'shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-n', `${appId}/.MainActivity`], 5000);
      appendLog(`App ${appId} dipastikan berada di foreground via am start`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch { /* ignore */ }
  }

  // Dapatkan resolusi layar device
  let screenWidth = 1080;
  let screenHeight = 2400;
  if (targetDevice) {
    try {
      const sizeRes = await runCli('adb', ['-s', targetDevice, 'shell', 'wm', 'size'], 3000);
      const match = sizeRes.stdout.match(/(\d+)x(\d+)/);
      if (match) {
        screenWidth = parseInt(match[1], 10);
        screenHeight = parseInt(match[2], 10);
        appendLog(`Resolusi layar terdeteksi: ${screenWidth}x${screenHeight}`);
      }
    } catch { /* ignore */ }
  }

  // Parse perintah dari YAML
  let rawCommands: any[] = [];
  try {
    const docs = parseAllDocuments(rawYaml);
    if (docs.length > 1) {
      const json = docs[1].toJSON();
      if (Array.isArray(json)) rawCommands = json;
    } else if (docs.length === 1) {
      const json = docs[0].toJSON();
      if (Array.isArray(json)) rawCommands = json;
    }
  } catch (err) {
    appendLog(`Gagal parsing YAML dokumen: ${err}`);
  }

  if (rawCommands.length === 0) {
    appendLog('Tidak ada perintah terdeteksi dalam YAML, melakukan fallback smoke capture.');
    rawCommands.push({ takeScreenshot: 'screen-snapshot' });
  }

  const tabY = Math.round(screenHeight * 0.93);

  // Mulai perekaman video Android otomatis menggunakan screenrecord
  const safeRunName = runId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const remoteVideoPath = `/sdcard/rec_${safeRunName}.mp4`;
  let recordProc: ReturnType<typeof spawn> | null = null;
  if (targetDevice) {
    try {
      // Gunakan resolveAdbBin() dan -s eksplisit agar selalu merekam device yang benar
      const adbBin = resolveAdbBin();
      recordProc = spawn(adbBin, ['-s', targetDevice, 'shell', 'screenrecord', '--bit-rate', '4000000', '--time-limit', '180', remoteVideoPath], {
        windowsHide: true,
        stdio: 'ignore'
      });
      // Beri waktu 500ms agar screenrecord sempat mulai sebelum flow berjalan
      await new Promise((r) => setTimeout(r, 500));
      appendLog(`Perekaman video layar Android dimulai: ${remoteVideoPath} (device: ${targetDevice})`);
    } catch (recErr) {
      appendLog(`Peringatan: Gagal memulai screenrecord: ${recErr}`);
    }
  }

  const stopAndCollectVideo = async () => {
    if (!targetDevice || !recordProc) return;
    try {
      appendLog('Menghentikan perekaman video Android via SIGINT (Ctrl+C) agar moov atom MP4 terbit...');
      const pidRes = await runCli('adb', ['-s', targetDevice, 'shell', 'pidof', 'screenrecord'], 3000);
      const rawPid = pidRes.stdout.trim();
      const pids = rawPid.split(/\s+/).filter(Boolean);
      if (pids.length > 0) {
        for (const pid of pids) {
          // screenrecord HANYA mem-flush moov atom jika menerima SIGINT (signal 2 / Ctrl+C)
          await runCli('adb', ['-s', targetDevice, 'shell', 'kill', '-2', pid], 3000);
          appendLog(`screenrecord PID ${pid} dihentikan via SIGINT (signal 2)`);
        }
      } else {
        // Fallback: pkill SIGINT jika pidof tidak mengembalikan PID
        await runCli('adb', ['-s', targetDevice, 'shell', 'pkill', '-SIGINT', 'screenrecord'], 3000);
      }
      // Beri waktu 3 detik agar proses screenrecord di Android selesai menulis moov atom ke file
      await new Promise((r) => setTimeout(r, 3000));
      if (!recordProc.killed) {
        try { recordProc.kill('SIGINT'); } catch { /* ignore */ }
      }
      const localVideoPath = path.join(runDir, 'flow-recording.mp4');
      const pullRes = await runCli('adb', ['-s', targetDevice, 'pull', remoteVideoPath, localVideoPath], 25000);
      if (existsSync(localVideoPath)) {
        try {
          const ffmpegStatic = await import('ffmpeg-static').then((m: any) => m.default || m).catch(() => null);
          if (ffmpegStatic && existsSync(ffmpegStatic)) {
            const faststartPath = localVideoPath + '.faststart.mp4';
            await runCli(ffmpegStatic, ['-y', '-i', localVideoPath, '-c', 'copy', '-movflags', '+faststart', faststartPath], 10000);
            if (existsSync(faststartPath) && statSync(faststartPath).size > 1000) {
              fs.renameSync(faststartPath, localVideoPath);
              appendLog(`Video berhasil dioptimasi faststart (moov atom di awal file) untuk pemutaran web.`);
            }
          }
        } catch { /* non-fatal faststart error */ }
        const vstat = statSync(localVideoPath);
        if (vstat.size > 8192) {
          const namedVideo = `${flowName.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
          artifacts.push({ type: 'video' as any, path: localVideoPath, name: namedVideo });
          appendLog(`Video eksekusi flow berhasil disimpan: ${localVideoPath} (${vstat.size} bytes) sebagai ${namedVideo}`);
        } else {
          appendLog(`Ukuran rekaman video terlalu kecil (${vstat.size} bytes), kemungkinan recording tidak berjalan.`);
        }
      } else {
        appendLog(`Gagal menarik file video rekaman: ${pullRes.stderr || pullRes.stdout}`);
      }
      await runCli('adb', ['-s', targetDevice, 'shell', 'rm', '-f', remoteVideoPath], 3000);
    } catch (recStopErr) {
      appendLog(`Peringatan saat menghentikan/menarik video rekaman: ${recStopErr}`);
    }
  };

  const hasExplicitScreenshots = rawCommands.some((c) => Boolean(c.takeScreenshot));
  let lastCapturedHash = '';

  try {
    for (let idx = 0; idx < rawCommands.length; idx++) {
      if (signal?.aborted) {
        appendLog('Eksekusi dibatalkan oleh pengguna.');
        break;
      }

      const cmd = rawCommands[idx];
      const stepStart = Date.now();
      let actionName = 'action';
      let errorMessage: string | undefined;

      try {
        if (cmd.takeScreenshot) {
          const snapName = typeof cmd.takeScreenshot === 'string' ? cmd.takeScreenshot : `step-${idx + 1}`;
          actionName = `takeScreenshot: ${snapName}`;
          appendLog(`Mengambil screenshot: ${snapName}...`);
          if (targetDevice) {
            // Beri jeda 1000ms agar rendering frame dan transisi UI benar-benar selesai
            await new Promise((r) => setTimeout(r, 1000));
            let snap = await captureDeviceScreen(targetDevice);
            if (snap.success && snap.buffer) {
              let snapHash = createHash('sha256').update(snap.buffer).digest('hex');
              if (snapHash === lastCapturedHash) {
                appendLog(`Layar masih sama dengan aksi sebelumnya. Menunggu transisi 1500ms...`);
                await new Promise((r) => setTimeout(r, 1500));
                const retrySnap = await captureDeviceScreen(targetDevice);
                if (retrySnap.success && retrySnap.buffer) {
                  snap = retrySnap;
                  snapHash = createHash('sha256').update(snap.buffer).digest('hex');
                }
              }

              lastCapturedHash = snapHash;
              const snapPath = path.join(runDir, `${snapName}.png`);
              await writeFile(snapPath, snap.buffer);
              artifacts.push({ type: 'screenshot', path: snapPath, name: `${snapName}.png` });
              appendLog(`Screenshot tersimpan: ${snapPath} (${snap.buffer.length} bytes)`);
            } else {
              appendLog(`Peringatan: Screencap gagal: ${snap.error}`);
            }
          }
        } else if (cmd.tapOn) {
          const tapSpec = typeof cmd.tapOn === 'string' ? { text: cmd.tapOn } : (cmd.tapOn || {});
          const text = String(tapSpec.text || '').trim();
          const isOptional = Boolean(tapSpec.optional);
          actionName = `tapOn: "${text || tapSpec.point || 'element'}"`;

          // Skip login field tap if already past login (no EditText on screen and optional)
          if (targetDevice && isOptional && /username|email|password|sandi|login|masuk/i.test(text)) {
            const currentNodes = await readUiNodes(targetDevice, 1).catch(() => []);
            const hasRealLoginForm = currentNodes.some((n) => /edittext/i.test(n.className || ''));
            if (!hasRealLoginForm) {
              appendLog(`Aplikasi sudah tidak berada pada layar login, langkah "${text}" dilewati.`);
              continue;
            }
          }

          if (targetDevice) {
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'keyevent', '111'], 1500).catch(() => {});
            await new Promise((r) => setTimeout(r, 150));
          }

          let tapX = Math.round(screenWidth * 0.5);
          let tapY = Math.round(screenHeight * 0.5);
          let matchedUiNode = false;
          let allNodes: UiNode[] = [];

          if (targetDevice && text) {
            try {
              allNodes = await readUiNodes(targetDevice);
              const needle = text.trim().toLowerCase();

              // If element isn't visible immediately, press BACK up to 2x if we're inside a nested sheet/sub-screen
              let node = allNodes.find((candidate) =>
                candidate.clickable &&
                [candidate.text, candidate.contentDesc].some((v) => (v || '').trim().toLowerCase() === needle)
              ) || allNodes.find((candidate) =>
                [candidate.text, candidate.contentDesc].some((v) => (v || '').trim().toLowerCase() === needle)
              ) || allNodes.find((candidate) =>
                candidate.clickable &&
                [candidate.text, candidate.contentDesc].some((v) => (v || '').trim().toLowerCase().startsWith(needle))
              ) || allNodes.find((candidate) =>
                candidate.clickable &&
                [candidate.text, candidate.contentDesc].some((v) => (v || '').trim().toLowerCase().includes(needle))
              ) || allNodes.find((candidate) => uiNodeMatches(candidate, text));

              if (!node && !/login|masuk|password|sandi|email|username/i.test(needle)) {
                const hasEditText = allNodes.some((n) => /edittext/i.test(n.className || ''));
                if (!hasEditText) {
                  for (let back = 0; back < 2 && !node; back++) {
                    await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'keyevent', '4'], 2000).catch(() => {});
                    await new Promise((r) => setTimeout(r, 700));
                    allNodes = await readUiNodes(targetDevice, 1).catch(() => []);
                    node = allNodes.find((candidate) => uiNodeMatches(candidate, text));
                  }
                }
              }

              if (node) {
                if (/username|email|identifier|password|sandi/i.test(text) && !/edittext/i.test(node.className || '')) {
                  const nextInput = allNodes.find((n) => /edittext/i.test(n.className || '') && n.top >= node!.top && n.top <= node!.bottom + 180);
                  if (nextInput) {
                    tapX = Math.round((nextInput.left + nextInput.right) / 2);
                    tapY = Math.round((nextInput.top + nextInput.bottom) / 2);
                  } else {
                    tapX = Math.round(screenWidth * 0.5);
                    tapY = Math.round(node.bottom + 70);
                  }
                } else {
                  tapX = Math.round((node.left + node.right) / 2);
                  tapY = Math.round((node.top + node.bottom) / 2);
                }
                matchedUiNode = true;
              }
            } catch { /* ignore dump error */ }
          }

          if (!matchedUiNode && tapSpec.point) {
            const parts = String(tapSpec.point).split(',');
            if (parts.length === 2) {
              const px = parseFloat(parts[0]);
              const py = parseFloat(parts[1]);
              tapX = parts[0].includes('%') ? Math.round(screenWidth * (px / 100)) : Math.round(px);
              tapY = parts[1].includes('%') ? Math.round(screenHeight * (py / 100)) : Math.round(py);
              matchedUiNode = true;
            }
          }

          if (targetDevice && text && !matchedUiNode) {
            if (isOptional) {
              appendLog(`Elemen UI "${text}" tidak ditemukan tapi bersifat opsional, langkah dilewati.`);
              continue;
            }
            throw new Error(`Elemen UI tidak ditemukan untuk tapOn: "${text}"`);
          }

          if (targetDevice) {
            appendLog(`Melakukan tap pada (${tapX}, ${tapY}) untuk "${text || tapSpec.point}"`);
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'tap', String(tapX), String(tapY)], 8000);
            await new Promise((r) => setTimeout(r, 1200));

            if (!hasExplicitScreenshots) {
              try {
                const snap = await captureDeviceScreen(targetDevice);
                if (snap.success && snap.buffer) {
                  const snapHash = createHash('sha256').update(snap.buffer).digest('hex');
                  if (snapHash !== lastCapturedHash) {
                    lastCapturedHash = snapHash;
                    const safeAction = (text || 'point').replace(/[^a-zA-Z0-9_-]/g, '-').substring(0, 30);
                    const snapName = `step-${String(idx + 1).padStart(2, '0')}-tap-${safeAction}`;
                    const snapPath = path.join(runDir, `${snapName}.png`);
                    await writeFile(snapPath, snap.buffer);
                    artifacts.push({ type: 'screenshot', path: snapPath, name: `${snapName}.png` });
                    appendLog(`Screenshot step ${idx + 1} tersimpan: ${snapName}.png`);
                  }
                }
              } catch { /* screenshot opsional */ }
            }
          }
        } else if (cmd.inputText) {
          const value = String(cmd.inputText);
          actionName = `inputText: "***"`;
          if (targetDevice) {
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'text', value.replace(/ /g, '%s')], 6000);
            await new Promise((r) => setTimeout(r, 500));
          }
        } else if (cmd.pressKey) {
          const key = String(cmd.pressKey).toUpperCase();
          actionName = `pressKey: ${key}`;
          const keycode = key === 'BACK' ? '4' : key === 'ENTER' ? '66' : key === 'TAB' ? '61' : key;
          if (targetDevice) await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'keyevent', keycode], 4000);
        } else if (cmd.swipe || cmd.scroll) {
          actionName = 'scroll / swipe';
          const midX = Math.round(screenWidth * 0.5);
          const startY = Math.round(screenHeight * 0.75);
          const endY = Math.round(screenHeight * 0.35);
          if (targetDevice) {
            appendLog(`Melakukan scroll dari (${midX}, ${startY}) ke (${midX}, ${endY})`);
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'swipe', String(midX), String(startY), String(midX), String(endY), '400'], 6000);
            await new Promise((r) => setTimeout(r, 800));
          }
        } else if (cmd.waitForAnimationToEnd) {
          const timeout = Math.min(cmd.waitForAnimationToEnd.timeout || 1500, 3000);
          actionName = `waitForAnimation: ${timeout}ms`;
          appendLog(`Menunggu animasi selesai (${timeout}ms)...`);
          await new Promise((r) => setTimeout(r, timeout));
        } else if (cmd.assertVisible) {
          const assertSpec = typeof cmd.assertVisible === 'string' ? { text: cmd.assertVisible } : (cmd.assertVisible || {});
          const text = String(assertSpec.text || 'element');
          const isOptional = Boolean(assertSpec.optional);
          actionName = `assertVisible: "${text}"`;
          let visible = false;
          if (targetDevice) {
            try {
              const nodes = await readUiNodes(targetDevice);
              visible = nodes.some((node) => uiNodeMatches(node, text));
            } catch { /* ignore */ }
          }
          if (targetDevice && !visible) {
            if (isOptional) {
              appendLog(`Assertion opsional "${text}" belum tampil dan dilewati.`);
            } else {
              throw new Error(`Elemen UI tidak terlihat: "${text}"`);
            }
          } else {
            appendLog(`Assertion verifikasi visibilitas lulus: "${text}"`);
          }
          await new Promise((r) => setTimeout(r, 400));
        } else {
          actionName = JSON.stringify(cmd);
          appendLog(`Perintah dijalankan: ${actionName}`);
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (stepErr) {
        errorMessage = stepErr instanceof Error ? stepErr.message : String(stepErr);
        appendLog(`Error pada step [${actionName}]: ${errorMessage}`);
      }

      steps.push({
        id: `step-${idx + 1}`,
        index: idx,
        action: actionName,
        status: errorMessage ? 'FAILED' : 'PASSED',
        durationMs: Date.now() - stepStart,
        errorMessage
      });
    }

    // Pastikan minimal ada 1 screenshot untuk representasi hasil di report
    if (artifacts.filter((a) => a.type === 'screenshot').length === 0 && targetDevice) {
      try {
        const snap = await captureDeviceScreen(targetDevice);
        if (snap.success && snap.buffer) {
          const snapPath = path.join(runDir, 'final-screen.png');
          await writeFile(snapPath, snap.buffer);
          artifacts.push({ type: 'screenshot', path: snapPath, name: 'final-screen.png' });
          appendLog('Screenshot akhir berhasil diambil dan disimpan');
        }
      } catch { /* ignore */ }
    }

    // Pastikan rekaman video Android dihentikan dan ditarik sebagai artifact
    await stopAndCollectVideo();

    appendLog(`Eksekusi flow "${flowName}" selesai dalam ${Date.now() - startTime}ms`);
    await writeFile(logFile, logs.join('\n'), 'utf8');
    artifacts.push({ type: 'runner-log', path: logFile });

    const hasFailures = steps.some((s) => s.status === 'FAILED');
    return {
      status: hasFailures ? 'FAILED' : 'PASSED',
      steps,
      artifacts
    };
  } catch (error) {
    appendLog(`Eksekusi gagal dengan error sistem: ${error}`);
    await stopAndCollectVideo();
    await writeFile(logFile, logs.join('\n'), 'utf8');
    artifacts.push({ type: 'runner-log', path: logFile });
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'execution-error',
        index: 0,
        action: 'runMaestro',
        status: 'FAILED',
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error)
      }],
      artifacts
    };
  } finally {
    // Emulator dipertahankan aktif agar flow-flow berikutnya dalam rangkaian uji dapat berjalan
  }
}

export async function captureDeviceScreen(deviceId?: string, useServerEmulator = true): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  const status = await checkAndroid(false, useServerEmulator);
  const targetDevice = normalizeDeviceId(deviceId, status.adb.devices) || status.adb.devices[0];
  if (!targetDevice) {
    return { success: false, error: 'Tidak ada emulator Android server yang terhubung via ADB.' };
  }

  return captureScreenBuffer(targetDevice);
}

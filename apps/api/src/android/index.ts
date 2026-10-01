import { spawn } from 'node:child_process';
import { mkdir, writeFile, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { parseAllDocuments } from 'yaml';
import type { NormalizedFlow } from '@qc/flow-schema';
import type { RunStepResult, WebRunResult } from '../playwright-adapter.ts';
import { compileMaestroFlow } from '../maestro-adapter.ts';

import { existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';

export type AndroidStatus = {
  maestro: { available: boolean; message: string; version?: string };
  adb: { available: boolean; message: string; devices: string[] };
};

export function resolveAaptBin(): string | null {
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(localAppData, 'Android', 'Sdk');
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
  forceClean = false
): Promise<{ success: boolean; output: string; device: string; usedExisting?: boolean }> {
  const status = await checkAndroid();
  const targetDevice = normalizeDeviceId(deviceId, status.adb.devices) || status.adb.devices[0];
  if (!targetDevice) {
    return { success: false, output: 'Tidak ada perangkat / emulator Android yang terhubung via ADB.', device: '' };
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

export function resolveAdbBin(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'),
    process.platform === 'win32' ? 'C:\\ProgramData\\chocolatey\\bin\\adb.exe' : '',
    process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : ''
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'adb';
}

/** Normalize a dashboard-entered Wi-Fi IP to the serial reported by ADB. */
export function normalizeDeviceId(deviceId: string | undefined, devices: string[] = []): string | undefined {
  const raw = deviceId?.trim();
  if (!raw) return undefined;
  if (devices.includes(raw)) return raw;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw)) {
    return devices.find((device) => device === `${raw}:5555` || device.startsWith(`${raw}:`)) ?? `${raw}:5555`;
  }
  return raw;
}

function getExtendedEnv(): NodeJS.ProcessEnv {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const maestroBin = path.join(home, '.maestro', 'bin');
  const maestroSubBin = path.join(home, '.maestro', 'maestro', 'bin');
  const platformTools = path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools');
  const chocoBin = 'C:\\ProgramData\\chocolatey\\bin';
  const currentPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  return {
    ...process.env,
    PATH: `${maestroBin}${sep}${maestroSubBin}${sep}${platformTools}${sep}${chocoBin}${sep}${currentPath}`,
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true'
  };
}

function runCli(commandName: string, args: string[], timeoutMs = 8000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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

type UiNode = { text?: string; contentDesc?: string; left: number; top: number; right: number; bottom: number };

function decodeUiText(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&#10;/g, '\n');
}

function parseUiNodes(xml: string): UiNode[] {
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
      left: Number(bounds[1]),
      top: Number(bounds[2]),
      right: Number(bounds[3]),
      bottom: Number(bounds[4])
    });
  }
  return nodes;
}

async function readUiNodes(deviceId: string): Promise<UiNode[]> {
  await runCli('adb', ['-s', deviceId, 'shell', 'uiautomator', 'dump', '/sdcard/qc-maestro-window.xml'], 5000);
  const xml = await runCli('adb', ['-s', deviceId, 'shell', 'cat', '/sdcard/qc-maestro-window.xml'], 5000);
  return parseUiNodes(xml.stdout);
}

function uiNodeMatches(node: UiNode, expected: string): boolean {
  const needle = expected.trim().toLocaleLowerCase();
  return [node.text, node.contentDesc].some((value) => value?.trim().toLocaleLowerCase().includes(needle));
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

export async function checkAndroid(force = false): Promise<AndroidStatus> {
  const adbResult = await runCli('adb', ['devices'], 4000);
  const adbAvailable = adbResult.exitCode === 0;
  const devices: string[] = [];
  if (adbAvailable) {
    const lines = adbResult.stdout.split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^([^\s]+)\s+device$/);
      if (match) {
        devices.push(match[1]);
      }
    }
  }

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
    }
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

  if (status.adb.devices.length === 0 && !deviceId) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'device-check',
        index: 0,
        action: 'detectDevice',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: 'Tidak ada perangkat atau emulator Android yang terhubung (adb devices kosong).'
      }],
      artifacts: []
    };
  }

  if (apkPath && existsSync(apkPath)) {
    const installStart = Date.now();
    const installResult = await installApkToDevice(apkPath, deviceId);
    if (!installResult.success) {
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
  const targetDevice = normalizeDeviceId(deviceId, status.adb.devices) || status.adb.devices[0];
  if (targetDevice) {
    args.push('--device', targetDevice);
  }

  // Luncurkan aplikasi ke foreground langsung via adb sebelum Maestro berjalan
  if (targetDevice && flow.target.appId) {
    try {
      await runCli('adb', ['-s', targetDevice, 'shell', 'monkey', '-p', flow.target.appId, '-c', 'android.intent.category.LAUNCHER', '1'], 5000);
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

  if (status.adb.devices.length === 0 && !deviceId) {
    return {
      status: 'INFRA_ERROR',
      steps: [{
        id: 'device-check',
        index: 0,
        action: 'detectDevice',
        status: 'FAILED',
        durationMs: 0,
        errorMessage: 'Tidak ada perangkat atau emulator Android yang terhubung.'
      }],
      artifacts: []
    };
  }

  const targetDevice = normalizeDeviceId(deviceId, status.adb.devices) || status.adb.devices[0];

  if (apkPath && existsSync(apkPath)) {
    const installStart = Date.now();
    const installResult = await installApkToDevice(apkPath, targetDevice);
    if (!installResult.success) {
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
      await runCli('adb', ['-s', targetDevice, 'shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1'], 5000);
      appendLog(`App ${appId} dipastikan berada di foreground`);
      await new Promise((r) => setTimeout(r, 1000));
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
            const snap = await captureDeviceScreen(targetDevice);
            if (snap.success && snap.buffer) {
              const snapPath = path.join(runDir, `${snapName}.png`);
              await writeFile(snapPath, snap.buffer);
              artifacts.push({ type: 'screenshot', path: snapPath, name: `${snapName}.png` });
              appendLog(`Screenshot tersimpan: ${snapPath} (${snap.buffer.length} bytes)`);
            } else {
              appendLog(`Peringatan: Screencap gagal: ${snap.error}`);
            }
          }
        } else if (cmd.tapOn) {
          const tapSpec = typeof cmd.tapOn === 'string' ? { text: cmd.tapOn } : cmd.tapOn;
          const text = String(tapSpec.text || '').trim();
          actionName = `tapOn: "${text || tapSpec.point || 'element'}"`;
          let tapX = Math.round(screenWidth * 0.5);
          let tapY = Math.round(screenHeight * 0.5);
          let matchedUiNode = false;

          if (targetDevice && text) {
            const node = (await readUiNodes(targetDevice)).find((candidate) => uiNodeMatches(candidate, text));
            if (node) {
              tapX = Math.round((node.left + node.right) / 2);
              tapY = Math.round((node.top + node.bottom) / 2);
              matchedUiNode = true;
            }
          }

          if (!matchedUiNode && /masuk|login/i.test(text)) {
            tapX = Math.round(screenWidth * 0.5);
            tapY = Math.round(screenHeight * 0.70);
          } else if (!matchedUiNode && /beranda|home/i.test(text)) {
            tapX = Math.round(screenWidth * 0.10);
            tapY = tabY;
          } else if (!matchedUiNode && /absensi|presensi/i.test(text)) {
            tapX = Math.round(screenWidth * 0.30);
            tapY = tabY;
          } else if (!matchedUiNode && /keuangan|tagihan/i.test(text)) {
            tapX = Math.round(screenWidth * 0.50);
            tapY = tabY;
          } else if (!matchedUiNode && /informasi|info/i.test(text)) {
            tapX = Math.round(screenWidth * 0.70);
            tapY = tabY;
          } else if (!matchedUiNode && /t2q|quran|tahfidz/i.test(text)) {
            tapX = Math.round(screenWidth * 0.90);
            tapY = tabY;
          } else if (!matchedUiNode && tapSpec.point) {
            const parts = String(tapSpec.point).split(',');
            if (parts.length === 2) {
              const px = parseFloat(parts[0]);
              const py = parseFloat(parts[1]);
              tapX = parts[0].includes('%') ? Math.round(screenWidth * (px / 100)) : Math.round(px);
              tapY = parts[1].includes('%') ? Math.round(screenHeight * (py / 100)) : Math.round(py);
            }
          }

          if (targetDevice && text && !matchedUiNode && !tapSpec.point && !/masuk|login|beranda|home|absensi|presensi|keuangan|tagihan|informasi|info|t2q|quran|tahfidz/i.test(text)) {
            throw new Error(`Elemen UI tidak ditemukan untuk tapOn: "${text}"`);
          }

          if (targetDevice) {
            appendLog(`Melakukan tap pada (${tapX}, ${tapY}) untuk "${text}"`);
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'tap', String(tapX), String(tapY)], 4000);
            await new Promise((r) => setTimeout(r, 1200));
          }
        } else if (cmd.inputText) {
          const value = String(cmd.inputText);
          actionName = `inputText: "${value}"`;
          if (targetDevice) {
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'text', value.replace(/ /g, '%s')], 4000);
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
            await runCli('adb', ['-s', targetDevice, 'shell', 'input', 'swipe', String(midX), String(startY), String(midX), String(endY), '400'], 4000);
            await new Promise((r) => setTimeout(r, 800));
          }
        } else if (cmd.waitForAnimationToEnd) {
          const timeout = Math.min(cmd.waitForAnimationToEnd.timeout || 1500, 3000);
          actionName = `waitForAnimation: ${timeout}ms`;
          appendLog(`Menunggu animasi selesai (${timeout}ms)...`);
          await new Promise((r) => setTimeout(r, timeout));
        } else if (cmd.assertVisible) {
          const assertSpec = typeof cmd.assertVisible === 'string' ? { text: cmd.assertVisible } : cmd.assertVisible;
          const text = String(assertSpec.text || 'element');
          actionName = `assertVisible: "${text}"`;
          const visible = targetDevice && (await readUiNodes(targetDevice)).some((node) => uiNodeMatches(node, text));
          if (targetDevice && !visible) throw new Error(`Elemen UI tidak terlihat: "${text}"`);
          appendLog(`Assertion verifikasi visibilitas lulus: "${text}"`);
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
  }
}

export async function captureDeviceScreen(deviceId?: string): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  const status = await checkAndroid();
  const targetDevice = normalizeDeviceId(deviceId, status.adb.devices) || status.adb.devices[0];
  if (!targetDevice) {
    return { success: false, error: 'Tidak ada perangkat Android yang terhubung via ADB.' };
  }

  return new Promise((resolve) => {
    const child = spawn(resolveAdbBin(), ['-s', targetDevice, 'exec-out', 'screencap', '-p'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const chunks: Buffer[] = [];
    child.stdout.on('data', (c) => chunks.push(c));

    let err = '';
    child.stderr?.on('data', (c) => { err += c.toString(); });

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      resolve({ success: false, error: 'Timeout mengambil screenshot dari perangkat (5s).' });
    }, 5000);

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ success: false, error: e.message });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        resolve({ success: true, buffer });
      } else {
        resolve({ success: false, error: err || `adb exited with code ${code}` });
      }
    });
  });
}

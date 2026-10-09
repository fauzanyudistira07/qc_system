import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { AndroidDevice, InstallApkResult } from './types.ts';

export function resolveAdbBin(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';

  const candidates = [
    process.platform === 'win32' ? 'C:\\ProgramData\\chocolatey\\bin\\adb.exe' : '',
    androidHome ? path.join(androidHome, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : '',
    localAppData ? path.join(localAppData, 'Android', 'Sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : '',
    path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
  ].filter(Boolean);

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'adb';
}

function getExtendedEnv(): NodeJS.ProcessEnv {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(localAppData, 'Android', 'Sdk');
  const platformTools = path.join(androidHome, 'platform-tools');
  const chocoBin = 'C:\\ProgramData\\chocolatey\\bin';
  const currentPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';

  return {
    ...process.env,
    PATH: `${platformTools}${sep}${chocoBin}${sep}${currentPath}`
  };
}

export function runAdb(args: string[], timeoutMs = 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;

    const actualCmd = resolveAdbBin();
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
        resolve({ stdout, stderr: `${stderr}\nTimeout ADB after ${timeoutMs}ms`, exitCode: -1 });
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

export async function listAdbDevices(): Promise<AndroidDevice[]> {
  const result = await runAdb(['devices', '-l'], 5000);
  if (result.exitCode !== 0) return [];

  const devices: AndroidDevice[] = [];
  const lines = result.stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('List of devices')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const serial = parts[0];
      const statusRaw = parts[1];
      const isEmulator = serial.startsWith('emulator-');
      const modelMatch = trimmed.match(/model:([^\s]+)/);

      devices.push({
        serial,
        type: isEmulator ? 'emulator' : 'physical',
        status: statusRaw === 'device' ? 'device' : statusRaw === 'unauthorized' ? 'unauthorized' : 'offline',
        model: modelMatch ? modelMatch[1] : undefined
      });
    }
  }

  return devices;
}

export async function isBootCompleted(serial: string): Promise<boolean> {
  const res = await runAdb(['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], 4000);
  return res.exitCode === 0 && res.stdout.trim() === '1';
}

export async function isPackageManagerReady(serial: string): Promise<boolean> {
  const res = await runAdb(['-s', serial, 'shell', 'pm', 'path', 'android'], 4000);
  return res.exitCode === 0 && res.stdout.includes('package:');
}

export async function killEmulator(serial: string): Promise<boolean> {
  const res = await runAdb(['-s', serial, 'emu', 'kill'], 10000);
  return res.exitCode === 0;
}

export async function captureScreenBuffer(serial: string): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(resolveAdbBin(), ['-s', serial, 'exec-out', 'screencap', '-p'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const chunks: Buffer[] = [];
    child.stdout.on('data', (c) => chunks.push(c));

    let err = '';
    child.stderr?.on('data', (c) => { err += c.toString(); });

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      resolve({ success: false, error: 'Timeout mengambil screenshot dari perangkat (15s).' });
    }, 15000);

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ success: false, error: e.message });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve({ success: true, buffer: Buffer.concat(chunks) });
      } else {
        resolve({ success: false, error: err || `adb exited with code ${code}` });
      }
    });
  });
}

export async function uninstallPackage(serial: string, packageId: string): Promise<boolean> {
  const res = await runAdb(['-s', serial, 'uninstall', packageId], 20000);
  return res.exitCode === 0;
}

export async function installApk(
  serial: string,
  apkPath: string,
  packageId?: string,
  forceClean = false
): Promise<InstallApkResult> {
  if (forceClean && packageId) {
    await uninstallPackage(serial, packageId);
  }

  const args = ['-s', serial, 'install', '--user', '0', '-r', '-g', apkPath];
  const result = await runAdb(args, 120000);
  const combined = (result.stdout + '\n' + result.stderr).trim();
  const success = result.exitCode === 0 && combined.toLowerCase().includes('success');

  if (success) {
    return { success: true, output: combined || 'Success', device: serial };
  }

  // Handle signature conflict:
  if (combined.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE') && packageId) {
    await uninstallPackage(serial, packageId);
    const retryResult = await runAdb(args, 120000);
    const retryCombined = (retryResult.stdout + '\n' + retryResult.stderr).trim();
    if (retryResult.exitCode === 0 && retryCombined.toLowerCase().includes('success')) {
      return {
        success: true,
        output: `Versi lama (${packageId}) berhasil di-uninstall dan versi baru berhasil dipasang.`,
        device: serial
      };
    }
    return {
      success: false,
      output: `Gagal install ulang setelah uninstall: ${retryCombined}`,
      device: serial
    };
  }

  return {
    success: false,
    output: combined || 'Install failed',
    device: serial
  };
}

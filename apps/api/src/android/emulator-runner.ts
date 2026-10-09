import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { isBootCompleted, isPackageManagerReady, killEmulator, listAdbDevices } from './adb.ts';
import type { EmulatorOptions } from './types.ts';

const activeEmulators = new Map<string, ChildProcess>();

export function resolveEmulatorBin(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';

  const candidates = [
    androidHome ? path.join(androidHome, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator') : '',
    localAppData ? path.join(localAppData, 'Android', 'Sdk', 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator') : '',
    path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator')
  ].filter(Boolean);

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'emulator';
}

function getExtendedEnv(): NodeJS.ProcessEnv {
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(localAppData, 'Android', 'Sdk');
  const emulatorDir = path.join(androidHome, 'emulator');
  const currentPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';

  return {
    ...process.env,
    PATH: `${emulatorDir}${sep}${currentPath}`
  };
}

export async function listAvds(): Promise<string[]> {
  const emulatorBin = resolveEmulatorBin();
  return new Promise((resolve) => {
    const child = spawn(emulatorBin, ['-list-avds'], {
      windowsHide: true,
      env: getExtendedEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', () => {});

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      resolve(fallbackReadAvdDir());
    }, 6000);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && output.trim()) {
        const avds = output.split('\n').map((s) => s.trim()).filter(Boolean);
        resolve(avds.length > 0 ? avds : fallbackReadAvdDir());
      } else {
        resolve(fallbackReadAvdDir());
      }
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve(fallbackReadAvdDir());
    });
  });
}

function fallbackReadAvdDir(): string[] {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const avdHome = process.env.ANDROID_AVD_HOME || path.join(home, '.android', 'avd');
  if (existsSync(avdHome)) {
    try {
      const files = readdirSync(avdHome);
      return files
        .filter((f) => f.endsWith('.ini'))
        .map((f) => f.replace(/\.ini$/, ''));
    } catch {
      return [];
    }
  }
  return [];
}

export async function waitForBoot(serial: string, timeoutMs = 120000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const booted = await isBootCompleted(serial);
      if (booted) {
        const pmReady = await isPackageManagerReady(serial);
        if (pmReady) {
          // Beri jeda 3 detik ekstra agar OS surface rendering benar-benar stabil
          await new Promise((r) => setTimeout(r, 3000));
          return true;
        }
      }
    } catch {
      // Tunggu hingga daemon ADB mengenali port emulator
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

export async function startHeadlessAvd(
  avdName?: string,
  options: EmulatorOptions = {}
): Promise<{ success: boolean; serial?: string; error?: string }> {
  const avds = await listAvds();
  if (avds.length === 0) {
    return {
      success: false,
      error: 'Tidak ada AVD (Android Virtual Device) yang ditemukan di sistem. Buat AVD terlebih dahulu via avdmanager atau Android Studio.'
    };
  }

  const targetAvd = avdName && avds.includes(avdName) ? avdName : avds[0];
  const emulatorBin = resolveEmulatorBin();

  const args: string[] = ['-avd', targetAvd];

  if (options.noWindow !== false) args.push('-no-window');
  if (options.noAudio !== false) args.push('-no-audio');
  if (options.noBootAnim !== false) args.push('-no-boot-anim');
  args.push('-gpu', options.gpu || 'auto');
  args.push('-memory', String(options.memoryMb || 3072));
  args.push('-cores', String(options.cores || 4));

  const beforeDevices = await listAdbDevices();
  const beforeSerials = new Set(beforeDevices.map((d) => d.serial));

  const child = spawn(emulatorBin, args, {
    detached: true,
    windowsHide: true,
    env: getExtendedEnv(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.unref();

  // Tunggu serial baru muncul di adb devices
  const timeoutMs = options.timeoutMs || 120000;
  const startWait = Date.now();
  let foundSerial: string | undefined;

  while (Date.now() - startWait < 30000) {
    const current = await listAdbDevices();
    const newDevice = current.find((d) => !beforeSerials.has(d.serial) && d.type === 'emulator');
    if (newDevice) {
      foundSerial = newDevice.serial;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!foundSerial) {
    // Coba ambil emulator serial pertama jika sudah ada yang terdaftar
    const current = await listAdbDevices();
    const emu = current.find((d) => d.type === 'emulator');
    if (emu) {
      foundSerial = emu.serial;
    } else {
      try { child.kill(); } catch { /* ignore */ }
      return { success: false, error: `Emulator AVD "${targetAvd}" gagal terdaftar di ADB dalam 30 detik.` };
    }
  }

  activeEmulators.set(foundSerial, child);

  // Tunggu hingga proses booting OS tuntas
  const bootSuccess = await waitForBoot(foundSerial, timeoutMs);
  if (!bootSuccess) {
    await stopEmulator(foundSerial);
    return { success: false, error: `Timeout menunggu booting Android Emulator ${foundSerial} (${timeoutMs}ms).` };
  }

  return { success: true, serial: foundSerial };
}

export async function stopEmulator(serial: string): Promise<boolean> {
  const child = activeEmulators.get(serial);
  activeEmulators.delete(serial);

  let killed = await killEmulator(serial);

  if (child) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }

  // Verifikasi device sudah hilang dari adb devices
  const startWait = Date.now();
  while (Date.now() - startWait < 15000) {
    const devices = await listAdbDevices();
    if (!devices.some((d) => d.serial === serial)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  return killed;
}

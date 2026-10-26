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
    path.join(home, 'Android', 'Sdk', 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator'),
    localAppData ? path.join(localAppData, 'Android', 'Sdk', 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator') : '',
    path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator')
  ].filter(Boolean);

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'emulator';
}

function getExtendedEnv(): NodeJS.ProcessEnv {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (existsSync(path.join(home, 'Android', 'Sdk')) ? path.join(home, 'Android', 'Sdk') : path.join(localAppData, 'Android', 'Sdk'));
  const emulatorDir = path.join(androidHome, 'emulator');
  const platformTools = path.join(androidHome, 'platform-tools');
  const currentPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';

  return {
    ...process.env,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    PATH: `${emulatorDir}${sep}${platformTools}${sep}${currentPath}`
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
  args.push('-gpu', options.gpu || 'swiftshader_indirect');
  args.push('-memory', String(options.memoryMb || 2048));
  args.push('-cores', String(options.cores || 2));

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
  managedEmulators.add(foundSerial);

  // Tunggu hingga proses booting OS tuntas
  const bootSuccess = await waitForBoot(foundSerial, timeoutMs);
  if (!bootSuccess) {
    await stopEmulator(foundSerial);
    return { success: false, error: `Timeout menunggu booting Android Emulator ${foundSerial} (${timeoutMs}ms).` };
  }

  return { success: true, serial: foundSerial };
}

const managedEmulators = new Set<string>();
let idleWatchdogTimer: NodeJS.Timeout | null = null;
let activeJobCount = 0;

export function isManagedEmulator(serial: string): boolean {
  return managedEmulators.has(serial);
}

export function getManagedEmulators(): string[] {
  return Array.from(managedEmulators);
}

export function markManagedEmulator(serial: string): void {
  managedEmulators.add(serial);
}

export function notifyAndroidJobStarted(): void {
  activeJobCount++;
  if (idleWatchdogTimer) {
    clearTimeout(idleWatchdogTimer);
    idleWatchdogTimer = null;
  }
}

export function notifyAndroidJobFinished(): void {
  activeJobCount = Math.max(0, activeJobCount - 1);
  if (activeJobCount === 0 && managedEmulators.size > 0) {
    scheduleIdleShutdown(30000);
  }
}

export function scheduleIdleShutdown(delayMs = 30000): void {
  if (idleWatchdogTimer) {
    clearTimeout(idleWatchdogTimer);
  }
  idleWatchdogTimer = setTimeout(async () => {
    if (activeJobCount === 0 && managedEmulators.size > 0) {
      console.log(`[EMULATOR-LIFECYCLE] ⏱️ Tidak ada job aktif dalam ${Math.round(delayMs / 1000)}s. Mematikan Headless Emulator otomatis...`);
      await stopAllManagedEmulators();
    }
    idleWatchdogTimer = null;
  }, delayMs);
}

export async function stopAllManagedEmulators(): Promise<void> {
  if (idleWatchdogTimer) {
    clearTimeout(idleWatchdogTimer);
    idleWatchdogTimer = null;
  }
  const serials = Array.from(managedEmulators);
  for (const serial of serials) {
    try {
      console.log(`[EMULATOR-LIFECYCLE] 🛑 Mematikan managed emulator ${serial}...`);
      await stopEmulator(serial);
      managedEmulators.delete(serial);
    } catch (err) {
      console.error(`[EMULATOR-LIFECYCLE] Gagal mematikan emulator ${serial}:`, err);
    }
  }
}

/**
 * Memastikan ada perangkat Android siap pakai:
 * 1. Jika ada physical phone (misal 192.168.10.37:5555) -> Pakai langsung tanpa menyalakan emulator.
 * 2. Jika ada emulator yang sedang aktif -> Pakai langsung.
 * 3. Jika TIDAK ada sama sekali -> Nyalakan headless emulator (qc_worker_headless) on-demand,
 *    dan tandai sebagai managed (akan dimatikan otomatis saat job selesai/idle).
 */
export async function ensureDeviceReady(requestedDeviceId?: string): Promise<{
  serial: string;
  managed: boolean;
  model?: string;
  error?: string;
}> {
  const currentDevices = await listAdbDevices();

  // 1. Cek spesifik device jika diminta dan valid
  if (requestedDeviceId) {
    const matched = currentDevices.find(
      (d) => d.serial === requestedDeviceId || d.serial.includes(requestedDeviceId)
    );
    if (matched && matched.status === 'device') {
      const ready = await isPackageManagerReady(matched.serial);
      if (ready) {
        return {
          serial: matched.serial,
          managed: managedEmulators.has(matched.serial),
          model: matched.model
        };
      }
    }
  }

  // 2. Prioritaskan physical phone yang sedang terhubung
  const physical = currentDevices.find((d) => d.type === 'physical' && d.status === 'device');
  if (physical) {
    const ready = await isPackageManagerReady(physical.serial);
    if (ready) {
      return {
        serial: physical.serial,
        managed: false,
        model: physical.model
      };
    }
  }

  // 3. Gunakan emulator yang sudah aktif jika ada
  const runningEmulator = currentDevices.find((d) => d.type === 'emulator' && d.status === 'device');
  if (runningEmulator) {
    const ready = await isPackageManagerReady(runningEmulator.serial);
    if (ready) {
      return {
        serial: runningEmulator.serial,
        managed: managedEmulators.has(runningEmulator.serial),
        model: runningEmulator.model
      };
    }
  }

  // 4. On-Demand: Tidak ada perangkat aktif -> nyalakan headless emulator
  console.log('[EMULATOR-LIFECYCLE] 🚀 Tidak ada perangkat Android terhubung. Menyalakan Headless Android Emulator (qc_worker_headless)...');
  const avds = await listAvds();
  const targetAvd = avds.includes('qc_worker_headless') ? 'qc_worker_headless' : avds[0];
  if (!targetAvd) {
    return {
      serial: '',
      managed: false,
      error: 'Tidak ada AVD yang terpasang di sistem. Pasang AVD qc_worker_headless terlebih dahulu.'
    };
  }

  const emuResult = await startHeadlessAvd(targetAvd, {
    noWindow: true,
    noAudio: true,
    noBootAnim: true,
    gpu: 'swiftshader_indirect',
    memoryMb: 2048,
    cores: 2,
    timeoutMs: 120000
  });

  if (!emuResult.success || !emuResult.serial) {
    return {
      serial: '',
      managed: false,
      error: emuResult.error || 'Gagal menyalakan headless emulator on-demand.'
    };
  }

  return {
    serial: emuResult.serial,
    managed: true,
    model: targetAvd
  };
}

export async function stopEmulator(serial: string): Promise<boolean> {
  const child = activeEmulators.get(serial);
  activeEmulators.delete(serial);
  managedEmulators.delete(serial);

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

#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const ANDROID_HOME = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(HOME, 'Android', 'Sdk');
const EMULATOR_BIN = existsSync(path.join(ANDROID_HOME, 'emulator', 'emulator'))
  ? path.join(ANDROID_HOME, 'emulator', 'emulator')
  : 'emulator';
const ADB_BIN = existsSync(path.join(ANDROID_HOME, 'platform-tools', 'adb'))
  ? path.join(ANDROID_HOME, 'platform-tools', 'adb')
  : 'adb';

const EXTENDED_ENV = {
  ...process.env,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  PATH: `${path.join(ANDROID_HOME, 'platform-tools')}:${path.join(ANDROID_HOME, 'emulator')}:${process.env.PATH || ''}`
};

function runCmd(bin, args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;

    const child = spawn(bin, args, {
      env: EXTENDED_ENV,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { child.kill('SIGKILL'); } catch {}
        resolve({ stdout, stderr: `${stderr}\nTimeout after ${timeoutMs}ms`, exitCode: -1 });
      }
    }, timeoutMs);

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

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

export async function listAdbDevices() {
  const res = await runCmd(ADB_BIN, ['devices', '-l'], 5000);
  if (res.exitCode !== 0) return [];
  const lines = res.stdout.split('\n');
  const devices = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('List of devices')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const serial = parts[0];
      const status = parts[1];
      const isEmulator = serial.startsWith('emulator-');
      const modelMatch = trimmed.match(/model:(\S+)/);
      devices.push({
        serial,
        status,
        type: isEmulator ? 'emulator' : 'physical',
        model: modelMatch ? modelMatch[1] : undefined
      });
    }
  }
  return devices;
}

export async function isDeviceReady(serial) {
  try {
    const bootRes = await runCmd(ADB_BIN, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], 4000);
    if (bootRes.exitCode !== 0 || bootRes.stdout.trim() !== '1') return false;
    const pmRes = await runCmd(ADB_BIN, ['-s', serial, 'shell', 'pm', 'path', 'android'], 4000);
    return pmRes.exitCode === 0 && pmRes.stdout.includes('package:');
  } catch {
    return false;
  }
}

export async function ensureAndroidDevice(requestedSerial, options = {}) {
  const current = await listAdbDevices();
  const forceEmulator = options.forceEmulator || requestedSerial === 'emulator' || requestedSerial === 'qc_worker_headless';

  // 1. Jika requestedSerial diberikan dan aktif
  if (requestedSerial && !forceEmulator) {
    const match = current.find(d => (d.serial === requestedSerial || d.serial.includes(requestedSerial)) && d.status === 'device');
    if (match && await isDeviceReady(match.serial)) {
      console.log(`[ON-DEMAND] 📱 Menggunakan perangkat yang diminta: ${match.serial} (${match.model || match.type})`);
      return { serial: match.serial, managed: false, model: match.model };
    }
  }

  // 2. Jika tidak dipaksa emulator, cek physical phone yang terhubung (USB / WiFi ADB)
  if (!forceEmulator) {
    const physical = current.find(d => d.type === 'physical' && d.status === 'device');
    if (physical && await isDeviceReady(physical.serial)) {
      console.log(`[ON-DEMAND] 📱 Perangkat fisik terdeteksi aktif: ${physical.serial} (${physical.model || 'Physical Phone'}). Emulator tidak perlu dinyalakan.`);
      return { serial: physical.serial, managed: false, model: physical.model };
    }
  }

  // 3. Jika ada emulator yang SUDAH berjalan dan siap
  const runningEmulator = current.find(d => d.type === 'emulator' && d.status === 'device');
  if (runningEmulator && await isDeviceReady(runningEmulator.serial)) {
    console.log(`[ON-DEMAND] ⚡ Emulator Android sudah aktif: ${runningEmulator.serial}. Menggunakan instance yang ada.`);
    return { serial: runningEmulator.serial, managed: false, model: runningEmulator.model };
  }

  // 4. TIDAK ADA perangkat yang aktif -> Nyalakan Headless Emulator on-demand!
  console.log('[ON-DEMAND] 🚀 Membutuhkan emulator Android. Menyalakan Headless Emulator (qc_worker_headless) di background...');
  const beforeSerials = new Set(current.map(d => d.serial));

  const emuArgs = [
    '-avd', 'qc_worker_headless',
    '-no-window',
    '-no-audio',
    '-no-boot-anim',
    '-gpu', 'swiftshader_indirect',
    '-memory', '2048',
    '-cores', '2'
  ];

  const child = spawn(EMULATOR_BIN, emuArgs, {
    detached: true,
    windowsHide: true,
    env: EXTENDED_ENV,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.unref();

  // Tunggu serial baru muncul di adb
  let newSerial;
  const startWait = Date.now();
  while (Date.now() - startWait < 35000) {
    const pollDevices = await listAdbDevices();
    const found = pollDevices.find(d => !beforeSerials.has(d.serial) && d.type === 'emulator');
    if (found) {
      newSerial = found.serial;
      break;
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  if (!newSerial) {
    const pollDevices = await listAdbDevices();
    const emu = pollDevices.find(d => d.type === 'emulator');
    if (emu) newSerial = emu.serial;
    else {
      try { child.kill(); } catch {}
      throw new Error('Headless emulator gagal terdaftar di ADB dalam 35 detik.');
    }
  }

  console.log(`[ON-DEMAND] ⏳ Menunggu sistem Android (${newSerial}) selesai booting...`);
  const bootTimeout = 120000;
  const startBoot = Date.now();
  let booted = false;

  while (Date.now() - startBoot < bootTimeout) {
    if (await isDeviceReady(newSerial)) {
      booted = true;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!booted) {
    await releaseAndroidDevice({ serial: newSerial, managed: true });
    throw new Error(`Timeout menunggu booting Android (${bootTimeout}ms).`);
  }

  console.log(`[ON-DEMAND] ✅ Headless Emulator ${newSerial} siap digunakan untuk pengujian.`);
  return { serial: newSerial, managed: true, model: 'qc_worker_headless' };
}

export async function releaseAndroidDevice(deviceInfo) {
  if (!deviceInfo || !deviceInfo.serial) return;
  if (!deviceInfo.managed) {
    console.log(`[ON-DEMAND] ℹ️ Perangkat ${deviceInfo.serial} bukan emulator yang di-manage QC. Tetap dibiarkan aktif.`);
    return;
  }

  console.log(`[ON-DEMAND] 🛑 Mematikan Headless Emulator ${deviceInfo.serial} untuk menghemat RAM dan CPU...`);
  await runCmd(ADB_BIN, ['-s', deviceInfo.serial, 'emu', 'kill'], 10000);

  const startWait = Date.now();
  while (Date.now() - startWait < 15000) {
    const list = await listAdbDevices();
    if (!list.some(d => d.serial === deviceInfo.serial)) {
      console.log(`[ON-DEMAND] ✨ Headless Emulator ${deviceInfo.serial} berhasil dimatikan. Sumber daya bebas.`);
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

/**
 * Higher-order function untuk eksekusi tugas dengan jaminan lifecycle:
 * Nyala saat ada tugas, dan langsung MATI saat tugas selesai!
 */
export async function withAndroidDevice(fn, requestedSerial, options = {}) {
  let device;
  try {
    device = await ensureAndroidDevice(requestedSerial, options);
    return await fn(device);
  } finally {
    if (device && device.managed) {
      await releaseAndroidDevice(device);
    }
  }
}

// CLI handler
async function main() {
  const cmd = process.argv[2] || 'status';

  if (cmd === 'status') {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 QC MAESTRO: ANDROID ON-DEMAND STATUS');
    console.log('═══════════════════════════════════════════════════════════════════');
    const devices = await listAdbDevices();
    console.log(`Perangkat terdeteksi di ADB: ${devices.length}`);
    for (const d of devices) {
      const ready = await isDeviceReady(d.serial);
      console.log(` - ${d.serial} [${d.type.toUpperCase()}] status=${d.status} model=${d.model || '-'} ready=${ready ? 'YES' : 'NO'}`);
    }
    const avdRes = await runCmd(EMULATOR_BIN, ['-list-avds'], 5000);
    const avds = avdRes.stdout.split('\n').map(s => s.trim()).filter(Boolean);
    console.log(`Headless AVD terpasang: ${avds.join(', ') || 'NONE'}`);
    console.log('═══════════════════════════════════════════════════════════════════');
  } else if (cmd === 'start') {
    const device = await ensureAndroidDevice();
    console.log(`Serial aktif: ${device.serial} (managed: ${device.managed})`);
  } else if (cmd === 'stop') {
    const devices = await listAdbDevices();
    const emu = devices.find(d => d.type === 'emulator');
    if (emu) {
      await releaseAndroidDevice({ serial: emu.serial, managed: true });
    } else {
      console.log('Tidak ada emulator aktif untuk dimatikan.');
    }
  } else if (cmd === 'run') {
    const runArgs = process.argv.slice(3);
    if (runArgs.length === 0) {
      console.error('Penggunaan: node scripts/android-on-demand.mjs run -- <perintah>');
      process.exit(1);
    }
    const scriptCmd = runArgs[0] === '--' ? runArgs.slice(1).join(' ') : runArgs.join(' ');
    console.log(`[ON-DEMAND RUN] Menjalankan: "${scriptCmd}" dengan Just-In-Time Android Device...`);
    await withAndroidDevice(async (device) => {
      console.log(`[ON-DEMAND RUN] Device aktif: ${device.serial}`);
      const proc = spawn(scriptCmd, {
        shell: true,
        stdio: 'inherit',
        env: {
          ...process.env,
          QC_DEVICE_SERIAL: device.serial,
          DEVICE_ID: device.serial
        }
      });
      await new Promise((resolve, reject) => {
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)));
        proc.on('error', reject);
      });
    });
    console.log('[ON-DEMAND RUN] Selesai.');
  } else {
    console.log(`Perintah tidak dikenal: ${cmd}`);
    console.log('Perintah tersedia: status | start | stop | run -- <command>');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((err) => {
    console.error('[ON-DEMAND FATAL ERROR]', err.message || err);
    process.exit(1);
  });
}

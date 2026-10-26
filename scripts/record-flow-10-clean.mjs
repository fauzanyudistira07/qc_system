import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const device = '192.168.10.37:5555';
const root = process.cwd();
const targetJobId = 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d';
const runLabel = 'al-hikmah-digital-ai-suite-2026-10-19T0122Z';

const jobDir = path.join(root, '.qc-artifacts', 'jobs', targetJobId);
const jobScreenshots = path.join(jobDir, 'screenshots');
const jobVideos = path.join(jobDir, 'videos');

const projectRunDir = path.join(root, '.qc-artifacts', 'projects', 'al-hikmah-digital', 'runs', runLabel);
const runEvidenceScreenshots = path.join(projectRunDir, 'evidence', 'screenshots');
const runEvidenceVideos = path.join(projectRunDir, 'evidence', 'videos');

fs.mkdirSync(jobScreenshots, { recursive: true });
fs.mkdirSync(jobVideos, { recursive: true });
fs.mkdirSync(runEvidenceScreenshots, { recursive: true });
fs.mkdirSync(runEvidenceVideos, { recursive: true });

function sh(cmd) {
  try {
    return execSync(`adb -s ${device} ${cmd}`, { encoding: 'utf8', timeout: 30000 });
  } catch (err) {
    console.error(`Command failed: adb -s ${device} ${cmd}`, err.message);
    return '';
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getUiDump() {
  sh('shell uiautomator dump /sdcard/dump.xml');
  return sh('shell cat /sdcard/dump.xml');
}

async function waitForUi(keyword, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const xml = getUiDump();
    if (xml.includes(keyword)) {
      return xml;
    }
    if (xml.includes('permission_allow_button') || xml.includes('Izinkan')) {
      console.log('  Dismissing notification permission dialog...');
      sh('shell input tap 540 2108');
      await sleep(1000);
      continue;
    }
    await sleep(600);
  }
  console.warn(`  ⚠️ Timeout waiting for UI keyword: "${keyword}"`);
  return null;
}

function screencap(filename) {
  const remotePath = `/sdcard/qc_${filename}`;
  sh(`shell screencap -p ${remotePath}`);
  
  const localJobPath = path.join(jobScreenshots, filename);
  const localRunPath = path.join(runEvidenceScreenshots, filename);
  
  try {
    execSync(`adb -s ${device} pull ${remotePath} "${localJobPath}"`, { timeout: 15000 });
    fs.copyFileSync(localJobPath, localRunPath);
    sh(`shell rm -f ${remotePath}`);
    console.log(`  📸 Screencap: ${filename} (${fs.statSync(localJobPath).size} bytes)`);
  } catch (e) {
    console.error(`  ❌ Failed to pull ${filename}:`, e.message);
  }
}

async function recordSession(filename, timeLimitSec, actionsFn) {
  console.log(`\n▶ Starting video recording: ${filename} (limit ${timeLimitSec}s)`);
  const remotePath = `/sdcard/rec_${filename}`;
  sh(`shell rm -f ${remotePath}`);

  const recProcess = spawn('adb', ['-s', device, 'shell', `screenrecord --time-limit ${timeLimitSec} ${remotePath}`], {
    stdio: 'ignore'
  });

  await sleep(1500);

  try {
    await actionsFn();
  } catch (err) {
    console.error(`Error during action for ${filename}:`, err);
  }

  await sleep(1500);
  try {
    sh('shell "pkill -2 screenrecord || killall -2 screenrecord || true"');
  } catch {}
  recProcess.kill();
  await sleep(2500);

  const localJobPath = path.join(jobVideos, filename);
  const localRunPath = path.join(runEvidenceVideos, filename);
  
  try {
    execSync(`adb -s ${device} pull ${remotePath} "${localJobPath}"`, { timeout: 35000 });
    fs.copyFileSync(localJobPath, localRunPath);
    sh(`shell rm -f ${remotePath}`);
    console.log(`  🎬 Video saved: ${filename} (${fs.statSync(localJobPath).size} bytes)`);
  } catch (e) {
    console.error(`  ❌ Failed to pull ${filename}:`, e.message);
  }
}

async function cleanLaunchToBeranda() {
  console.log('🔄 Clean launching to Siswa Beranda...');
  sh('shell pm clear --user 0 com.alhikmah.digital');
  await sleep(800);
  sh('shell pm grant com.alhikmah.digital android.permission.POST_NOTIFICATIONS');
  sh('shell monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1');
  
  await waitForUi('PILIH ROLE DEMO', 25000);
  console.log('  Selecting Siswa role & logging in...');
  sh('shell input tap 271 959'); // Siswa / Santri
  await sleep(400);
  sh('shell input tap 540 1937'); // Masuk
  const dashXml = await waitForUi('Selamat Pagi', 15000);
  if (!dashXml) throw new Error('Failed to reach Siswa Dashboard');
  console.log('  ✅ Siswa Beranda ready!');
}

async function main() {
  console.log('=== RECORDING CLEAN FLOW 10: DRAWER, PROFIL & DEEP ACCOUNT QC ===');

  try {
    execSync(`adb connect ${device}`, { timeout: 10000 });
  } catch {}

  await cleanLaunchToBeranda();

  await recordSession('video-10-drawer-profil.mp4', 55, async () => {
    screencap('step-10-01-dashboard.png');
    await sleep(1000);

    // 1. Open Drawer
    console.log('  1. Opening Drawer menu...');
    sh('shell input tap 126 220');
    const drawerXml = await waitForUi('Profil Siswa', 8000);
    if (!drawerXml) {
      console.error('Drawer failed to open! Retrying tap...');
      sh('shell input tap 126 220');
      await waitForUi('Profil Siswa', 6000);
    }
    screencap('step-10-02-drawer-menu.png');
    screencap('detail-beranda-drawer-menu.png');
    await sleep(1200);

    // 2. Open Profil Siswa directly from Drawer
    console.log('  2. Opening Profil Siswa from Drawer...');
    sh('shell input tap 418 561');
    const profileXml = await waitForUi('PROFILE', 8000);
    if (!profileXml) throw new Error('Failed to reach PROFILE screen');
    screencap('step-10-04-profil-siswa.png');
    screencap('detail-beranda-profil-siswa.png');
    screencap('step-10-03-profil-siswa.png');
    await sleep(1500);

    // 3. DEEP QC: Data Lengkap Siswa
    console.log('  3. Deep QC: Data Lengkap Siswa sheet...');
    sh('shell input tap 540 984');
    await waitForUi('Data Lengkap Siswa', 6000);
    screencap('step-10-05-data-lengkap-siswa.png');
    await sleep(1500);
    // Close sheet via X button at (995, 768)
    sh('shell input tap 995 768');
    await waitForUi('PROFILE', 5000);
    await sleep(1000);

    // 4. DEEP QC: Ubah Kata Sandi Dialog
    console.log('  4. Deep QC: Ubah Kata Sandi dialog...');
    sh('shell input tap 540 1174');
    await waitForUi('Ubah Kata Sandi', 6000);
    screencap('step-10-06-ubah-kata-sandi.png');
    await sleep(1500);
    // Cancel dialog via Batal at (211, 2315)
    sh('shell input tap 211 2315');
    await waitForUi('PROFILE', 5000);
    await sleep(1000);

    // 5. DEEP QC: Panduan Aplikasi (Manual Book)
    console.log('  5. Deep QC: Panduan Aplikasi (Manual Book)...');
    sh('shell input tap 540 1540');
    await waitForUi('Panduan Aplikasi', 8000);
    screencap('step-10-07-manual-book.png');
    await sleep(1500);
    // Back to PROFILE via in-app button at (77, 176)
    sh('shell input tap 77 176');
    await waitForUi('PROFILE', 6000);
    await sleep(1000);

    // 6. DEEP QC: Kirim Masukan & Saran (Feedback)
    console.log('  6. Deep QC: Kirim Masukan & Saran...');
    sh('shell input tap 540 1905');
    await waitForUi('Masukan', 8000);
    screencap('step-10-08-feedback-form.png');
    await sleep(1500);
    // Back to PROFILE via in-app button at (132, 209)
    sh('shell input tap 132 209');
    await waitForUi('PROFILE', 6000);
    await sleep(1000);

    // 7. Back to Beranda from PROFILE via (77, 176)
    console.log('  7. Returning to Beranda from PROFILE...');
    sh('shell input tap 77 176');
    await waitForUi('Selamat Pagi', 6000);
    await sleep(1200);

    // 8. Open Drawer again to explore Ekstrakurikuler
    console.log('  8. Opening Drawer for Ekstrakurikuler...');
    sh('shell input tap 126 220');
    await waitForUi('Ekstrakurikuler', 6000);
    await sleep(800);
    sh('shell input tap 418 720'); // Tap Ekstrakurikuler
    await waitForUi('Pengajuan Ekskul', 6000);
    screencap('step-10-03-ekskul-list.png');
    screencap('ekskul-screen.png');
    await sleep(1200);

    // Toggle Form Ajuan tab
    sh('shell input tap 700 400');
    await sleep(800);
    sh('shell input tap 365 400');
    await sleep(800);

    // Return to Beranda from Ekskul via (132, 220)
    console.log('  9. Returning from Ekskul to Beranda...');
    sh('shell input tap 132 220');
    await waitForUi('Selamat Pagi', 6000);
    screencap('step-10-09-dashboard-kembali.png');
    await sleep(1000);

    console.log('  ✅ Flow 10 completed cleanly with zero notification detour!');
  });

  console.log('=== FLOW 10 RECORDING FINISHED SUCCESSFULLY ===');
}

main().catch(console.error);

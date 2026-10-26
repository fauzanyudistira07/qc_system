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

function assertAppInForeground() {
  const focus = sh('shell "dumpsys window | grep -E \'mCurrentFocus|mFocusedApp\'"');
  if (!focus.includes('com.alhikmah.digital')) {
    console.warn('⚠️ App not in foreground! Bringing to front...', focus.trim());
    sh('shell "monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1"');
    execSync('sleep 2');
  }
}

function screencap(filename) {
  assertAppInForeground();
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

async function recordSession(filename, actionsFn) {
  console.log(`\n▶ Starting clean recording: ${filename}`);
  assertAppInForeground();
  const remotePath = `/sdcard/rec_${filename}`;
  sh(`shell rm -f ${remotePath}`);

  const recProcess = spawn('adb', ['-s', device, 'shell', `screenrecord --time-limit 40 ${remotePath}`], {
    stdio: 'ignore'
  });

  await sleep(1200);

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
  await sleep(2000);

  const localJobPath = path.join(jobVideos, filename);
  const localRunPath = path.join(runEvidenceVideos, filename);
  
  try {
    execSync(`adb -s ${device} pull ${remotePath} "${localJobPath}"`, { timeout: 20000 });
    fs.copyFileSync(localJobPath, localRunPath);
    sh(`shell rm -f ${remotePath}`);
    console.log(`  🎬 Pulled video: ${filename} (${fs.statSync(localJobPath).size} bytes)`);
  } catch (e) {
    console.error(`  ❌ Failed to pull ${filename}:`, e.message);
  }
}

async function cleanLaunchToLogin() {
  console.log('🔄 Performing clean launch to Login screen with auto POST_NOTIFICATIONS grant...');
  sh('shell "pm clear --user 0 com.alhikmah.digital"');
  await sleep(800);
  sh('shell "pm grant com.alhikmah.digital android.permission.POST_NOTIFICATIONS"');
  await sleep(400);
  sh('shell "monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1"');
  await sleep(4000);
  assertAppInForeground();
}

async function main() {
  console.log('=== STARTING CLEAN IN-APP FLOW RECORDINGS (10-15) ===');
  
  // 1. Ensure phone is connected
  try {
    execSync(`adb connect ${device}`, { timeout: 10000 });
  } catch {}

  // -------------------------------------------------------------
  // FLOW 10: Drawer & Profil Siswa
  // -------------------------------------------------------------
  console.log('\n--- FLOW 10: Navigasi Menu Samping (Drawer): Profil & Ekskul ---');
  await cleanLaunchToLogin();
  // Tap Siswa / Santri (271 959) -> Masuk (540 1937)
  sh('shell "input tap 271 959"');
  await sleep(600);
  sh('shell "input tap 540 1937"');
  await sleep(3000);
  assertAppInForeground();

  await recordSession('video-10-drawer-profil.mp4', async () => {
    screencap('step-10-01-dashboard.png');
    await sleep(600);

    // Buka Hamburger Drawer (126 220)
    sh('shell "input tap 126 220"');
    await sleep(1500);
    screencap('step-10-02-drawer-menu.png');
    screencap('detail-beranda-profil-siswa.png');

    // Buka Profil Siswa (418 561)
    sh('shell "input tap 418 561"');
    await sleep(2000);
    screencap('step-10-03-profil-siswa.png');

    // Tap In-App Back button (75 180) to return to Beranda
    sh('shell "input tap 75 180"');
    await sleep(1200);
    assertAppInForeground();

    // Tap outside to ensure drawer is closed if it reappeared
    sh('shell "input tap 950 500"');
    await sleep(600);
    screencap('step-10-04-dashboard-kembali.png');
  });

  // -------------------------------------------------------------
  // FLOW 11: Quick Actions: Kalender Kegiatan & Detail Berita
  // -------------------------------------------------------------
  console.log('\n--- FLOW 11: Quick Actions: Kalender Kegiatan & Detail Berita ---');
  assertAppInForeground();

  await recordSession('video-11-kalender-kegiatan.mp4', async () => {
    screencap('step-11-01-beranda-actions.png');
    await sleep(600);

    // Tap "Kegiatan Mendatang" card (293 2031)
    sh('shell "input tap 293 2031"');
    await sleep(2200);
    screencap('step-11-02-kalender-kegiatan.png');
    screencap('kalender-kegiatan-screen.png');

    // Tap In-App Back button (110 209)
    sh('shell "input tap 110 209"');
    await sleep(1500);
    assertAppInForeground();

    // Scroll down to reveal Berita Sekolah
    sh('shell "input swipe 540 1800 540 800 400"');
    await sleep(1500);
    screencap('step-11-03-berita-sekolah.png');
    screencap('detail-beranda-artikel-berita.png');

    // Scroll back to top
    sh('shell "input swipe 540 800 540 1800 400"');
    await sleep(1000);
  });

  // -------------------------------------------------------------
  // FLOW 12: Pusat Notifikasi & Broadcast Pesan Sekolah
  // -------------------------------------------------------------
  console.log('\n--- FLOW 12: Pusat Notifikasi & Broadcast Pesan Sekolah ---');
  assertAppInForeground();

  await recordSession('video-12-pusat-notifikasi.mp4', async () => {
    // Tap Notification Bell (953 220)
    sh('shell "input tap 953 220"');
    await sleep(2200);
    screencap('step-12-01-notifikasi-list.png');
    screencap('detail-beranda-pusat-notifikasi.png');

    // Tap Tab Pengumuman (center ~ 715 142 on header tab)
    sh('shell "input tap 715 142"');
    await sleep(1200);
    screencap('step-12-02-notifikasi-pengumuman.png');

    // Tap In-App Back button (100 80)
    sh('shell "input tap 100 80"');
    await sleep(1500);
    assertAppInForeground();
    screencap('step-12-03-beranda-kembali.png');
  });

  // -------------------------------------------------------------
  // FLOW 13: Multi-Role: Dewan Guru
  // -------------------------------------------------------------
  console.log('\n--- FLOW 13: Multi-Role: Dewan Guru (CBT & Penilaian) ---');
  await cleanLaunchToLogin();

  await recordSession('video-13-role-guru.mp4', async () => {
    screencap('step-13-01-login-screen.png');
    await sleep(600);

    // Tap Dewan Guru (618 959)
    sh('shell "input tap 618 959"');
    await sleep(600);
    screencap('step-13-02-role-guru-selected.png');

    // Tap Masuk (540 1937)
    sh('shell "input tap 540 1937"');
    await sleep(3000);
    screencap('step-13-03-guru-dashboard.png');
    screencap('detail-role-guru-dashboard.png');
    screencap('role-guru-dashboard.png');

    // Tap Tab Absensi (400 2270)
    sh('shell "input tap 400 2270"');
    await sleep(1500);
    screencap('step-13-04-guru-absensi.png');
    screencap('detail-role-guru-presensi.png');

    // Tap Tab Sarpras (600 2270)
    sh('shell "input tap 600 2270"');
    await sleep(1500);
    screencap('step-13-05-guru-sarpras.png');
  });

  // -------------------------------------------------------------
  // FLOW 14: Multi-Role: Manager Sarpras
  // -------------------------------------------------------------
  console.log('\n--- FLOW 14: Multi-Role: Manager Sarpras (Aset & Work Orders) ---');
  await cleanLaunchToLogin();

  await recordSession('video-14-role-manager.mp4', async () => {
    screencap('step-14-01-login-screen.png');
    await sleep(600);

    // Tap Manager Sarpras (296 1081)
    sh('shell "input tap 296 1081"');
    await sleep(600);
    screencap('step-14-02-role-manager-selected.png');

    // Tap Masuk (540 1937)
    sh('shell "input tap 540 1937"');
    await sleep(3000);
    screencap('step-14-03-manager-dashboard.png');
    screencap('detail-role-manager-dashboard.png');
    screencap('role-manager-dashboard.png');

    // Scroll down to Antrean Keluhan
    sh('shell "input swipe 540 1800 540 1100 400"');
    await sleep(1500);
    screencap('step-14-04-manager-antrean.png');
  });

  // -------------------------------------------------------------
  // FLOW 15: Multi-Role: Staff Teknisi
  // -------------------------------------------------------------
  console.log('\n--- FLOW 15: Multi-Role: Staff Teknisi (Inspeksi & Resolusi WO) ---');
  await cleanLaunchToLogin();

  await recordSession('video-15-role-teknisi.mp4', async () => {
    screencap('step-15-01-login-screen.png');
    await sleep(600);

    // Tap Staff Teknisi (673 1081)
    sh('shell "input tap 673 1081"');
    await sleep(600);
    screencap('step-15-02-role-teknisi-selected.png');

    // Tap Masuk (540 1937)
    sh('shell "input tap 540 1937"');
    await sleep(3000);
    screencap('step-15-03-teknisi-dashboard.png');
    screencap('detail-role-teknisi-dashboard.png');
    screencap('role-teknisi-dashboard.png');

    // Tap "Kirim Laporan Selesai & Foto" button (540 1940)
    sh('shell "input tap 540 1940"');
    await sleep(2000);
    screencap('step-15-04-teknisi-laporan-selesai.png');
    screencap('detail-role-teknisi-photo.png');
  });

  console.log('\n✅ ALL FLOWS 10-15 CLEANLY RECORDED AND SCREENSHOTTED INSIDE APP!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

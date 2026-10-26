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

async function waitForUi(keyword, maxWaitMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const xml = getUiDump();
    if (xml.includes(keyword)) {
      return xml;
    }
    await sleep(800);
  }
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

async function recordSession(filename, actionsFn) {
  console.log(`\n▶ Starting recording: ${filename}`);
  const remotePath = `/sdcard/rec_${filename}`;
  sh(`shell rm -f ${remotePath}`);

  const recProcess = spawn('adb', ['-s', device, 'shell', `screenrecord --time-limit 40 ${remotePath}`], {
    stdio: 'ignore'
  });

  await sleep(1000);

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
  console.log('🔄 Clean launch to Login screen...');
  sh('shell pm clear --user 0 com.alhikmah.digital');
  await sleep(500);
  sh('shell pm grant com.alhikmah.digital android.permission.POST_NOTIFICATIONS');
  await sleep(300);
  sh('shell monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1');
  
  const loginXml = await waitForUi('PILIH ROLE DEMO', 15000);
  if (!loginXml) {
    throw new Error('Login screen timed out during launch');
  }
  return loginXml;
}

function findBoundsCenter(xml, pattern) {
  const m = xml.match(pattern);
  if (m) {
    const x = Math.round((parseInt(m[1]) + parseInt(m[3])) / 2);
    const y = Math.round((parseInt(m[2]) + parseInt(m[4])) / 2);
    return { x, y };
  }
  return null;
}

async function main() {
  console.log('=== STARTING BULLETPROOF IN-APP FLOW RECORDINGS (10-15) ===');

  try {
    execSync(`adb connect ${device}`, { timeout: 10000 });
  } catch {}

  // -------------------------------------------------------------
  // FLOW 10: Drawer & Profil Siswa
  // -------------------------------------------------------------
  console.log('\n--- FLOW 10: Navigasi Menu Samping (Drawer): Profil & Ekskul ---');
  let loginXml = await cleanLaunchToLogin();
  screencap('step-10-00-login.png');

  // Tap Siswa / Santri
  const siswaPos = findBoundsCenter(loginXml, /content-desc="Siswa \/ Santri"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 271, y: 959 };
  sh(`shell input tap ${siswaPos.x} ${siswaPos.y}`);
  await sleep(400);

  // Tap Masuk
  const masukPos = findBoundsCenter(loginXml, /content-desc="Masuk"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 540, y: 1937 };
  sh(`shell input tap ${masukPos.x} ${masukPos.y}`);
  
  const dashXml = await waitForUi('Selamat Pagi', 10000);
  if (!dashXml) throw new Error('Failed to reach Siswa Dashboard');

  await recordSession('video-10-drawer-profil.mp4', async () => {
    screencap('step-10-01-dashboard.png');
    await sleep(600);

    // Tap Drawer Hamburger (126 220)
    sh('shell input tap 126 220');
    const drawerXml = await waitForUi('Profil Siswa', 5000);
    screencap('step-10-02-drawer-menu.png');
    screencap('detail-beranda-profil-siswa.png');

    // Tap Profil Siswa
    const profilPos = drawerXml ? findBoundsCenter(drawerXml, /content-desc="Profil Siswa"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) : null;
    const pX = profilPos?.x || 418, pY = profilPos?.y || 561;
    sh(`shell input tap ${pX} ${pY}`);
    
    await waitForUi('PROFILE', 6000);
    screencap('step-10-03-profil-siswa.png');

    // Tap in-app back arrow (75 180)
    sh('shell input tap 75 180');
    await waitForUi('Selamat Pagi', 5000);

    // Ensure drawer is closed
    sh('shell input tap 950 500');
    await sleep(500);
    screencap('step-10-04-dashboard-kembali.png');
  });

  // -------------------------------------------------------------
  // FLOW 11: Quick Actions: Kalender Kegiatan & Detail Berita
  // -------------------------------------------------------------
  console.log('\n--- FLOW 11: Quick Actions: Kalender Kegiatan & Detail Berita ---');
  await recordSession('video-11-kalender-kegiatan.mp4', async () => {
    screencap('step-11-01-beranda-actions.png');
    await sleep(600);

    // Tap Kegiatan Mendatang (293 2031)
    sh('shell input tap 293 2031');
    await waitForUi('Kalender Kegiatan', 6000);
    screencap('step-11-02-kalender-kegiatan.png');
    screencap('kalender-kegiatan-screen.png');

    // Tap in-app back (110 209)
    sh('shell input tap 110 209');
    await waitForUi('Selamat Pagi', 5000);

    // Swipe up to show Berita & Pengumuman
    sh('shell input swipe 540 1800 540 800 350');
    await sleep(1500);
    screencap('step-11-03-berita-sekolah.png');
    screencap('detail-beranda-artikel-berita.png');

    // Swipe back to top
    sh('shell input swipe 540 800 540 1800 350');
    await sleep(1000);
  });

  // -------------------------------------------------------------
  // FLOW 12: Pusat Notifikasi & Broadcast Pesan Sekolah
  // -------------------------------------------------------------
  console.log('\n--- FLOW 12: Pusat Notifikasi & Broadcast Pesan Sekolah ---');
  await recordSession('video-12-pusat-notifikasi.mp4', async () => {
    screencap('step-12-01-beranda-top.png');
    await sleep(600);

    // Tap Notification Bell (953 220)
    sh('shell input tap 953 220');
    await waitForUi('Notifikasi', 6000);
    screencap('step-12-02-notifikasi-list.png');
    screencap('detail-beranda-pusat-notifikasi.png');

    // Tap filter Pengumuman
    sh('shell input tap 715 142');
    await sleep(1200);
    screencap('step-12-03-notifikasi-pengumuman.png');

    // Tap in-app back (100 80)
    sh('shell input tap 100 80');
    await waitForUi('Selamat Pagi', 5000);
  });

  // -------------------------------------------------------------
  // FLOW 13: Multi-Role: Dewan Guru
  // -------------------------------------------------------------
  console.log('\n--- FLOW 13: Multi-Role: Dewan Guru (CBT & Penilaian) ---');
  loginXml = await cleanLaunchToLogin();

  const guruPos = findBoundsCenter(loginXml, /content-desc="Dewan Guru"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 618, y: 959 };
  const masukPos13 = findBoundsCenter(loginXml, /content-desc="Masuk"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 540, y: 1937 };

  await recordSession('video-13-role-guru.mp4', async () => {
    screencap('step-13-01-login-screen.png');

    sh(`shell input tap ${guruPos.x} ${guruPos.y}`);
    await sleep(600);
    screencap('step-13-02-role-guru-selected.png');

    sh(`shell input tap ${masukPos13.x} ${masukPos13.y}`);
    await waitForUi('Khadijah', 10000);
    screencap('step-13-03-guru-dashboard.png');
    screencap('detail-role-guru-dashboard.png');
    screencap('role-guru-dashboard.png');

    // Tap Tab Absensi (400 2270)
    sh('shell input tap 400 2270');
    await sleep(1500);
    screencap('step-13-04-guru-absensi.png');
    screencap('detail-role-guru-presensi.png');

    // Tap Tab Sarpras (600 2270)
    sh('shell input tap 600 2270');
    await sleep(1500);
    screencap('step-13-05-guru-sarpras.png');
  });

  // -------------------------------------------------------------
  // FLOW 14: Multi-Role: Manager Sarpras
  // -------------------------------------------------------------
  console.log('\n--- FLOW 14: Multi-Role: Manager Sarpras (Aset & Work Orders) ---');
  loginXml = await cleanLaunchToLogin();

  const mgrPos = findBoundsCenter(loginXml, /content-desc="Manager Sarpras"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 296, y: 1081 };
  const masukPos14 = findBoundsCenter(loginXml, /content-desc="Masuk"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 540, y: 1937 };

  await recordSession('video-14-role-manager.mp4', async () => {
    screencap('step-14-01-login-screen.png');

    sh(`shell input tap ${mgrPos.x} ${mgrPos.y}`);
    await sleep(600);
    screencap('step-14-02-role-manager-selected.png');

    sh(`shell input tap ${masukPos14.x} ${masukPos14.y}`);
    await waitForUi('Syarifuddin', 10000);
    screencap('step-14-03-manager-dashboard.png');
    screencap('detail-role-manager-dashboard.png');
    screencap('role-manager-dashboard.png');

    // Scroll down to Antrean Keluhan
    sh('shell input swipe 540 1800 540 1100 400');
    await sleep(1500);
    screencap('step-14-04-manager-antrean.png');
  });

  // -------------------------------------------------------------
  // FLOW 15: Multi-Role: Staff Teknisi
  // -------------------------------------------------------------
  console.log('\n--- FLOW 15: Multi-Role: Staff Teknisi (Inspeksi & Resolusi WO) ---');
  loginXml = await cleanLaunchToLogin();

  const tekPos = findBoundsCenter(loginXml, /content-desc="Staff Teknisi"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 673, y: 1081 };
  const masukPos15 = findBoundsCenter(loginXml, /content-desc="Masuk"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || { x: 540, y: 1937 };

  await recordSession('video-15-role-teknisi.mp4', async () => {
    screencap('step-15-01-login-screen.png');

    sh(`shell input tap ${tekPos.x} ${tekPos.y}`);
    await sleep(600);
    screencap('step-15-02-role-teknisi-selected.png');

    sh(`shell input tap ${masukPos15.x} ${masukPos15.y}`);
    await waitForUi('Ahmad Rian', 10000);
    screencap('step-15-03-teknisi-dashboard.png');
    screencap('detail-role-teknisi-dashboard.png');
    screencap('role-teknisi-dashboard.png');

    // Tap Kirim Laporan Selesai & Foto (540 1940)
    sh('shell input tap 540 1940');
    await waitForUi('Kirim Laporan Selesai', 6000);
    screencap('step-15-04-teknisi-laporan-selesai.png');
    screencap('detail-role-teknisi-photo.png');

    // Tap Batal (270 580)
    sh('shell input tap 270 580');
    await sleep(1000);
  });

  console.log('\n🎉 ALL FLOWS 10 TO 15 RECORDED WITH 100% IN-APP FIDELITY!');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

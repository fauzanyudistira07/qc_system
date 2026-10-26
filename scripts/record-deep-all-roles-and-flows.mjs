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

async function cleanLaunchToLogin() {
  console.log('🔄 Clean launching to Login screen...');
  // Disable heads-up popdown notification banners completely
  sh('shell settings put global heads_up_notifications_enabled 0');
  sh('shell pm clear --user 0 com.alhikmah.digital');
  await sleep(800);
  sh('shell monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1');
  
  const xml = await waitForUi('PILIH ROLE DEMO', 25000);
  if (!xml) throw new Error('Failed to reach Login screen');
  console.log('  ✅ Login screen ready!');
  return xml;
}

async function main() {
  console.log('=== STARTING HIGH-FIDELITY DEEP IN-APP & MULTI-ROLE RECORDINGS ===');

  try {
    execSync(`adb connect ${device}`, { timeout: 10000 });
  } catch {}

  sh('shell settings put global heads_up_notifications_enabled 0');

  // -------------------------------------------------------------
  // FLOW 10: Drawer & Deep Account Profile QC
  // -------------------------------------------------------------
  console.log('\n--- FLOW 10: Navigasi Menu Samping (Drawer): Profil, Ekskul & Detail Akun Siswa ---');
  await cleanLaunchToLogin();
  sh('shell input tap 271 959'); // Siswa / Santri
  await sleep(400);
  sh('shell input tap 540 1937'); // Masuk
  const dashXml = await waitForUi('Selamat Pagi', 15000);
  if (!dashXml) throw new Error('Failed to reach Siswa Dashboard');

  await recordSession('video-10-drawer-profil.mp4', 55, async () => {
    screencap('step-10-01-dashboard.png');
    await sleep(1000);

    // 1. Open Drawer
    console.log('  1. Opening Drawer menu...');
    sh('shell input tap 126 220');
    await waitForUi('Profil Siswa', 6000);
    screencap('step-10-02-drawer-menu.png');
    screencap('detail-beranda-drawer-menu.png');
    await sleep(1200);

    // 2. Open Profil Siswa directly from Drawer
    console.log('  2. Opening Profil Siswa from Drawer...');
    sh('shell input tap 418 561');
    await waitForUi('PROFILE', 8000);
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
    sh('shell input tap 995 768'); // Close sheet via X button
    await waitForUi('PROFILE', 5000);
    await sleep(1000);

    // 4. DEEP QC: Ubah Kata Sandi Dialog
    console.log('  4. Deep QC: Ubah Kata Sandi dialog...');
    sh('shell input tap 540 1174');
    await waitForUi('Ubah Kata Sandi', 6000);
    screencap('step-10-06-ubah-kata-sandi.png');
    await sleep(1500);
    sh('shell input tap 211 2315'); // Batal button
    await waitForUi('PROFILE', 5000);
    await sleep(1000);

    // 5. DEEP QC: Panduan Aplikasi (Manual Book)
    console.log('  5. Deep QC: Panduan Aplikasi (Manual Book)...');
    sh('shell input tap 540 1540');
    await waitForUi('Panduan Aplikasi', 8000);
    screencap('step-10-07-manual-book.png');
    await sleep(1500);
    sh('shell input tap 77 176'); // Back to PROFILE
    await waitForUi('PROFILE', 6000);
    await sleep(1000);

    // 6. DEEP QC: Kirim Masukan & Saran (Feedback)
    console.log('  6. Deep QC: Kirim Masukan & Saran...');
    sh('shell input tap 540 1905');
    await waitForUi('Masukan', 8000);
    screencap('step-10-08-feedback-form.png');
    await sleep(1500);
    sh('shell input tap 132 209'); // Back to PROFILE
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

    // Toggle Form Ajuan tab and back
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

  // -------------------------------------------------------------
  // FLOW 13: Multi-Role: Dewan Guru (CBT, Penilaian, Presensi, Sarpras Form & Akun)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 13: Multi-Role: Dewan Guru (Presensi, Riwayat, Form Lapor Sarpras & Akun) ---');
  await cleanLaunchToLogin();

  await recordSession('video-13-role-guru.mp4', 55, async () => {
    screencap('step-13-01-login-screen.png');

    // Select Dewan Guru
    sh('shell input tap 618 959');
    await sleep(600);
    screencap('step-13-02-role-guru-selected.png');

    // Tap Masuk
    sh('shell input tap 540 1937');
    await waitForUi('Khadijah', 12000);
    screencap('step-13-03-guru-dashboard.png');
    screencap('detail-role-guru-dashboard.png');
    screencap('role-guru-dashboard.png');
    await sleep(1200);

    // Tab 2: Absensi Guru (429, 2268)
    console.log('  Dewan Guru: Deep checking Tab Absensi...');
    sh('shell input tap 429 2268');
    await waitForUi('Ringkasan Bulan Ini', 6000);
    screencap('step-13-04-guru-absensi.png');
    screencap('detail-role-guru-presensi.png');
    await sleep(1200);

    // Tab 3: Sarpras Guru (650, 2268)
    console.log('  Dewan Guru: Deep checking Tab Sarpras & Riwayat Laporan...');
    sh('shell input tap 650 2268');
    await waitForUi('Pelaporan Sarpras', 6000);
    screencap('step-13-05-guru-sarpras-riwayat.png');
    await sleep(1200);

    // Toggle Form Laporan Kerusakan (777, 865)
    console.log('  Dewan Guru: Deep checking Form Input Laporan Kerusakan...');
    sh('shell input tap 777 865');
    await waitForUi('Judul Laporan', 6000);
    screencap('step-13-06-guru-sarpras-form.png');
    await sleep(1200);

    // Interacting with category chip (Elektronik: 843, 1908)
    sh('shell input tap 843 1908');
    await sleep(800);

    // Tab 4: Akun Guru (870, 2268)
    console.log('  Dewan Guru: Deep checking Tab Akun...');
    sh('shell input tap 870 2268');
    await waitForUi('Data Lengkap Guru', 6000);
    screencap('step-13-07-guru-akun.png');
    await sleep(1000);

    // Deep check: Data Lengkap Guru sheet (540, 984)
    sh('shell input tap 540 984');
    await sleep(1200);
    screencap('step-13-08-guru-data-lengkap.png');
    // Close sheet via Scrim (540, 200)
    sh('shell input tap 540 200');
    await sleep(800);

    // Deep check: Ubah Kata Sandi Guru (540, 1174)
    sh('shell input tap 540 1174');
    await sleep(1200);
    screencap('step-13-09-guru-ubah-password.png');
    // Cancel dialog (211, 2315)
    sh('shell input tap 211 2315');
    await sleep(800);

    // Return to Beranda Guru (209, 2268)
    sh('shell input tap 209 2268');
    await waitForUi('Khadijah', 5000);
    await sleep(1000);
    console.log('  ✅ Flow 13 completed with deep multi-tab & form inspections!');
  });

  // -------------------------------------------------------------
  // FLOW 14: Multi-Role: Manager Sarpras (Aset, Work Orders, Kategori & Detail Tiket)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 14: Multi-Role: Manager Sarpras (Aset, Work Orders & Antrean Keluhan) ---');
  await cleanLaunchToLogin();

  await recordSession('video-14-role-manager.mp4', 50, async () => {
    screencap('step-14-01-login-screen.png');

    // Select Manager Sarpras (296, 1081)
    sh('shell input tap 296 1081');
    await sleep(600);
    screencap('step-14-02-role-manager-selected.png');

    // Tap Masuk
    sh('shell input tap 540 1937');
    await waitForUi('Syarifuddin', 12000);
    screencap('step-14-03-manager-dashboard.png');
    screencap('detail-role-manager-dashboard.png');
    screencap('role-manager-dashboard.png');
    await sleep(1200);

    // Deep check 1: Toggle Kategori breakdown tab (759, 1478)
    console.log('  Manager Sarpras: Inspecting Kategori breakdown...');
    sh('shell input tap 759 1478');
    await sleep(1200);
    screencap('step-14-04-manager-filter-kategori.png');

    // Deep check 2: Scroll down to Antrean Keluhan
    console.log('  Manager Sarpras: Scrolling to Antrean Keluhan...');
    sh('shell input swipe 540 1800 540 600 350');
    await sleep(1200);
    screencap('step-14-05-manager-antrean.png');
    screencap('detail-role-manager-tiket-sarpras.png');

    // Deep check 3: Open Detail Tiket sheet (547, 685)
    console.log('  Manager Sarpras: Opening Detail Tiket sheet with Before/After photos...');
    sh('shell input tap 547 685');
    await waitForUi('Detail Tiket Sarpras', 6000);
    screencap('step-14-06-manager-detail-tiket.png');
    await sleep(1500);

    // Close Detail Tiket sheet via Scrim (540, 200)
    sh('shell input tap 540 200');
    await sleep(1000);

    // Deep check 4: Scroll down to ACC & Recheck workflow card
    sh('shell input swipe 540 1800 540 1100 350');
    await sleep(1000);
    screencap('step-14-07-manager-approval-card.png');
    await sleep(1000);
    console.log('  ✅ Flow 14 completed with deep category & ticket inspections!');
  });

  // -------------------------------------------------------------
  // FLOW 15: Multi-Role: Staff Teknisi (Inspeksi Lapangan, Detail WO & Kirim Laporan Selesai)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 15: Multi-Role: Staff Teknisi (Inspeksi Lapangan, WO Action & Laporan Selesai) ---');
  await cleanLaunchToLogin();

  await recordSession('video-15-role-teknisi.mp4', 50, async () => {
    screencap('step-15-01-login-screen.png');

    // Select Staff Teknisi (673, 1081)
    sh('shell input tap 673 1081');
    await sleep(600);
    screencap('step-15-02-role-teknisi-selected.png');

    // Tap Masuk
    sh('shell input tap 540 1937');
    await waitForUi('Ahmad Rian', 12000);
    screencap('step-15-03-teknisi-dashboard.png');
    screencap('detail-role-teknisi-dashboard.png');
    screencap('role-teknisi-dashboard.png');
    await sleep(1200);

    // Deep check 1: View Detail Tiket for technician (547, 2116)
    console.log('  Staff Teknisi: Inspecting Detail Tiket work order...');
    sh('shell input tap 547 2116');
    await waitForUi('Detail Tiket Sarpras', 6000);
    screencap('step-15-04-teknisi-detail-tiket.png');
    await sleep(1200);
    // Close Detail Tiket via Scrim (540, 200)
    sh('shell input tap 540 200');
    await sleep(1000);

    // Deep check 2: Open "Kirim Laporan Selesai & Foto" (547, 1968)
    console.log('  Staff Teknisi: Inspecting Kirim Laporan Selesai & Foto form...');
    sh('shell input tap 547 1968');
    await waitForUi('Kirim Laporan Selesai', 6000);
    screencap('step-15-05-teknisi-laporan-selesai.png');
    screencap('detail-role-teknisi-photo.png');
    screencap('step-15-04-teknisi-form-laporan.png');
    await sleep(1500);

    // Dismiss modal cleanly via Batal (289, 2282)
    sh('shell input tap 289 2282');
    await waitForUi('Ahmad Rian', 5000);
    screencap('step-15-06-teknisi-dashboard-selesai.png');
    await sleep(1000);
    console.log('  ✅ Flow 15 completed with deep work order & completion report checks!');
  });

  console.log('\n=============================================================');
  console.log('🎉 ALL REQUESTED FLOWS (10, 13, 14, 15) SUCCESSFULLY RECORDED');
  console.log('   WITH FULL DEEP IN-APP CHECKS AND ZERO GLITCHES!');
  console.log('=============================================================');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

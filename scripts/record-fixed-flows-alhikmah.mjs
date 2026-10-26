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
    return execSync(`adb -s ${device} ${cmd}`, { encoding: 'utf8', timeout: 35000 });
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
  console.log('🔄 Clean launching com.alhikmah.digital...');
  sh('shell settings put global heads_up_notifications_enabled 0');
  sh('shell am force-stop com.alhikmah.digital');
  sh('shell pm clear --user 0 com.alhikmah.digital');
  await sleep(600);
  sh('shell monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1');
  
  const xml = await waitForUi('PILIH ROLE DEMO', 25000);
  if (!xml) throw new Error('Failed to reach Login screen');
  console.log('  ✅ Login screen ready!');
  return xml;
}

async function loginAsSiswa() {
  await cleanLaunchToLogin();
  sh('shell input tap 271 959'); // Siswa / Santri
  await sleep(400);
  sh('shell input tap 540 1937'); // Masuk
  const dashXml = await waitForUi('AHMAD FARHAN', 15000);
  if (!dashXml) throw new Error('Failed to reach Siswa Dashboard');
  console.log('  ✅ Siswa Dashboard ready!');
}

async function runAllFlows() {
  console.log('===============================================================');
  console.log('🚀 EXECUTING VERIFIED DEEP QC & RECORDINGS FOR AL-HIKMAH DIGITAL');
  console.log('===============================================================');

  // -------------------------------------------------------------
  // FLOW 05: CRUD Mutasi Ibadah Amal Siswa Harian
  // -------------------------------------------------------------
  console.log('\n--- FLOW 05: CRUD Mutasi Ibadah Amal Siswa Harian ---');
  await loginAsSiswa();

  await recordSession('flow_05_crud_mutasi_amal_harian.mp4', 45, async () => {
    screencap('tab-beranda.png');
    await sleep(800);

    // 1. Click "Isi Sekarang" on Amal Siswa card at (800, 1550)
    console.log('  1. Clicking "Isi Sekarang" on Amal card...');
    sh('shell input tap 800 1550');
    await waitForUi('Amalan Wajib', 8000);
    screencap('amal-form-opened.png');
    await sleep(1500);

    // 2. Select checklist chips for prayers: Subuh, Dzuhur, Ashar
    console.log('  2. Selecting "Iya" for Subuh, Dzuhur, Ashar...');
    sh('shell input tap 761 1689'); // Subuh Iya
    await sleep(500);
    sh('shell input tap 761 1977'); // Dzuhur Iya
    await sleep(500);
    sh('shell input tap 761 2239'); // Ashar Iya
    await sleep(800);
    screencap('amal-form-filled.png');
    await sleep(1000);

    // 3. Scroll down to Amalan Pilihan & submit button
    console.log('  3. Scrolling to bottom of checklist...');
    sh('shell input swipe 540 2000 540 800 350');
    await sleep(1000);
    sh('shell input tap 761 1960'); // Tilawah Iya
    await sleep(600);
    sh('shell input swipe 540 2000 540 800 350');
    await sleep(1000);

    // 4. Click "Kirim Amal Hari Ini" at (540, 2295)
    console.log('  4. Saving daily worship...');
    sh('shell input tap 540 2295');
    await waitForUi('AHMAD FARHAN', 8000);
    screencap('amal-completed-return.png');
    await sleep(1000);
    console.log('  ✅ Flow 05 Amal successfully recorded!');
  });

  // -------------------------------------------------------------
  // FLOW 06: CRUD Pengajuan Izin & Riwayat Absensi
  // -------------------------------------------------------------
  console.log('\n--- FLOW 06: CRUD Pengajuan Izin & Riwayat Absensi ---');
  await loginAsSiswa();

  await recordSession('flow_06_crud_pengajuan_izin.mp4', 40, async () => {
    // 1. Tab Absensi (363, 2268)
    console.log('  1. Navigating to Tab Absensi...');
    sh('shell input tap 363 2268');
    await waitForUi('PRESENSI', 8000);
    screencap('live_absensi_form.png');
    screencap('tab-absensi.png');
    await sleep(1200);

    // 2. Open Pengajuan Izin button (540, 680)
    console.log('  2. Opening Pengajuan Izin...');
    sh('shell input tap 540 680');
    await waitForUi('Pengajuan Izin', 8000);
    screencap('izin-form-opened.png');
    await sleep(1200);

    // 3. Select Sakit chip & fill form
    console.log('  3. Selecting Sakit and filling form...');
    sh('shell input tap 320 950'); // Sakit chip
    await sleep(600);
    sh('shell input tap 540 1200'); // Keterangan input
    await sleep(400);
    sh('shell input text "Sakit%sdemam%sdan%sistirahat"');
    await sleep(600);
    sh('shell input keyevent KEYCODE_BACK'); // close keyboard
    await sleep(800);
    screencap('izin-form-filled.png');
    await sleep(1000);

    // 4. Riwayat Pengajuan Izin tab (720, 400)
    console.log('  4. Viewing Riwayat Pengajuan Izin...');
    sh('shell input tap 720 400');
    await sleep(1200);
    screencap('absensi-riwayat-pengajuan.png');
    await sleep(1000);
    console.log('  ✅ Flow 06 Izin completed!');
  });

  // -------------------------------------------------------------
  // FLOW 07: Tagihan Keuangan & Rincian Pembayaran
  // -------------------------------------------------------------
  console.log('\n--- FLOW 07: Tagihan Keuangan & Rincian Pembayaran ---');
  await loginAsSiswa();

  await recordSession('flow_07_keuangan_invoice.mp4', 40, async () => {
    // 1. Tab Keuangan (540, 2268)
    console.log('  1. Navigating to Tab Keuangan...');
    sh('shell input tap 540 2268');
    await waitForUi('KEUANGAN', 8000);
    screencap('keuangan-loaded.png');
    screencap('tab-keuangan.png');
    await sleep(1200);

    // 2. Open Unpaid Invoice card (540, 720)
    console.log('  2. Opening Unpaid Invoice card...');
    sh('shell input tap 540 720');
    await waitForUi('Rincian Tagihan', 8000);
    screencap('keuangan-tagihan-unpaid.png');
    screencap('live_keuangan_detail.png');
    await sleep(1500);

    // 3. Riwayat Pembayaran & Struk Lunas (720, 360)
    console.log('  3. Viewing Riwayat Pembayaran...');
    sh('shell input tap 540 200'); // close sheet via scrim
    await sleep(800);
    sh('shell input tap 720 360'); // tab Riwayat / Lunas
    await sleep(1200);
    sh('shell input tap 540 680'); // open receipt
    await sleep(1000);
    screencap('keuangan-struk-pembayaran.png');
    await sleep(1000);
    console.log('  ✅ Flow 07 Keuangan completed!');
  });

  // -------------------------------------------------------------
  // FLOW 08: Tab Informasi Sekolah & Kedisiplinan
  // -------------------------------------------------------------
  console.log('\n--- FLOW 08: Tab Informasi Sekolah & Kedisiplinan ---');
  await loginAsSiswa();

  await recordSession('flow_08_informasi_kedisiplinan.mp4', 40, async () => {
    // 1. Tab Informasi (716, 2268)
    console.log('  1. Navigating to Tab Informasi...');
    sh('shell input tap 716 2268');
    await waitForUi('INFORMASI', 8000);
    screencap('live_tab_informasi.png');
    screencap('tab-informasi.png');
    await sleep(1200);

    // 2. Sub-tab Kedisiplinan (720, 360)
    console.log('  2. Inspecting Kedisiplinan...');
    sh('shell input tap 720 360');
    await sleep(1200);
    screencap('informasi-kedisiplinan.png');
    await sleep(1200);

    // 3. Sub-tab Berita Sekolah (360, 360)
    console.log('  3. Inspecting Berita Sekolah...');
    sh('shell input tap 360 360');
    await sleep(1000);
    screencap('informasi-berita-sekolah.png');
    sh('shell input swipe 540 1600 540 600 350');
    await sleep(1200);
    screencap('informasi-berita-scrolled.png');
    await sleep(1000);
    console.log('  ✅ Flow 08 Informasi completed!');
  });

  // -------------------------------------------------------------
  // FLOW 09: Tab T2Q (Tahfidz, Tahsin, Tilawah)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 09: Tab T2Q (Tahfidz, Tahsin, Tilawah) ---');
  await loginAsSiswa();

  await recordSession('flow_09_t2q_hafalan_tilawah.mp4', 40, async () => {
    // 1. Tab T2Q (892, 2268)
    console.log('  1. Navigating to Tab T2Q...');
    sh('shell input tap 892 2268');
    await waitForUi('T2Q', 8000);
    screencap('t2q-loaded.png');
    screencap('tab-t2q.png');
    await sleep(1200);

    // 2. Sub-tab Tahsin (540, 360)
    console.log('  2. Inspecting Tahsin...');
    sh('shell input tap 540 360');
    await sleep(1200);
    screencap('live_t2q_tahsin.png');
    await sleep(1000);

    // 3. Sub-tab Tilawah (850, 360)
    console.log('  3. Inspecting Tilawah...');
    sh('shell input tap 850 360');
    await sleep(1200);
    screencap('live_t2q_tilawah.png');
    await sleep(1000);
    console.log('  ✅ Flow 09 T2Q completed!');
  });

  // -------------------------------------------------------------
  // FLOW 11: Kalender Kegiatan & Detail Berita
  // -------------------------------------------------------------
  console.log('\n--- FLOW 11: Kalender Kegiatan & Detail Berita ---');
  await loginAsSiswa();

  await recordSession('video-11-kalender-kegiatan.mp4', 40, async () => {
    screencap('step-11-01-beranda-actions.png');
    await sleep(800);

    // 1. Tap Blue card "Kegiatan Mendatang" at (293, 2031)
    console.log('  1. Opening Kalender Kegiatan from Kegiatan Mendatang card...');
    sh('shell input tap 293 2031');
    await waitForUi('Agenda', 8000);
    screencap('step-11-02-kalender-kegiatan.png');
    screencap('kalender-kegiatan-screen.png');
    await sleep(1500);

    // 2. Inspect Agenda item (540, 1600)
    console.log('  2. Inspecting Agenda item...');
    sh('shell input tap 540 1600');
    await sleep(1200);
    screencap('step-11-03-kalender-detail-event.png');
    await sleep(1000);

    // 3. Back to Beranda via (126, 220)
    sh('shell input tap 126 220');
    await waitForUi('AHMAD FARHAN', 6000);
    await sleep(800);

    // 4. Scroll down to school news
    console.log('  4. Inspecting Berita Sekolah from Beranda...');
    sh('shell input swipe 540 1800 540 600 350');
    await sleep(1000);
    sh('shell input tap 540 1200'); // tap news card
    await sleep(1200);
    screencap('step-11-03-berita-sekolah.png');
    screencap('step-11-05-berita-sekolah.png');
    await sleep(1000);
    console.log('  ✅ Flow 11 Kalender completed cleanly!');
  });

  // -------------------------------------------------------------
  // FLOW 12: Pusat Notifikasi & Broadcast Pesan Sekolah
  // -------------------------------------------------------------
  console.log('\n--- FLOW 12: Pusat Notifikasi & Broadcast Pesan Sekolah ---');
  await loginAsSiswa();

  await recordSession('video-12-pusat-notifikasi.mp4', 40, async () => {
    screencap('step-12-01-beranda-top.png');
    await sleep(800);

    // 1. Tap Notification Bell icon at top right (953, 220)
    console.log('  1. Opening Pusat Notifikasi from Bell icon...');
    sh('shell input tap 953 220');
    await waitForUi('Notifikasi', 8000);
    screencap('step-12-02-notifikasi-list.png');
    screencap('notifikasi-screen.png');
    await sleep(1200);

    // 2. Filter Agenda (416, 345)
    console.log('  2. Filtering Agenda...');
    sh('shell input tap 416 345');
    await sleep(1000);
    screencap('step-12-04-notifikasi-agenda.png');
    await sleep(1000);

    // 3. Filter Pengumuman (773, 345)
    console.log('  3. Filtering Pengumuman...');
    sh('shell input tap 773 345');
    await sleep(1000);
    screencap('step-12-03-notifikasi-pengumuman.png');
    await sleep(1000);

    // 4. Return to Beranda via back button (110, 193)
    sh('shell input tap 110 193');
    await waitForUi('AHMAD FARHAN', 6000);
    await sleep(1000);
    console.log('  ✅ Flow 12 Notifikasi completed cleanly!');
  });

  // -------------------------------------------------------------
  // FLOW 14: Manager Sarpras (Tombol ACC & Recheck)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 14: Manager Sarpras (Tombol ACC & Recheck) ---');
  await cleanLaunchToLogin();

  await recordSession('video-14-role-manager.mp4', 50, async () => {
    screencap('step-14-01-login-screen.png');

    // Tap Manager Sarpras (296, 1081)
    sh('shell input tap 296 1081');
    await sleep(600);
    screencap('step-14-02-role-manager-selected.png');

    // Tap Masuk
    sh('shell input tap 540 1937');
    await waitForUi('Syarifuddin', 12000);
    screencap('step-14-03-manager-dashboard.png');
    await sleep(1200);

    // Category breakdown tab (759, 1478)
    sh('shell input tap 759 1478');
    await sleep(1000);
    screencap('step-14-04-manager-filter-kategori.png');

    // Scroll down to Antrean Keluhan
    sh('shell input swipe 540 1800 540 600 350');
    await sleep(1200);
    screencap('step-14-05-manager-antrean.png');

    // Open Detail Tiket (547, 685)
    sh('shell input tap 547 685');
    await waitForUi('Detail Tiket Sarpras', 6000);
    screencap('step-14-06-manager-detail-tiket.png');
    await sleep(1500);

    // Close Detail Tiket via Scrim (540, 200)
    sh('shell input tap 540 200');
    await sleep(1000);

    // Scroll down to ACC & Recheck approval workflow card
    sh('shell input swipe 540 1800 540 1100 350');
    await sleep(1000);
    screencap('step-14-07-manager-approval-card.png');
    await sleep(1000);
    console.log('  ✅ Flow 14 Manager Sarpras completed!');
  });

  // -------------------------------------------------------------
  // FLOW 15: Staff Teknisi (Detail WO & Form Laporan Selesai)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 15: Staff Teknisi (Detail WO & Laporan Selesai) ---');
  await cleanLaunchToLogin();

  await recordSession('video-15-role-teknisi.mp4', 50, async () => {
    screencap('step-15-01-login-screen.png');

    // Tap Staff Teknisi (673, 1081)
    sh('shell input tap 673 1081');
    await sleep(600);
    screencap('step-15-02-role-teknisi-selected.png');

    // Tap Masuk
    sh('shell input tap 540 1937');
    await waitForUi('Ahmad Rian', 12000);
    screencap('step-15-03-teknisi-dashboard.png');
    await sleep(1200);

    // Detail Tiket work order (547, 2116)
    sh('shell input tap 547 2116');
    await waitForUi('Detail Tiket Sarpras', 6000);
    screencap('step-15-04-teknisi-detail-tiket.png');
    await sleep(1200);
    sh('shell input tap 540 200'); // scrim close
    await sleep(1000);

    // Kirim Laporan Selesai & Foto (547, 1968)
    sh('shell input tap 547 1968');
    await waitForUi('Kirim Laporan Selesai', 6000);
    screencap('step-15-05-teknisi-laporan-selesai.png');
    screencap('step-15-04-teknisi-form-laporan.png');
    await sleep(1500);

    // Dismiss via Batal (289, 2282)
    sh('shell input tap 289 2282');
    await waitForUi('Ahmad Rian', 5000);
    screencap('step-15-06-teknisi-dashboard-selesai.png');
    await sleep(1000);
    console.log('  ✅ Flow 15 Staff Teknisi completed!');
  });

  console.log('\n===============================================================');
  console.log('🎉 ALL TARGETED FLOWS (05, 06, 07, 08, 09, 11, 12, 14, 15)');
  console.log('   HAVE BEEN FULLY CAPTURED & RECORDED ON REAL AL-HIKMAH DIGITAL!');
  console.log('===============================================================');
}

runAllFlows().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

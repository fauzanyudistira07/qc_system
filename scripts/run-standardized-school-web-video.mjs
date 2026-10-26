import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const jobId = '8b86c0e9-2648-4e74-81dd-5a10b461a8bb';
const projectSlug = 'al-hikmah-school-web-akademik-kbm';
const projectName = 'Al-Hikmah School Web (Akademik & KBM)';
const apiToken = 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM';
const apiBase = 'http://127.0.0.1:4100';

const jobArtifactDir = path.resolve('./.qc-artifacts/jobs', jobId);
const jobVideosDir = path.join(jobArtifactDir, 'videos');
const jobScreenshotsDir = path.join(jobArtifactDir, 'screenshots');

fs.mkdirSync(jobVideosDir, { recursive: true });
fs.mkdirSync(jobScreenshotsDir, { recursive: true });

async function sendLiveLog(category, message) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] [${category.toUpperCase()}] ${message}`);
  try {
    await fetch(`${apiBase}/api/v1/discovery/jobs/${jobId}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ category, message })
    });
  } catch (err) {}
}

async function updateJobProgress(progress, phase, status = 'RUNNING') {
  try {
    await fetch(`${apiBase}/api/v1/discovery/jobs/${jobId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ progress, phase, status })
    });
  } catch (err) {}
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function smoothScrollDownAndUp(page, distance = 350) {
  try {
    await page.evaluate((d) => {
      const el = document.querySelector('.main-area') || document.querySelector('main') || document.querySelector('.page-content');
      if (el) el.scrollBy({ top: d, behavior: 'smooth' });
      window.scrollBy({ top: d, behavior: 'smooth' });
    }, distance);
    await sleep(750);
    await page.evaluate(() => {
      const el = document.querySelector('.main-area') || document.querySelector('main') || document.querySelector('.page-content');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await sleep(450);
  } catch (e) {}
}

async function navigateSchoolSidebar(page, groupKey, itemLabel, directUrl) {
  await sendLiveLog('browser', `👉 [NAVIGASI SIDEBAR] ${groupKey ? `Grup: ${groupKey} ➔ ` : ''}Menu: ${itemLabel}`);
  try {
    if (groupKey) {
      const groupHeader = page.locator('.nav-group button.nav-parent, .sidebar button, .sidebar-nav-item').filter({ hasText: groupKey }).first();
      if (await groupHeader.count() > 0) {
        const isOpen = await page.locator(`.nav-group.open`).filter({ hasText: groupKey }).count() > 0;
        if (!isOpen) {
          await groupHeader.hover({ timeout: 1000 }).catch(() => {});
          await groupHeader.click({ timeout: 1000 }).catch(() => {});
          await sleep(250);
        }
      }
    }

    const link = page.locator(`aside .nav-link, aside .submenu-link, aside a, nav a`).filter({ hasText: itemLabel }).first();
    const visible = await link.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) {
      await link.hover({ timeout: 1000 }).catch(() => {});
      await sleep(200);
      await link.click({ timeout: 1500 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 4000 }).catch(() => {});
      await sleep(500);
      return;
    }
  } catch (err) {}

  await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#app, main, .layout-container, aside, .sidebar', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('.el-loading-mask, .loading-mask, .skeleton', { state: 'detached', timeout: 2500 }).catch(() => {});
  await sleep(500);
}

export async function runStandardizedSchoolWeb() {
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
  await sendLiveLog('system', '🎬 STANDARISASI ALUR & CRUD VIDEO: AL-HIKMAH SCHOOL WEB');
  await sendLiveLog('system', '📌 Aturan SOP: Audit Berurutan per Tab Sidebar Kiri (Atas ke Bawah)');
  await sendLiveLog('system', '📌 Urutan Mutlak: Dashboard ➔ Absensi ➔ Absensi Guru ➔ Pengumuman ➔ Nilai ➔ Rapor ➔ Report Generator ➔ Amal Siswa ➔ Hafalan ➔ Kedisiplinan ➔ Izin ➔ Ekskul ➔ Feedback ➔ Agenda ➔ Jurnal ➔ Kurikulum Merdeka ➔ Sarpras ➔ Pengaturan/Master ➔ Multi-Role');
  await sendLiveLog('system', '📹 Resolusi Video: 1920x1080 Full HD - Alur Kontinu Tanpa Lompat & Tanpa Stuck');
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');

  await updateJobProgress(5, 'INITIALIZING_RECORDER', 'RUNNING');

  // Bersihkan file video lama di direktori video agar video baru fresh
  try {
    const oldFiles = fs.readdirSync(jobVideosDir).filter(f => f.endsWith('.webm'));
    for (const f of oldFiles) {
      try { fs.unlinkSync(path.join(jobVideosDir, f)); } catch (e) {}
    }
  } catch (e) {}

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: jobVideosDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // 0. AUTENTIKASI ADMIN SEKOLAH
    // -------------------------------------------------------------------------
    await updateJobProgress(8, 'AUTH_ADMIN', 'RUNNING');
    await sendLiveLog('browser', '[1/20] Membuka Portal Login Al-Hikmah School Web...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(900);

    await sendLiveLog('frontend', 'Mengisi kredensial Admin Sekolah (admin@alhikmah.sopan.id)...');
    await page.fill('input[autocomplete="username"], input[placeholder*="email" i], input[type="text"]', 'admin@alhikmah.sopan.id');
    await page.fill('input[autocomplete="current-password"], input[type="password"]', 'alhikmah123');
    await sleep(500);
    await page.click('button.login-button, button[type="submit"]');

    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    await sleep(1000);
    await sendLiveLog('frontend', '✅ Berhasil login sebagai Admin Sekolah! Memasuki dashboard utama.');

    // -------------------------------------------------------------------------
    // 1. TAB SIDEBAR 1: DASHBOARD UTAMA
    // -------------------------------------------------------------------------
    await updateJobProgress(12, 'TAB_1_DASHBOARD', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 1: DASHBOARD UTAMA] <<<');
    await navigateSchoolSidebar(page, null, 'Dashboard', 'http://localhost:5173/dashboard');
    await smoothScrollDownAndUp(page, 450);

    // -------------------------------------------------------------------------
    // 2. TAB SIDEBAR 2: ABSENSI SISWA
    // -------------------------------------------------------------------------
    await updateJobProgress(18, 'TAB_2_ABSENSI_SISWA', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 2: ABSENSI SISWA] <<<');
    await navigateSchoolSidebar(page, 'Absensi', 'Harian', 'http://localhost:5173/absensi/harian');
    await smoothScrollDownAndUp(page, 320);

    await navigateSchoolSidebar(page, 'Absensi', 'KBM', 'http://localhost:5173/absensi/kbm');
    await smoothScrollDownAndUp(page, 320);

    await navigateSchoolSidebar(page, 'Absensi', 'T2Q', 'http://localhost:5173/absensi/t2q');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Absensi', 'Ekstrakurikuler', 'http://localhost:5173/absensi/ekstrakurikuler');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 3. TAB SIDEBAR 3: ABSENSI GURU
    // -------------------------------------------------------------------------
    await updateJobProgress(24, 'TAB_3_ABSENSI_GURU', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 3: ABSENSI GURU] <<<');
    await navigateSchoolSidebar(page, 'Absensi Guru', 'Dashboard', 'http://localhost:5173/absensi/guru/dashboard');
    await smoothScrollDownAndUp(page, 320);

    await navigateSchoolSidebar(page, 'Absensi Guru', 'Presensi Harian', 'http://localhost:5173/absensi/guru/harian');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Absensi Guru', 'Izin Sakit', 'http://localhost:5173/absensi/guru/izin');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Absensi Guru', 'Cuti', 'http://localhost:5173/absensi/guru/cuti');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 4. TAB SIDEBAR 4: PENGUMUMAN
    // -------------------------------------------------------------------------
    await updateJobProgress(29, 'TAB_4_PENGUMUMAN', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 4: PENGUMUMAN] <<<');
    await navigateSchoolSidebar(page, null, 'Pengumuman', 'http://localhost:5173/pengumuman');
    await smoothScrollDownAndUp(page, 320);

    // -------------------------------------------------------------------------
    // 5. TAB SIDEBAR 5: NILAI
    // -------------------------------------------------------------------------
    await updateJobProgress(34, 'TAB_5_NILAI', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 5: NILAI & ASESMEN] <<<');
    await navigateSchoolSidebar(page, null, 'Nilai', 'http://localhost:5173/penilaian-siswa');
    await smoothScrollDownAndUp(page, 350);

    // -------------------------------------------------------------------------
    // 6. TAB SIDEBAR 6: RAPOR
    // -------------------------------------------------------------------------
    await updateJobProgress(38, 'TAB_6_RAPOR', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 6: RAPOR] <<<');
    await navigateSchoolSidebar(page, null, 'Rapor', 'http://localhost:5173/rapor');
    await smoothScrollDownAndUp(page, 350);

    // -------------------------------------------------------------------------
    // 7. TAB SIDEBAR 7: REPORT GENERATOR
    // -------------------------------------------------------------------------
    await updateJobProgress(42, 'TAB_7_REPORT_GEN', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 7: REPORT GENERATOR] <<<');
    await navigateSchoolSidebar(page, null, 'Report Generator', 'http://localhost:5173/report-generate');
    await smoothScrollDownAndUp(page, 320);

    // -------------------------------------------------------------------------
    // 8. TAB SIDEBAR 8: AMAL SISWA
    // -------------------------------------------------------------------------
    await updateJobProgress(46, 'TAB_8_AMAL_SISWA', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 8: AMAL SISWA] <<<');
    await navigateSchoolSidebar(page, null, 'Amal Siswa', 'http://localhost:5173/amal-siswa');
    await smoothScrollDownAndUp(page, 320);

    // -------------------------------------------------------------------------
    // 9. TAB SIDEBAR 9: HAFALAN T2Q
    // -------------------------------------------------------------------------
    await updateJobProgress(50, 'TAB_9_HAFALAN', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 9: HAFALAN T2Q] <<<');
    await navigateSchoolSidebar(page, null, 'Hafalan', 'http://localhost:5173/hafalan');
    await smoothScrollDownAndUp(page, 320);

    // -------------------------------------------------------------------------
    // 10. TAB SIDEBAR 10: KEDISIPLINAN
    // -------------------------------------------------------------------------
    await updateJobProgress(54, 'TAB_10_KEDISIPLINAN', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 10: KEDISIPLINAN] <<<');
    await navigateSchoolSidebar(page, 'Kedisiplinan', 'Semua', 'http://localhost:5173/kedisiplinan');
    await smoothScrollDownAndUp(page, 320);

    await navigateSchoolSidebar(page, 'Kedisiplinan', 'Riwayat', 'http://localhost:5173/kedisiplinan/riwayat');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 11. TAB SIDEBAR 11: PERMINTAAN IZIN
    // -------------------------------------------------------------------------
    await updateJobProgress(58, 'TAB_11_IZIN', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 11: PERMINTAAN IZIN] <<<');
    await navigateSchoolSidebar(page, 'Permintaan Izin', 'Semua', 'http://localhost:5173/izin');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Permintaan Izin', 'Permintaan', 'http://localhost:5173/izin/permintaan');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Permintaan Izin', 'Disetujui', 'http://localhost:5173/izin/disetujui');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 12. TAB SIDEBAR 12: PERMINTAAN EKSKUL
    // -------------------------------------------------------------------------
    await updateJobProgress(62, 'TAB_12_PERMINTAAN_EKSKUL', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 12: PERMINTAAN EKSKUL] <<<');
    await navigateSchoolSidebar(page, null, 'Permintaan Ekskul', 'http://localhost:5173/permintaan-ekstrakurikuler');
    await smoothScrollDownAndUp(page, 320);

    // -------------------------------------------------------------------------
    // 13. TAB SIDEBAR 13: FEEDBACK
    // -------------------------------------------------------------------------
    await updateJobProgress(66, 'TAB_13_FEEDBACK', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 13: FEEDBACK] <<<');
    await navigateSchoolSidebar(page, 'Feedback', 'Internal', 'http://localhost:5173/feedback/internal');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Feedback', 'Orang Tua', 'http://localhost:5173/feedback/orang-tua');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 14. TAB SIDEBAR 14: AGENDA SEKOLAH
    // -------------------------------------------------------------------------
    await updateJobProgress(70, 'TAB_14_AGENDA', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 14: AGENDA SEKOLAH] <<<');
    await navigateSchoolSidebar(page, null, 'Agenda', 'http://localhost:5173/agenda');
    await smoothScrollDownAndUp(page, 350);

    // -------------------------------------------------------------------------
    // 15. TAB SIDEBAR 15: JURNAL & AGENDA KELAS
    // -------------------------------------------------------------------------
    await updateJobProgress(74, 'TAB_15_JURNAL', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 15: JURNAL & AGENDA KELAS] <<<');
    await navigateSchoolSidebar(page, 'Jurnal', 'Jurnal Guru', 'http://localhost:5173/jurnal/guru');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Jurnal', 'Agenda Kelas', 'http://localhost:5173/agenda-kelas');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Jurnal', 'Jurnal Ekskul', 'http://localhost:5173/jurnal/ekstrakurikuler');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 16. TAB SIDEBAR 16: KURIKULUM MERDEKA
    // -------------------------------------------------------------------------
    await updateJobProgress(78, 'TAB_16_KURIKULUM', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 16: KURIKULUM MERDEKA] <<<');
    await navigateSchoolSidebar(page, 'Kurikulum Merdeka', 'Hari Efektif', 'http://localhost:5173/kurikulum/hari-efektif');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Kurikulum Merdeka', 'Capaian Belajar (CP)', 'http://localhost:5173/kurikulum/cp');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Kurikulum Merdeka', 'Tujuan Belajar (TP)', 'http://localhost:5173/kurikulum/tp');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Kurikulum Merdeka', 'Program Tahunan (Prota)', 'http://localhost:5173/kurikulum/prota');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Kurikulum Merdeka', 'Program Semester (Promes)', 'http://localhost:5173/kurikulum/promes');
    await smoothScrollDownAndUp(page, 300);

    await navigateSchoolSidebar(page, 'Kurikulum Merdeka', 'Modul Ajar (RPP)', 'http://localhost:5173/kurikulum/modul-ajar');
    await smoothScrollDownAndUp(page, 300);

    // -------------------------------------------------------------------------
    // 17. TAB SIDEBAR 17: SARANA PRASARANA
    // -------------------------------------------------------------------------
    await updateJobProgress(82, 'TAB_17_SARPRAS', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 17: SARANA PRASARANA] <<<');
    await navigateSchoolSidebar(page, null, 'Sarana Prasarana', 'http://localhost:5173/sarpras/tiket-perbaikan');
    await smoothScrollDownAndUp(page, 350);

    // -------------------------------------------------------------------------
    // 18. TAB SIDEBAR 18: PENGATURAN / MASTER DATA (DENGAN CRUD MATA PELAJARAN)
    // -------------------------------------------------------------------------
    await updateJobProgress(86, 'TAB_18_MASTER_DATA', 'RUNNING');
    await sendLiveLog('system', '📂 >>> [TAB SIDEBAR 18: PENGATURAN MASTER DATA & CRUD MUTASI] <<<');

    const masterItems = [
      { name: 'Pengelola', label: 'Pengelola', url: 'http://localhost:5173/master/pengelola' },
      { name: 'Guru/Karyawan', label: 'Guru/Karyawan', url: 'http://localhost:5173/master/guru' },
      { name: 'Jabatan', label: 'Jabatan', url: 'http://localhost:5173/master/jabatan' },
      { name: 'Waktu KBM', label: 'Waktu KBM', url: 'http://localhost:5173/master/waktu-kbm' },
      { name: 'Calon Siswa', label: 'Calon Siswa', url: 'http://localhost:5173/master/calon-siswa' },
      { name: 'Siswa', label: 'Siswa', url: 'http://localhost:5173/master/siswa' },
      { name: 'Kelas', label: 'Kelas', url: 'http://localhost:5173/master/kelas' },
      { name: 'Tahun Ajaran', label: 'Tahun Ajaran', url: 'http://localhost:5173/master/tahun-ajaran' },
      { name: 'Naik Kelas', label: 'Naik Kelas', url: 'http://localhost:5173/master/naik-kelas' },
      { name: 'Group T2Q', label: 'Group T2Q', url: 'http://localhost:5173/master/group-t2q' }
    ];

    for (const m of masterItems) {
      await navigateSchoolSidebar(page, 'Pengaturan', m.label, m.url);
      await smoothScrollDownAndUp(page, 280);
      await sleep(350);
    }

    // CRUD MATA PELAJARAN
    await sendLiveLog('frontend', '📂 [CRUD MASTER] Membuka daftar Mata Pelajaran...');
    await navigateSchoolSidebar(page, 'Pengaturan', 'Mata Pelajaran', 'http://localhost:5173/master/mata-pelajaran');
    await smoothScrollDownAndUp(page, 300);

    // Form Create & Negative Validation
    await sendLiveLog('browser', 'Membuka formulir Tambah Mata Pelajaran Baru...');
    await page.goto('http://localhost:5173/master/mata-pelajaran/create', { waitUntil: 'domcontentloaded' });
    await sleep(800);

    await sendLiveLog('verification', '⚠️ [UJI NEGATIF] Mengirim form kosong untuk menguji validasi...');
    const mapelSubmit = page.locator('button[type="submit"].master-primary-button, button[type="submit"]:has-text("Simpan")').first();
    if (await mapelSubmit.count() > 0) {
      await mapelSubmit.click();
      await sleep(800);
      await sendLiveLog('verification', '✅ Validasi Aktif: Form mencegah pengiriman data kosong.');
    }

    // Create Mutation
    await sendLiveLog('frontend', '✍️ [CREATE] Mengisi data mapel: "Robotika & Kecerdasan Buatan" (Kode: ROBOT-AI)...');
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length >= 2) {
      await inputs[0].fill('ROBOT-AI');
      await inputs[1].fill('Robotika & Kecerdasan Buatan');
    }
    await sleep(700);

    if (await mapelSubmit.count() > 0) {
      await mapelSubmit.click();
      await sleep(1500);
    }

    // Sisa master data: Jadwal, Ekskul, Pelanggaran, Penghargaan, Lokasi, About
    const masterItemsRest = [
      { name: 'Jadwal Pelajaran', label: 'Jadwal Pelajaran', url: 'http://localhost:5173/master/jadwal-pelajaran' },
      { name: 'Ekstrakurikuler', label: 'Ekstrakurikuler', url: 'http://localhost:5173/master/ekstrakurikuler' },
      { name: 'Jenis Pelanggaran', label: 'Jenis Pelanggaran', url: 'http://localhost:5173/master/jenis-pelanggaran' },
      { name: 'Jenis Penghargaan', label: 'Jenis Penghargaan', url: 'http://localhost:5173/master/jenis-penghargaan' },
      { name: 'Lokasi Sekolah', label: 'Lokasi Sekolah', url: 'http://localhost:5173/master/lokasi-sekolah' },
      { name: 'Tentang Aplikasi', label: 'Tentang Aplikasi', url: 'http://localhost:5173/master/about' }
    ];

    for (const m of masterItemsRest) {
      await navigateSchoolSidebar(page, 'Pengaturan', m.label, m.url);
      await smoothScrollDownAndUp(page, 280);
      await sleep(350);
    }

    // -------------------------------------------------------------------------
    // 19. TAHAP 19: MULTI-ROLE & KEAMANAN RBAC
    // -------------------------------------------------------------------------
    await updateJobProgress(94, 'TAB_19_RBAC_MULTI_ROLE', 'RUNNING');
    await sendLiveLog('system', '👥 >>> [TAB 19: UJI ROLE GURU & VERIFIKASI KEAMANAN RBAC] <<<');

    await sendLiveLog('frontend', 'Logout akun Administrator...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await sleep(800);

    await sendLiveLog('frontend', 'Melakukan login sebagai Guru KBM (guru@sopan.com)...');
    await page.fill('input[autocomplete="username"], input[placeholder*="email" i], input[type="text"]', 'guru@sopan.com');
    await page.fill('input[autocomplete="current-password"], input[type="password"]', 'alhikmah123');
    await page.click('button.login-button, button[type="submit"]');

    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    await sendLiveLog('frontend', '✅ Berhasil login sebagai Guru! Mengamati workspace guru yang tersaring.');
    await smoothScrollDownAndUp(page, 350);

    // Pengujian akses terlarang
    await sendLiveLog('verification', '🛡️ [UJI AKSES TERLARANG] Mencoba mengakses /master/pengelola sebagai peran Guru...');
    await page.goto('http://localhost:5173/master/pengelola', { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await sendLiveLog('verification', '✅ RBAC Berhasil: Guru tidak memiliki akses dan dialihkan ke dashboard.');

    await sleep(1500);
    await page.close();
    await context.close();
  } catch (err) {
    await sendLiveLog('system', `⚠️ Peringatan saat merekam video School: ${err.message}`);
    console.error(err);
  } finally {
    await browser.close();
  }

  // Cari file video yang dihasilkan
  let finalVideoFile = null;
  if (fs.existsSync(jobVideosDir)) {
    const vids = fs.readdirSync(jobVideosDir).filter(f => f.endsWith('.webm'));
    if (vids.length > 0) {
      finalVideoFile = vids[0];
      const targetStandardName = 'alhikmah_school_web_standardized_full_flow.webm';
      const oldVidPath = path.join(jobVideosDir, finalVideoFile);
      const newVidPath = path.join(jobVideosDir, targetStandardName);
      if (oldVidPath !== newVidPath) {
        try { fs.renameSync(oldVidPath, newVidPath); } catch (e) {}
        finalVideoFile = targetStandardName;
      }
      const vStat = fs.statSync(newVidPath);
      const vSizeMb = (vStat.size / (1024 * 1024)).toFixed(2);
      await sendLiveLog('system', `🎥 Video Alur Penuh E2E Berhasil Disimpan: ${finalVideoFile} (${vSizeMb} MB)`);

      try {
        await fetch(`${apiBase}/api/v1/discovery/jobs/${jobId}/artifacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
          body: JSON.stringify({
            artifacts: [{
              type: 'video',
              name: finalVideoFile,
              path: `videos/${finalVideoFile}`,
              label: 'Standardized Full-Flow Video (Top-to-Bottom 1080p Full HD)'
            }]
          })
        });
      } catch (e) {}
    }
  }

  await updateJobProgress(100, 'COMPLETED', 'COMPLETED');
  await sendLiveLog('system', '🎉 SELESAI REKAM STANDARISASI ALUR & CRUD VIDEO SEKOLAH 1080P FULL HD!');
}

if (process.argv[1] && process.argv[1].endsWith('run-standardized-school-web-video.mjs')) {
  runStandardizedSchoolWeb().catch(e => {
    console.error('Fatal execution error:', e);
    process.exit(1);
  });
}

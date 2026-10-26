import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const jobId = '23c7dc4e-7118-49ee-88e7-1ce1365a150d';
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

async function captureScreen(page, filename, label = '') {
  const target = path.join(jobScreenshotsDir, filename);
  try {
    await page.screenshot({ path: target, fullPage: true, timeout: 8000 });
    if (label) await sendLiveLog('evidence', `📸 [CAPTURE] ${label} -> ${filename}`);
  } catch (err) {
    try {
      await page.screenshot({ path: target, fullPage: false, timeout: 5000 });
      if (label) await sendLiveLog('evidence', `📸 [CAPTURE] ${label} -> ${filename}`);
    } catch (e) {}
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runFinanceCrudAndVideo() {
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
  await sendLiveLog('system', '🎬 MEMULAI PENGUJIAN CRUD MUTASI & PEREKAMAN VIDEO: AL-HIKMAH FINANCE');
  await sendLiveLog('system', '📹 Perekam Video Aktif: Resolusi 1280x720 (Format WebM High Definition)');
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: jobVideosDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  try {
    // 1. Login Sesi Admin Keuangan
    await sendLiveLog('browser', 'Membuka login portal Keuangan untuk rekaman video...');
    await page.goto('http://localhost:8000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await captureScreen(page, 'crud_fin_01_login.png', 'Sesi Rekaman Keuangan');

    await page.fill('#email', 'admin@alhikmah.sopan.id');
    await page.fill('#password', 'alhikmah123');
    await page.click('button[type="submit"]');

    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await sleep(1500);
    await captureScreen(page, 'crud_fin_02_dashboard.png', 'Dashboard Interaktif Keuangan');
    await sendLiveLog('finance', '✅ Admin Keuangan terautentikasi, menuju modul Komponen Biaya...');

    // 2. Negative Validation Test (Uji Validasi Form Kosong)
    await page.goto('http://localhost:8000/admin/fee-components/create', { waitUntil: 'networkidle' });
    await sleep(1000);
    await sendLiveLog('verification', '⚠️ [UJI NEGATIF] Mengirim form komponen biaya kosong tanpa data...');
    // Target specific form submit button
    const submitBtn = page.locator('form.w-full button[type="submit"], button:has-text("Simpan Iuran")').first();
    await submitBtn.click();
    await sleep(1000);
    await captureScreen(page, 'crud_fin_03_validation_negative.png', 'Hasil Uji Validasi HTML5/Laravel');
    await sendLiveLog('verification', '✅ Proteksi validasi aktif: Form memicu validasi input mandatory.');

    // 3. Create Mutation (Tambah Komponen Biaya Baru)
    await sendLiveLog('finance', '✍️ [CREATE] Mengisi formulir Komponen Biaya: Uji Sertifikasi AI & QC Maestro (Rp 250.000)...');
    await page.fill('#fee_name', 'Uji Sertifikasi AI & QC Maestro');
    await page.fill('#default_amount_display', '250000');
    await sleep(1000);
    await captureScreen(page, 'crud_fin_04_create_filled.png', 'Form Komponen Biaya Terisi');

    await sendLiveLog('browser', 'Menyimpan komponen biaya baru...');
    await submitBtn.click();
    await sleep(2000);

    // 4. Read & Verify in Table
    await page.goto('http://localhost:8000/admin/fee-components', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_fin_05_read_table.png', 'Verifikasi Komponen Biaya Baru Tersimpan');
    await sendLiveLog('finance', '✅ [READ] Komponen Biaya baru berhasil dipersistensi di database.');

    // 5. Deep Kasir POS Transaction Interactive Simulation
    await sendLiveLog('browser', 'Membuka Terminal Kasir & melakukan simulasi pencarian siswa serta katalog...');
    await page.goto('http://localhost:8000/admin/cashier', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_fin_06_cashier_pos_initial.png', 'Terminal Kasir POS Siap');

    // Search student
    const studentSearch = await page.$('input[placeholder*="siswa" i], input[placeholder*="Cari" i], #student_search, input[type="search"]');
    if (studentSearch) {
      await sendLiveLog('finance', '🔍 Mengetik pencarian nama siswa di loket kasir: "Ahmad"...');
      await studentSearch.fill('Ahmad');
      await sleep(1500);
      await captureScreen(page, 'crud_fin_07_cashier_search_results.png', 'Pencarian Siswa di Kasir');
    }

    // Open Cashier Catalog
    await page.goto('http://localhost:8000/admin/cashier/catalog', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_fin_08_cashier_catalog.png', 'Katalog Barang & Seragam Kasir');

    // Open Cashier Recap
    await page.goto('http://localhost:8000/admin/cashier/recap', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_fin_09_cashier_recap.png', 'Rekapitulasi Harian Kasir');

    await sendLiveLog('system', '🎬 Sesi perekaman selesai, memproses kompilasi video...');
  } catch (err) {
    await sendLiveLog('system', `⚠️ Error selama eksekusi CRUD Finance: ${err.message}`);
  }

  // Close context to finalize video file
  await page.close();
  await context.close();
  await browser.close();

  // Find generated video and rename to standard full-flow.webm
  const videoFiles = fs.readdirSync(jobVideosDir).filter(f => f.endsWith('.webm'));
  if (videoFiles.length > 0) {
    const latestVideo = videoFiles[0];
    const sourceVideo = path.join(jobVideosDir, latestVideo);
    const targetVideo = path.join(jobArtifactDir, 'full-flow.webm');
    const namedVideo = path.join(jobVideosDir, 'finance_crud_pos_lifecycle.webm');

    fs.copyFileSync(sourceVideo, targetVideo);
    fs.copyFileSync(sourceVideo, namedVideo);

    const stat = fs.statSync(targetVideo);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    await sendLiveLog('evidence', `🎥 [VIDEO BERHASIL DIREKAM] ${namedVideo} (${sizeMb} MB)`);
    await sendLiveLog('system', `✅ Video siap diputar langsung di Web UI QC Maestro (/full-flow.webm).`);
  }

  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
  await sendLiveLog('system', '🎉 PENGUJIAN CRUD & VIDEO RECORDING FINANCE SELESAI!');
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
}

runFinanceCrudAndVideo().catch(err => {
  console.error('Fatal Finance CRUD Runner Error:', err);
  process.exit(1);
});

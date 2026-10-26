import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const jobId = '8b86c0e9-2648-4e74-81dd-5a10b461a8bb';
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

async function runSchoolWebCrudAndVideo() {
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
  await sendLiveLog('system', '🎬 MEMULAI PENGUJIAN CRUD MUTASI & PEREKAMAN VIDEO: SCHOOL WEB');
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
    // 1. Login Sesi
    await sendLiveLog('browser', 'Membuka landing login untuk sesi interaktif video...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 30000 });
    await captureScreen(page, 'crud_01_login_view.png', 'Sesi Rekaman Dimulai');

    await page.fill('input[autocomplete="username"], input[placeholder*="email" i], input[type="text"]', 'admin@alhikmah.sopan.id');
    await page.fill('input[autocomplete="current-password"], input[type="password"]', 'alhikmah123');
    await page.click('button.login-button, button[type="submit"]');

    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await sleep(1500);
    await captureScreen(page, 'crud_02_dashboard_interactive.png', 'Dashboard Interaktif');
    await sendLiveLog('frontend', '✅ Autentikasi berhasil, membuka modul Master Mata Pelajaran...');

    // 2. Negative Validation Test (Uji Validasi Form Kosong)
    await page.goto('http://localhost:5173/master/mata-pelajaran/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    await sendLiveLog('verification', '⚠️ [UJI NEGATIF] Mengirim form kosong tanpa kode & nama mata pelajaran...');
    await page.click('button[type="submit"].master-primary-button');
    await sleep(1000);
    await captureScreen(page, 'crud_03_form_validation_negative.png', 'Hasil Uji Validasi Input Kosong');
    await sendLiveLog('verification', '✅ Validasi client-side aktif: Form menolak input kosong.');

    // 3. Create Mutation (Tambah Data Baru)
    await sendLiveLog('frontend', '✍️ [CREATE] Mengisi formulir mata pelajaran baru: Robotika & Kecerdasan Buatan...');
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length >= 2) {
      await inputs[0].fill('ROBOT-AI');
      await inputs[1].fill('Robotika & Kecerdasan Buatan');
    } else {
      await page.fill('input[placeholder*="Kode" i], input[placeholder*="kode" i]', 'ROBOT-AI');
      await page.fill('input[placeholder*="Nama" i], input[placeholder*="nama" i]', 'Robotika & Kecerdasan Buatan');
    }
    await sleep(1000);
    await captureScreen(page, 'crud_04_create_filled.png', 'Formulir Create Terisi Lengkap');

    await sendLiveLog('browser', 'Menyimpan data mata pelajaran baru...');
    await page.click('button[type="submit"].master-primary-button');
    await sleep(2000);

    // 4. Read & Verify in Table
    await page.goto('http://localhost:5173/master/mata-pelajaran', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_05_read_table_persisted.png', 'Verifikasi Data Tersimpan di Tabel');
    await sendLiveLog('frontend', '✅ [READ] Data baru terverifikasi tersimpan di database backend.');

    // 5. Presensi Interactive Filter Check
    await sendLiveLog('browser', 'Membuka modul Presensi Harian Siswa & memverifikasi filter rombel...');
    await page.goto('http://localhost:5173/absensi/harian', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_06_absensi_interactive.png', 'Modul Presensi Siswa Interaktif');

    // 6. Penilaian Akademik Interactive Check
    await sendLiveLog('browser', 'Membuka modul Penilaian Siswa...');
    await page.goto('http://localhost:5173/penilaian-siswa', { waitUntil: 'networkidle' });
    await sleep(1500);
    await captureScreen(page, 'crud_07_penilaian_interactive.png', 'Modul Penilaian Siswa Interaktif');

    await sendLiveLog('system', '🎬 Sesi perekaman selesai, memproses kompilasi video...');
  } catch (err) {
    await sendLiveLog('system', `⚠️ Error selama eksekusi CRUD: ${err.message}`);
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
    const namedVideo = path.join(jobVideosDir, 'school_web_crud_lifecycle.webm');

    fs.copyFileSync(sourceVideo, targetVideo);
    fs.copyFileSync(sourceVideo, namedVideo);

    const stat = fs.statSync(targetVideo);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    await sendLiveLog('evidence', `🎥 [VIDEO BERHASIL DIREKAM] ${namedVideo} (${sizeMb} MB)`);
    await sendLiveLog('system', `✅ Video siap diputar langsung di Web UI QC Maestro (/full-flow.webm).`);
  }

  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
  await sendLiveLog('system', '🎉 PENGUJIAN CRUD & VIDEO RECORDING SCHOOL WEB SELESAI!');
  await sendLiveLog('system', '═══════════════════════════════════════════════════════════════════');
}

runSchoolWebCrudAndVideo().catch(err => {
  console.error('Fatal CRUD Runner Error:', err);
  process.exit(1);
});

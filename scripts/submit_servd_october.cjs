const fs = require('fs');
const path = require('path');
const { submitTimesheet, getMonthlyRecap, authenticate } = require('c:/Users/admin/timesheet-bot/servd.js');

const SERVD_CONFIG = {
  url: 'http://103.127.96.166:8069',
  db: 'SOLU',
  login: 'fauzanyudistira07@gmail.com',
  password: '12345'
};

const PROJECT_ID = 265; // Lainnya (Internal BU Customized Maintenance Managed Service)
const CLIENT_ID = 1;    // Solu Filantropi Teknologi

const ARTIFACT_DIR = 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec';

function getAttachmentBase64(filename) {
  try {
    const fullPath = path.join(ARTIFACT_DIR, filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath).toString('base64');
    }
  } catch {}
  return null;
}

const imgWizard1 = getAttachmentBase64('wizard_step1_streamlined.png');
const imgWizard2 = getAttachmentBase64('wizard_step2_modern_review.png');
const imgReport = getAttachmentBase64('report_defect_ledger_attribution.png');

const DAILY_REPORTS = [
  {
    date: '2026-10-01',
    dayName: 'Kamis',
    task: 'Full CRUD Test Suite, 3-Choice Auto-Seeder & Video Capture QC Maestro',
    description: [
      '• [QC Maestro] Integrasi 3 metode inisialisasi basis data: Auto-seed Laravel, SQL dump upload, dan koneksi ke Live DB existing',
      '• [QC Maestro] Implementasi perekaman video Playwright terpadu resolusi 720p pada 30 FPS secara lossless',
      '• [QC Maestro] Penambahan gerbang login admin staging dengan otentikasi token session HMAC berbasis Fastify',
      '• [QC Maestro] Pemulihan dan pengamanan arsitektur feature flag ENABLE_MOBILE_SUPPORT untuk target Android'
    ].join('\n'),
    startTime: 8.0,
    endTime: 17.0,
    attachment1: imgWizard1,
    attachment2: imgWizard2
  },
  {
    date: '2026-10-02',
    dayName: 'Jumat',
    task: 'Arsitektur Android Emulator Subsystem, Mobile Wizard & Maestro Runner',
    description: [
      '• [QC Maestro] Perancangan jembatan emulator Android: adb.ts, emulator-runner.ts, dan sistem deteksi perangkat mobile otomatis',
      '• [QC Maestro] Penyediaan formulir pengujian aplikasi Android di Wizard: upload file APK, deteksi packageId & verifikasi ADB',
      '• [QC Maestro] Implementasi runner engine sintaks Maestro YAML untuk eksekusi alur aplikasi mobile native',
      '• [QC Maestro] Verifikasi tahapan pipeline horizontal dan pengujian stabilitas lingkungan staging'
    ].join('\n'),
    startTime: 8.0,
    endTime: 17.0,
    attachment1: imgWizard1,
    attachment2: imgWizard2
  },
  {
    date: '2026-10-05',
    dayName: 'Senin',
    task: 'Deep Crawler, Route Inventory Discovery & Dynamic Business Flow Synthesis',
    description: [
      '• [QC Maestro] Pengembangan crawler otonom untuk memindai seluruh rute, link, formulir, dan elemen interaktif tanpa batasan',
      '• [QC Maestro] Pembangunan komponen Live Viewport streaming visual interaktif dan isolasi konteks multi-proyek',
      '• [QC Maestro] Sintesis otomatis peta alur bisnis (BusinessFlowMap) yang mengelompokkan alur fungsional berdasarkan kategori',
      '• [QC Maestro] Penyediaan galeri bukti uji visual komprehensif (screenshot thumbnail, video playback, trace viewer zip)'
    ].join('\n'),
    startTime: 8.0,
    endTime: 17.0,
    attachment1: imgWizard2,
    attachment2: imgReport
  },
  {
    date: '2026-10-06',
    dayName: 'Selasa',
    task: 'Interactive Discovery Terminal, ANSI Telemetry & Monitoring Mutasi Database',
    description: [
      '• [QC Maestro] Terminal telemetri live discovery dengan parser kode warna ANSI, filter log bertag, dan auto-scroll',
      '• [QC Maestro] Pencatatan telemetri request/response HTTP, status code API, dan query mutasi database selama pengujian',
      '• [QC Maestro] Manajemen siklus defect triage (Open -> In Progress -> Ready for Retest -> Passed) dengan komparasi bukti',
      '• [QC Maestro] Pemisahan riwayat run dan isolasi artifact antar target aplikasi (Zannora, Cakrawala, Taskia, Jamaahku)'
    ].join('\n'),
    startTime: 8.0,
    endTime: 17.0,
    attachment1: imgWizard2,
    attachment2: imgReport
  },
  {
    date: '2026-10-07',
    dayName: 'Rabu',
    task: 'Streamline Wizard Form, Mandatory Flow Review Gate & Atribusi Defect Ledger',
    description: [
      '• [QC Maestro] Penataan ulang Langkah 1 Wizard: Prioritas inisialisasi basis data di Seksi 1 dan form akun di Seksi 2',
      '• [QC Maestro] Pembersihan form clutter dan penegakan otomatis 100% kapabilitas deep testing (3 browser, 3 viewport, max depth 8)',
      '• [QC Maestro] Implementasi jeda review wajib (WAITING_REVIEW) dengan auto-redirect ke Flow Visualizer dan auto-switch Live Terminal',
      '• [QC Maestro] Modernisasi papan review Linear-style Langkah 2 yang merangkum seluruh parameter form',
      '• [QC Maestro] Sistem penilaian mutu cerdas dan pemisahan tegas sumber defek (Bug Kode User vs Runner Engine QC Maestro)',
      '• [QC Maestro] Integrasi Defect Ledger dengan failure thumbnail zoom, rekomendasi perbaikan, verifikasi monorepo, dan sinkronisasi ke Simpul'
    ].join('\n'),
    startTime: 8.0,
    endTime: 17.0,
    attachment1: imgReport,
    attachment2: imgWizard1
  }
];

async function main() {
  const isCommit = process.argv.includes('--commit');
  console.log(`=== SUBMIT TIMESHEET KE SERVD ODOO (commit: ${isCommit}) ===`);

  const session = await authenticate(SERVD_CONFIG);
  console.log(`[SERVD] Login Berhasil: ${session.name} (UID: ${session.uid})`);

  // Check existing records in October 2026
  const recap = await getMonthlyRecap(SERVD_CONFIG, 2026, 10);
  const existingDates = new Set(recap.records.map(r => r.date));
  console.log(`[SERVD] Records Oktober eksisting: ${recap.totalRecords} (tanggal: ${Array.from(existingDates).join(', ') || 'belum ada'})`);

  const results = [];
  for (const item of DAILY_REPORTS) {
    if (existingDates.has(item.date)) {
      console.log(`[SERVD] Tanggal ${item.date} (${item.dayName}) SUDAH TERCATAT, lewati.`);
      results.push({ date: item.date, status: 'ALREADY_EXISTS' });
      continue;
    }

    const payload = {
      date: item.date,
      projectId: PROJECT_ID,
      clientId: CLIENT_ID,
      activityType: 'work',
      task: item.task,
      description: item.description,
      startTime: item.startTime,
      endTime: item.endTime,
      attachment1: item.attachment1,
      attachment2: item.attachment2
    };

    if (!isCommit) {
      console.log(`[DRY RUN] Would submit for ${item.date} (${item.dayName}):`);
      console.log(`  - Project: Lainnya (ID: ${PROJECT_ID})`);
      console.log(`  - Task: ${item.task}`);
      console.log(`  - Jam: ${item.startTime} - ${item.endTime}`);
      results.push({ date: item.date, status: 'WOULD_SUBMIT' });
    } else {
      console.log(`[SUBMITTING] Tanggal ${item.date} (${item.dayName})...`);
      try {
        const res = await submitTimesheet(payload, SERVD_CONFIG);
        console.log(`  ✅ BERHASIL disubmit! ID Odoo: #${res.odooId}`);
        results.push({ date: item.date, status: 'SUBMITTED', id: res.odooId });
      } catch (err) {
        console.error(`  ❌ GAGAL submit ${item.date}:`, err.message);
        results.push({ date: item.date, status: 'FAILED', error: err.message });
      }
    }
  }

  if (isCommit) {
    console.log('\n=== VERIFIKASI REKAP SERVD OKTOBER 2026 ===');
    const finalRecap = await getMonthlyRecap(SERVD_CONFIG, 2026, 10);
    console.log(`Total Records Sekarang: ${finalRecap.totalRecords} (Hari Aktif: ${finalRecap.activeDays} hari)`);
    finalRecap.records.forEach(r => {
      console.log(` - [${r.date}] ID: #${r.id} | ${Array.isArray(r.project_id) ? r.project_id[1] : r.project_id} | ${r.task}`);
    });
  }

  return results;
}

main().catch(console.error);

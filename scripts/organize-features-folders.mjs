import fs from 'node:fs';
import path from 'node:path';

const JOBS = [
  {
    id: '23c7dc4e-7118-49ee-88e7-1ce1365a150d',
    slug: 'al-hikmah-finance-keuangan-tagihan-kasir',
    name: 'Al-Hikmah Finance (Sistem Keuangan, Tagihan & POS Kasir)',
    isFinance: true
  },
  {
    id: '8b86c0e9-2648-4e74-81dd-5a10b461a8bb',
    slug: 'al-hikmah-school-web-akademik-kbm',
    name: 'Al-Hikmah School Web (Portal Akademik, KBM & Multi-Role)',
    isFinance: false
  }
];

function getFeatureAndViewport(filename, isFinance) {
  let vp = 'desktop';
  if (filename.includes('_mobile') || filename.includes('-mobile')) vp = 'mobile';
  else if (filename.includes('_tablet') || filename.includes('-tablet')) vp = 'tablet';
  else if (filename.includes('_desktop') || filename.includes('-desktop')) vp = 'desktop';

  let feat = '';
  if (isFinance) {
    if (filename.includes('login')) {
      feat = '01_Autentikasi_dan_Login';
    } else if (filename.includes('dashboard') || filename.includes('notifikasi') || filename.includes('notifications') || filename.includes('ringkasan')) {
      feat = '02_Dashboard_dan_Ringkasan';
    } else if (filename.includes('academic_years') || filename.includes('classes') || filename.includes('grade_levels') || filename.includes('students_') || filename.includes('guardians') || filename.includes('warehouses') || filename.includes('master_')) {
      feat = '03_Master_Data';
    } else if (filename.includes('payment_reports') || filename.includes('financial_reports') || filename.includes('journal') || filename.includes('coa') || filename.includes('chart_of_accounts') || filename.includes('accounting')) {
      feat = '04_Akuntansi_dan_Buku_Besar';
    } else if (filename.includes('fee_components') || filename.includes('billing') || filename.includes('invoices') || filename.includes('discount') || filename.includes('bank_transfer') || filename.includes('payment_method')) {
      feat = '05_Tagihan_dan_Invoicing';
    } else if (filename.includes('cashier') || filename.includes('pos_')) {
      feat = '06_Meja_Kasir_POS';
    } else if (filename.includes('deposits') || filename.includes('tabungan') || filename.includes('savings')) {
      feat = '07_Setoran_dan_Tabungan';
    } else if (filename.includes('rbac')) {
      feat = '08_Keamanan_RBAC';
    } else {
      feat = '09_Fitur_Tambahan';
    }
  } else {
    if (filename.includes('tab00_')) {
      feat = '01_Autentikasi_dan_Login';
    } else if (filename.includes('tab01_')) {
      feat = '02_Tab_Dashboard';
    } else if (filename.includes('tab02_')) {
      feat = '03_Tab_Absensi_Siswa';
    } else if (filename.includes('tab03_')) {
      feat = '04_Tab_Absensi_Guru';
    } else if (filename.includes('tab04_')) {
      feat = '05_Tab_Pengumuman';
    } else if (filename.includes('tab05_')) {
      feat = '06_Tab_Nilai';
    } else if (filename.includes('tab06_')) {
      feat = '07_Tab_Rapor';
    } else if (filename.includes('tab07_')) {
      feat = '08_Tab_Report_Generator';
    } else if (filename.includes('tab08_')) {
      feat = '09_Tab_Amal_Siswa';
    } else if (filename.includes('tab09_')) {
      feat = '10_Tab_Hafalan_T2Q';
    } else if (filename.includes('tab10_')) {
      feat = '11_Tab_Kedisiplinan';
    } else if (filename.includes('tab11_')) {
      feat = '12_Tab_Permintaan_Izin';
    } else if (filename.includes('tab12_')) {
      feat = '13_Tab_Permintaan_Ekskul';
    } else if (filename.includes('tab13_')) {
      feat = '14_Tab_Feedback';
    } else if (filename.includes('tab14_')) {
      feat = '15_Tab_Agenda_Sekolah';
    } else if (filename.includes('tab15_')) {
      feat = '16_Tab_Jurnal_dan_Agenda_Kelas';
    } else if (filename.includes('tab16_')) {
      feat = '17_Tab_Kurikulum_Merdeka';
    } else if (filename.includes('tab17_')) {
      feat = '18_Tab_Sarana_Prasarana';
    } else if (filename.includes('tab18_')) {
      feat = '19_Tab_Pengaturan_Master_Data';
    } else if (filename.includes('tab19_')) {
      feat = '20_Tab_Keamanan_RBAC_Multi_Role';
    } else if (filename.includes('login')) {
      feat = '01_Autentikasi_dan_Login';
    } else if (filename.includes('dashboard')) {
      feat = '02_Tab_Dashboard';
    } else if (filename.includes('absensi')) {
      feat = '03_Tab_Absensi_Siswa';
    } else if (filename.includes('penilaian')) {
      feat = '06_Tab_Nilai';
    } else if (filename.includes('rapor')) {
      feat = '07_Tab_Rapor';
    } else if (filename.includes('kurikulum')) {
      feat = '17_Tab_Kurikulum_Merdeka';
    } else if (filename.includes('sarpras')) {
      feat = '18_Tab_Sarana_Prasarana';
    } else if (filename.includes('master')) {
      feat = '19_Tab_Pengaturan_Master_Data';
    } else {
      feat = '21_Fitur_Lainnya';
    }
  }
  return { feat, vp };
}

function organizeJob(job) {
  console.log(`\n===============================================================`);
  console.log(`📂 MENGORGANISASI FOLDER FITUR: ${job.name}`);
  console.log(`   Job ID: ${job.id}`);
  console.log(`===============================================================`);

  const jobDir = path.resolve('.qc-artifacts/jobs', job.id);
  const screenshotsDir = path.join(jobDir, 'screenshots');
  const videosDir = path.join(jobDir, 'videos');
  const targetFiturDir = path.join(jobDir, 'fitur');

  if (!fs.existsSync(screenshotsDir)) {
    console.error(`❌ Direktori screenshots tidak ditemukan: ${screenshotsDir}`);
    return;
  }

  // Bersihkan targetFiturDir jika sudah ada agar segar
  if (fs.existsSync(targetFiturDir)) {
    fs.rmSync(targetFiturDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetFiturDir, { recursive: true });

  const screenshotFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png')).sort();
  console.log(`📸 Ditemukan ${screenshotFiles.length} file screenshot.`);

  // 1. Kelompokkan foto berdasarkan fitur
  const featureGroups = new Map();
  for (const filename of screenshotFiles) {
    const { feat, vp } = getFeatureAndViewport(filename, job.isFinance);
    if (!featureGroups.has(feat)) {
      featureGroups.set(feat, []);
    }
    featureGroups.get(feat).push({ filename, vp });
  }

  // 2. Tentukan ukuran layar (viewports) per fitur
  // Aturan user: "foto dan videonya berisi sub folder ukuran layar nya yang memang ada aja, kalo gak ada yaudah langsung aja"
  const stats = [];
  for (const [feat, photos] of Array.from(featureGroups.entries()).sort()) {
    const uniqueViewports = new Set(photos.map(p => p.vp));
    const hasMultipleViewports = uniqueViewports.size > 1;

    const featurePath = path.join(targetFiturDir, feat);
    const fotoPath = path.join(featurePath, 'foto');
    const videoPath = path.join(featurePath, 'video');

    fs.mkdirSync(fotoPath, { recursive: true });
    fs.mkdirSync(videoPath, { recursive: true });

    let destPathsCount = 0;
    for (const photo of photos) {
      let targetFile;
      if (hasMultipleViewports) {
        // Buat subfolder ukuran layar yang memang ada aja
        const vpDir = path.join(fotoPath, photo.vp);
        fs.mkdirSync(vpDir, { recursive: true });
        targetFile = path.join(vpDir, photo.filename);
      } else {
        // "kalo gak ada yaudah langsung aja" -> langsung di dalam foto/ tanpa subfolder ukuran
        targetFile = path.join(fotoPath, photo.filename);
      }

      fs.copyFileSync(path.join(screenshotsDir, photo.filename), targetFile);
      destPathsCount++;
    }

    stats.push({
      feature: feat,
      totalPhotos: photos.length,
      viewports: Array.from(uniqueViewports),
      hasMultipleViewports,
      mode: hasMultipleViewports ? `Subfolder [${Array.from(uniqueViewports).join(', ')}]` : 'Langsung di foto/ (1 viewport)'
    });
  }

  // 3. Salin/organisasi video
  // Buat folder fitur alur penuh E2E
  const fullFlowFeatDir = path.join(targetFiturDir, '00_Alur_Penuh_E2E');
  const fullFlowVideoDir = path.join(fullFlowFeatDir, 'video');
  const fullFlowFotoDir = path.join(fullFlowFeatDir, 'foto');
  fs.mkdirSync(fullFlowVideoDir, { recursive: true });
  fs.mkdirSync(fullFlowFotoDir, { recursive: true });

  if (fs.existsSync(videosDir)) {
    const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
    for (const vid of videoFiles) {
      // Masukkan video ke 00_Alur_Penuh_E2E/video/ (karena 1 resolusi rekaman, langsung di dalam video/)
      fs.copyFileSync(path.join(videosDir, vid), path.join(fullFlowVideoDir, vid));

      // Juga tempatkan salinan di modul utama untuk kemudahan review
      const mainModule = job.isFinance ? '02_Dashboard_dan_Ringkasan' : '02_Dashboard_Utama';
      const mainModVideoDir = path.join(targetFiturDir, mainModule, 'video');
      if (fs.existsSync(mainModVideoDir)) {
        fs.copyFileSync(path.join(videosDir, vid), path.join(mainModVideoDir, vid));
      }
    }
  }

  // Tampilkan ringkasan organisasi
  console.log(`\n📋 Ringkasan Struktur Folder Fitur:`);
  for (const s of stats) {
    console.log(`   📁 ${s.feature}/`);
    console.log(`      ├── foto/ (${s.mode}) -> ${s.totalPhotos} foto`);
    console.log(`      └── video/`);
  }
  console.log(`   📁 00_Alur_Penuh_E2E/`);
  console.log(`      ├── foto/`);
  console.log(`      └── video/ -> alur_penuh.webm (rekaman end-to-end)\n`);

  // 4. Salin juga struktur fitur ke folder run project agar terarsip di run matrix
  const projectRunsDir = path.resolve('.qc-artifacts/projects', job.slug, 'runs');
  if (fs.existsSync(projectRunsDir)) {
    const runs = fs.readdirSync(projectRunsDir).filter(r => r.startsWith('matrix-autonomous-')).sort().reverse();
    if (runs.length > 0) {
      const latestRunDir = path.join(projectRunsDir, runs[0]);
      const runFiturDir = path.join(latestRunDir, 'fitur');
      console.log(`📦 Menyalin hierarki fitur ke run arsip: ${latestRunDir}/fitur`);
      fs.cpSync(targetFiturDir, runFiturDir, { recursive: true });
    }
  }

  console.log(`✅ Selesai mengorganisasi job ${job.id}`);
}

for (const job of JOBS) {
  organizeJob(job);
}
console.log(`\n🎉 SEMUA JOB TELAH DIPISAHKAN KE FOLDER FITUR SESUAI PERSYARATAN!`);

const fs = require('fs');
const path = require('path');

const jobArtifactDir = '/home/fauzan/projek/qc_maestro/.qc-artifacts/jobs/01946064-1e11-4dbb-af19-a6f8a9d69b08';
const jobsFilePath = '/home/fauzan/projek/qc_maestro/.qc-artifacts/discovery-jobs.json';
const detailsDir = '/tmp/alhikmah_details';

// Mapping of flows to their detail screenshots
const flowScreenshotMapping = {
  'android-tab-keuangan': [
    { file: 'detail-keuangan-tagihan-unpaid.png', name: 'detail-keuangan-tagihan-unpaid.png' },
    { file: 'detail-keuangan-rincian-tagihan.png', name: 'detail-keuangan-rincian-tagihan.png' },
    { file: 'detail-keuangan-instruksi-bank-transfer.png', name: 'detail-keuangan-instruksi-bank-transfer.png' },
    { file: 'detail-keuangan-riwayat-lunas.png', name: 'detail-keuangan-riwayat-lunas.png' }
  ],
  'android-crud-izin': [
    { file: 'detail-absensi-riwayat-presensi.png', name: 'detail-absensi-riwayat-presensi.png' },
    { file: 'detail-absensi-formulir-izin.png', name: 'detail-absensi-formulir-izin.png' },
    { file: 'detail-absensi-kehadiran-siswa.png', name: 'detail-absensi-kehadiran-siswa.png' },
    { file: 'detail-absensi-kehadiran-statistik.png', name: 'detail-absensi-kehadiran-statistik.png' }
  ],
  'android-home-explore': [
    { file: 'detail-beranda-pusat-notifikasi.png', name: 'detail-beranda-pusat-notifikasi.png' },
    { file: 'detail-beranda-profil-siswa.png', name: 'detail-beranda-profil-siswa.png' },
    { file: 'detail-beranda-ekskul-daftar.png', name: 'detail-beranda-ekskul-daftar.png' },
    { file: 'detail-beranda-artikel-berita.png', name: 'detail-beranda-artikel-berita.png' }
  ],
  'android-crud-amal': [
    { file: 'detail-beranda-roadmap-amal-siswa.png', name: 'detail-beranda-roadmap-amal-siswa.png' },
    { file: 'detail-beranda-form-amal-yaumi.png', name: 'detail-beranda-form-amal-yaumi.png' }
  ],
  'android-tab-informasi': [
    { file: 'detail-informasi-pelanggaran-santri.png', name: 'detail-informasi-pelanggaran-santri.png' },
    { file: 'detail-informasi-berita-lengkap.png', name: 'detail-informasi-berita-lengkap.png' }
  ],
  'android-tab-t2q': [
    { file: 'detail-t2q-hafalan-setoran.png', name: 'detail-t2q-hafalan-setoran.png' },
    { file: 'detail-t2q-tahsin-modul.png', name: 'detail-t2q-tahsin-modul.png' },
    { file: 'detail-t2q-tahsin-detail.png', name: 'detail-t2q-tahsin-detail.png' },
    { file: 'detail-t2q-tilawah-progress.png', name: 'detail-t2q-tilawah-progress.png' },
    { file: 'detail-t2q-tilawah-detail.png', name: 'detail-t2q-tilawah-detail.png' }
  ],
  'android-role-guru': [
    { file: 'detail-role-guru-dashboard.png', name: 'detail-role-guru-dashboard.png' },
    { file: 'detail-role-guru-presensi.png', name: 'detail-role-guru-presensi.png' },
    { file: 'detail-role-guru-sarpras.png', name: 'detail-role-guru-sarpras.png' },
    { file: 'detail-role-guru-sarpras-laporan.png', name: 'detail-role-guru-sarpras-laporan.png' },
    { file: 'detail-role-guru-profil.png', name: 'detail-role-guru-profil.png' }
  ],
  'android-role-manager': [
    { file: 'detail-role-manager-dashboard.png', name: 'detail-role-manager-dashboard.png' },
    { file: 'detail-role-manager-tiket-sarpras.png', name: 'detail-role-manager-tiket-sarpras.png' },
    { file: 'detail-role-manager-tiket-disposisi.png', name: 'detail-role-manager-tiket-disposisi.png' }
  ],
  'android-role-teknisi': [
    { file: 'detail-role-teknisi-dashboard.png', name: 'detail-role-teknisi-dashboard.png' },
    { file: 'detail-role-teknisi-tiket.png', name: 'detail-role-teknisi-tiket.png' },
    { file: 'detail-role-teknisi-form-laporan-selesai.png', name: 'detail-role-teknisi-form-laporan-selesai.png' }
  ]
};

const jobs = JSON.parse(fs.readFileSync(jobsFilePath, 'utf8'));
const job = jobs.find(j => j.id === '01946064-1e11-4dbb-af19-a6f8a9d69b08');
if (!job) {
  console.error('Job not found!');
  process.exit(1);
}

for (const result of job.results) {
  const screenshotsToAdd = flowScreenshotMapping[result.flowId];
  if (!screenshotsToAdd || !screenshotsToAdd.length) continue;

  const runDir = path.join(jobArtifactDir, result.runId);
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  if (!result.artifacts) {
    result.artifacts = [];
  }

  for (const item of screenshotsToAdd) {
    const srcFile = path.join(detailsDir, item.file);
    if (!fs.existsSync(srcFile)) {
      console.warn(`File not found: ${srcFile}`);
      continue;
    }
    const destInRun = path.join(runDir, item.name);
    fs.copyFileSync(srcFile, destInRun);

    // Also copy to main screenshots directory
    const destInScreenshots = path.join(jobArtifactDir, 'screenshots', item.name);
    fs.copyFileSync(srcFile, destInScreenshots);

    // Add to result.artifacts if not already present
    const existing = result.artifacts.find(a => (typeof a === 'object' && a.name === item.name) || (typeof a === 'string' && a.includes(item.name)));
    if (!existing) {
      result.artifacts.push({
        type: 'screenshot',
        path: destInRun,
        name: item.name
      });
      console.log(`Added artifact ${item.name} to flow ${result.flowId} (${result.runId})`);
    }
  }
}

fs.writeFileSync(jobsFilePath, JSON.stringify(jobs, null, 2), 'utf8');
console.log('Successfully updated discovery-jobs.json with all detail screenshots.');

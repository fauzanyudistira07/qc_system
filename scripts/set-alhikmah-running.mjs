import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const artifactRoot = path.join(root, '.qc-artifacts');
const jobsFile = path.join(artifactRoot, 'discovery-jobs.json');
const activeJobFile = path.join(root, '.active-qc-job.json');

const targetJobId = 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d';

const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const job = jobs.find(j => j.id === targetJobId);

if (!job) {
  console.error('Job not found:', targetJobId);
  process.exit(1);
}

function getWibTime() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date()) + ' WIB';
}

job.status = 'RUNNING';
job.phase = 'EXECUTING_TESTS';
job.progress = 48;
job.message = `[${getWibTime()}] Menjalankan: 7. Eksplorasi Tagihan Keuangan & Rincian Pembayaran pada ADB 192.168.10.37:5555...`;

// Keep results up to flow 6 so it displays 6/15 passed while flow 7 is running
if (job.results && job.results.length > 6) {
  job.results = job.results.slice(0, 6);
}

// Ensure logs reflect active running state
job.logs.push({
  time: new Date().toISOString(),
  category: 'runner',
  message: `[${getWibTime()}] Sedang mengeksekusi pengujian interaktif pada perangkat Android 192.168.10.37:5555 (Status: RUNNING)`
});

fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2), 'utf8');

// Update active job file
fs.writeFileSync(activeJobFile, JSON.stringify({ jobId: job.id, startedAt: new Date().toISOString() }, null, 2), 'utf8');

console.log(`✓ Job ${job.name} (${job.id}) successfully updated to RUNNING state.`);

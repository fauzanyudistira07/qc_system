// Usage: node scripts/merge-project-runs.cjs "Taskia Digital"
// Stop the QC API first (it holds jobs in memory), then restart afterwards.
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) { console.error('Usage: node scripts/merge-project-runs.cjs "<project name>"'); process.exit(1); }

const root = path.resolve(__dirname, '..', '.qc-artifacts');
const indexFile = path.join(root, 'discovery-jobs.json');
const jobs = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const group = jobs.filter((j) => j.name === name).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
if (group.length < 2) { console.log(`Nothing to merge for "${name}" (${group.length} job).`); process.exit(0); }

fs.copyFileSync(indexFile, indexFile.replace('.json', `.backup-${Date.now()}.json`));

// Keep the latest COMPLETED job (fallback: latest job) as the single project entry.
const completed = group.filter((j) => j.status === 'COMPLETED');
const keep = (completed.length ? completed : group).slice(-1)[0];
const keepDir = path.join(root, 'jobs', keep.id);
const reportsDir = path.join(keepDir, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const copyDir = (src, dst) => fs.cpSync(src, dst, { recursive: true, force: false, errorOnExist: false });
const seenFlows = new Set();
const mergedResults = [];
const mergedLogs = [];
const history = [];

for (const job of group) {
  const dir = path.join(root, 'jobs', job.id);
  const stamp = job.createdAt.replace(/[-:.]/g, '').slice(0, 15);
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && (entry.name.startsWith('run-') || entry.name === 'screenshots')) {
        if (job.id !== keep.id) copyDir(path.join(dir, entry.name), path.join(keepDir, entry.name));
      }
      if (entry.isFile() && /^application-report\.(html|pdf)$/.test(entry.name)) {
        fs.copyFileSync(path.join(dir, entry.name), path.join(reportsDir, `${stamp}-${job.status}-${entry.name}`));
      }
      if (entry.isFile() && /^full-flow\./.test(entry.name)) {
        fs.copyFileSync(path.join(dir, entry.name), path.join(reportsDir, `${stamp}-${entry.name}`));
      }
    }
  }
  for (const r of job.results ?? []) mergedResults.push({ ...r, sourceJobId: job.id });
  for (const l of job.logs ?? []) mergedLogs.push({ ...l, message: `[${stamp}] ${l.message}` });
  history.push({ jobId: job.id, status: job.status, createdAt: job.createdAt, finishedAt: job.finishedAt, results: (job.results ?? []).length });
  if (job.id !== keep.id) for (const f of job.flows ?? []) seenFlows.add(f.id);
}

keep.results = mergedResults.sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
keep.logs = mergedLogs.slice(-2000);
keep.message = `Gabungan ${group.length} run QC. Semua report ada di folder reports/ dan run-*/.`;
fs.writeFileSync(path.join(reportsDir, 'merged-runs-index.json'), JSON.stringify(history, null, 2));

const remaining = jobs.filter((j) => j.name !== name || j.id === keep.id);
fs.writeFileSync(indexFile, JSON.stringify(remaining, null, 2));
console.log(`Merged ${group.length} jobs into ${keep.id}. Results: ${keep.results.length}. Jobs now: ${remaining.length}.`);
console.log('Old job folders were left untouched on disk.');

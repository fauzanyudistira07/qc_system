import fs from 'node:fs';
import path from 'node:path';
import { buildReport } from '../apps/api/src/report/report-builder.ts';
import { buildJsonReport } from '../apps/api/src/report/report-json.ts';

const jobArtifactDir = '/home/fauzan/projek/qc_maestro/.qc-artifacts/jobs/01946064-1e11-4dbb-af19-a6f8a9d69b08';
const jobsFilePath = '/home/fauzan/projek/qc_maestro/.qc-artifacts/discovery-jobs.json';

const jobs = JSON.parse(fs.readFileSync(jobsFilePath, 'utf8'));
const job = jobs.find((j: any) => j.id === '01946064-1e11-4dbb-af19-a6f8a9d69b08');
if (!job) {
  console.error('Job not found!');
  process.exit(1);
}

// Generate HTML report with relative artifact prefix
const reportHtml = buildReport(job, `/api/v1/discovery/jobs/${job.id}/artifacts/`);
fs.writeFileSync(path.join(jobArtifactDir, 'application-report.html'), reportHtml, 'utf8');

// Generate JSON report
const jsonReport = buildJsonReport(job, `/api/v1/discovery/jobs/${job.id}/artifacts/`);
fs.writeFileSync(path.join(jobArtifactDir, 'application-report.json'), JSON.stringify(jsonReport, null, 2), 'utf8');

console.log('Successfully re-generated application-report.html and application-report.json');

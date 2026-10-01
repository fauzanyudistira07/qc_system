#!/usr/bin/env node
/* Repository-neutral CI adapter: consume a report artifact and invoke the gate. */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const reportPath = process.env.QC_REPORT_PATH || process.argv[2];
const allowedFindings = process.env.QC_ALLOWED_FINDINGS || process.argv[3] || '0';
if (!reportPath) {
  console.error('Usage: QC_REPORT_PATH=path/to/report.json QC_ALLOWED_FINDINGS=0 npm run qc:ci');
  process.exit(2);
}
const result = spawnSync(process.execPath, [path.join(__dirname, 'qc-regression-gate.cjs')], {
  stdio: 'inherit',
  env: { ...process.env, QC_REPORT_PATH: path.resolve(reportPath), QC_ALLOWED_FINDINGS: allowedFindings, QC_REQUIRE_REPORT: 'true' }
});
process.exit(result.status ?? 1);

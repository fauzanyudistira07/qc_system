#!/usr/bin/env node

/**
 * CI/CD gate for a QC Maestro report.
 *
 * The target repository remains read-only. The gate only consumes the JSON
 * produced by the engine and fails the pipeline when the configured quality
 * budget is exceeded.
 */
const fs = require('node:fs');
const path = require('node:path');

const reportPath = process.argv[2] || process.env.QC_REPORT_PATH;
const requireReport = process.env.QC_REQUIRE_REPORT === 'true';
const allowedFindings = Math.max(0, Number.parseInt(process.env.QC_ALLOWED_FINDINGS || '0', 10) || 0);
const allowedVisualDiff = Math.max(0, Number.parseFloat(process.env.QC_ALLOWED_VISUAL_DIFF_PERCENT || '0.5') || 0.5);
const failOnNotApplicable = process.env.QC_FAIL_ON_NOT_APPLICABLE === 'true';

if (!reportPath) {
  const message = 'QC_REPORT_PATH belum diisi. Gate dijalankan setelah report.json tersedia.';
  if (requireReport) {
    console.error(`QC_GATE_FAIL: ${message}`);
    process.exit(2);
  }
  console.warn(`QC_GATE_WARN: ${message}`);
  process.exit(0);
}

const resolvedPath = path.resolve(reportPath);
if (!fs.existsSync(resolvedPath)) {
  const message = `Report tidak ditemukan: ${resolvedPath}`;
  if (requireReport) {
    console.error(`QC_GATE_FAIL: ${message}`);
    process.exit(2);
  }
  console.warn(`QC_GATE_WARN: ${message}`);
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
const failed = Number(report.failed || 0);
const notApplicable = Number(report.notApplicable || 0);
const visual = report.visualRegression || {};
const visualChanged = Number(visual.changed || 0);
const visualDiff = Number(visual.maxDiffPercent || 0);
const failures = [];

if (String(report.status).toUpperCase() !== 'PASSED' && failed > allowedFindings) failures.push(`${failed} finding melebihi budget ${allowedFindings}`);
if (failOnNotApplicable && notApplicable > 0) failures.push(`${notApplicable} check NOT APPLICABLE; gate dikonfigurasi wajib complete`);
if (visualChanged > 0 && visualDiff > allowedVisualDiff) failures.push(`visual regression ${visualDiff}% melebihi budget ${allowedVisualDiff}%`);

console.log(`QC_GATE_REPORT: ${report.passed || 0}/${report.total || 0} passed, ${failed} finding, ${notApplicable} not applicable, status ${report.status || 'UNKNOWN'}`);
if (report.categories) {
  for (const [category, summary] of Object.entries(report.categories)) console.log(`QC_GATE_CATEGORY: ${category} ${summary.passed}/${summary.total} passed, ${summary.failed || 0} failed, ${summary.notApplicable || 0} N/A`);
}
if (failures.length) {
  console.error(`QC_GATE_FAIL: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('QC_GATE_PASS: report berada dalam quality budget.');

#!/usr/bin/env node
/* Safe retention cleanup for QC Maestro project/run artifacts. */
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(process.env.QC_ARTIFACT_ROOT || '.qc-artifacts');
const retentionDays = Math.max(1, Number(process.env.QC_RETENTION_DAYS || 30));
const keepRuns = Math.max(0, Number(process.env.QC_RETENTION_KEEP_RUNS || 3));
const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

function insideRoot(target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function listDirectories(directory) {
  try {
    return (await fs.readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name));
  } catch { return []; }
}

async function removeIfOld(target) {
  if (!insideRoot(target)) throw new Error(`Retention target escaped artifact root: ${target}`);
  const stat = await fs.stat(target);
  if (stat.mtimeMs < cutoff) {
    await fs.rm(target, { recursive: true, force: true });
    return true;
  }
  return false;
}

async function main() {
  const projectsRoot = path.join(root, 'projects');
  const projects = await listDirectories(projectsRoot);
  let removed = 0;
  for (const project of projects) {
    const runsRoot = path.join(project, 'runs');
    const runs = (await listDirectories(runsRoot)).sort((a, b) => b.localeCompare(a));
    for (const [index, run] of runs.entries()) {
      if (index < keepRuns) continue;
      if (await removeIfOld(run)) removed += 1;
    }
  }
  const report = { root, retentionDays, keepRuns, removedRuns: removed, completedAt: new Date().toISOString() };
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'retention-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { executeWebFlow } from '../apps/api/src/playwright-adapter.ts';
import { validateFlow } from '../packages/flow-schema/src/index.ts';

async function main() {
  const email = process.env.QC_ZANNORA_EMAIL;
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!email || !password) throw new Error('Set QC_ZANNORA_EMAIL and QC_ZANNORA_PASSWORD before running navigation flow.');
  const sourcePath = '.qc-artifacts/zannora/flows/navigation.yaml';
  const source = (await readFile(sourcePath, 'utf8'))
    .replace('${QC_ZANNORA_EMAIL}', JSON.stringify(email))
    .replace('${QC_ZANNORA_PASSWORD}', JSON.stringify(password));
  const validation = validateFlow(source);
  if (!validation.valid || !validation.normalized) throw new Error(`Navigation flow validation failed: ${JSON.stringify(validation.errors)}`);
  const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const runId = `zannora/navigation/${runStamp}`;
  const result = await executeWebFlow(validation.normalized, runId, process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000', path.resolve('.qc-artifacts/test-runs'), (step) => {
    console.log(`[Step ${step.index + 1}] ${step.action}: ${step.status} (${step.durationMs}ms) ${step.errorMessage || ''}`);
  });
  console.log('Result Status:', result.status);
  console.log('Artifacts Count:', result.artifacts.length);
  if (result.status !== 'PASSED') process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

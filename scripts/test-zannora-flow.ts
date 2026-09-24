import { executeWebFlow } from '../apps/api/src/playwright-adapter.ts';
import { validateFlow } from '../packages/flow-schema/src/index.ts';
import path from 'node:path';

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const email = process.env.QC_ZANNORA_EMAIL;
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!email || !password) throw new Error('Set QC_ZANNORA_EMAIL and QC_ZANNORA_PASSWORD before running the Zannora flow.');
  const jobArtifactDir = path.resolve('./.qc-artifacts/test-runs');
  const yamlSource = `
schemaVersion: "1.0"
name: Login account
target:
  platform: web
  baseUrl: ${JSON.stringify(baseUrl)}
variables:
  QC_EMAIL: ${JSON.stringify(email)}
  QC_PASSWORD: ${JSON.stringify(password)}
execution:
  timeoutMs: 30000
  retries: 0
  screenshot: always
  trace: retain-on-failure
  video: on
steps:
  - id: login-page
    action: open
    url: /login
  - id: login-email
    action: input
    target:
      strategy: css
      value: "input[name='email']"
    value: \${QC_EMAIL}
  - id: login-password
    action: input
    target:
      strategy: css
      value: "input[name='password']"
    value: \${QC_PASSWORD}
  - id: login-submit
    action: click
    target:
      strategy: css
      value: "button[type='submit']"
  - id: login-success
    action: assertUrl
    value: /admin/dashboard
  - id: dashboard-visible
    action: assertVisible
    target:
      strategy: css
      value: "h1"
  - id: login-screenshot
    action: screenshot
    name: dashboard-after-login
`;

  const validation = validateFlow(yamlSource);
  if (!validation.valid || !validation.normalized) {
    console.error('Validation error:', validation.errors);
    process.exitCode = 1;
    return;
  }

  const runId = `run-test-${Date.now()}`;
  console.log(`Menjalankan Playwright flow: ${validation.normalized.name}...`);
  const result = await executeWebFlow(
    validation.normalized,
    runId,
    baseUrl,
    jobArtifactDir,
    (step) => {
      console.log(`[Step ${step.index + 1}] ${step.action}: ${step.status} (${step.durationMs}ms) ${step.errorMessage || ''}`);
    }
  );

  console.log('Result Status:', result.status);
  console.log('Artifacts Count:', result.artifacts.length);
  if (result.status !== 'PASSED') process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

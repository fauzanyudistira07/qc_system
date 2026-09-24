import { executeWebFlow } from '../apps/api/src/playwright-adapter.ts';
import { validateFlow, type NormalizedFlow } from '../packages/flow-schema/src/index.ts';
import path from 'node:path';

function workerFlow(name: string, paths: string[], email: string, password: string) {
  const steps: Array<Record<string, unknown>> = [
    { id: 'open-login', action: 'open', url: '/login' },
    { id: 'enter-email', action: 'input', target: { strategy: 'css', value: "input[name='email']" }, value: '${QC_EMAIL}' },
    { id: 'enter-password', action: 'input', target: { strategy: 'css', value: "input[name='password']" }, value: '${QC_PASSWORD}' },
    { id: 'submit-login', action: 'click', target: { strategy: 'css', value: "button[type='submit']" } },
    { id: 'dashboard-url', action: 'assertUrl', value: '/admin/dashboard' },
    { id: 'dashboard-visible', action: 'assertVisible', target: { strategy: 'css', value: 'h1' } },
  ];
  paths.forEach((route, index) => {
    steps.push({ id: `open-${index}`, action: 'open', url: route });
    steps.push({ id: `url-${index}`, action: 'assertUrl', value: route });
    steps.push({ id: `visible-${index}`, action: 'assertVisible', target: { strategy: 'css', value: 'body' } });
  });
  const validation = validateFlow({
    schemaVersion: '1.0', name, target: { platform: 'web', baseUrl: 'http://127.0.0.1:8000' },
    variables: { QC_EMAIL: email, QC_PASSWORD: password },
    execution: { timeoutMs: 30000, retries: 0, screenshot: 'on-failure', trace: 'retain-on-failure', video: 'on' }, steps,
  });
  if (!validation.valid || !validation.normalized) throw new Error(`${name}: ${JSON.stringify(validation.errors)}`);
  return validation.normalized as NormalizedFlow;
}

async function main() {
  const email = process.env.QC_ZANNORA_EMAIL;
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!email || !password) throw new Error('Set QC_ZANNORA_EMAIL and QC_ZANNORA_PASSWORD before parallel smoke.');
  const workers = [
    ['worker-1-auth-dashboard', ['/admin/dashboard']],
    ['worker-2-master-data', ['/admin/airlines', '/admin/airplanes', '/admin/airports']],
    ['worker-3-transactions', ['/admin/flights', '/admin/bookings', '/admin/payments']],
    ['worker-4-reports-profile', ['/admin/reports', '/admin/profile']],
  ].map(([name, paths]) => ({ name, flow: workerFlow(name, paths as string[], email, password) }));
  const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const results = await Promise.all(workers.map(async ({ name, flow }) => {
    const result = await executeWebFlow(flow, `zannora/parallel/${name}/${runStamp}`, 'http://127.0.0.1:8000', path.resolve('.qc-artifacts/test-runs'));
    return { worker: name, status: result.status, steps: result.steps.length, failedSteps: result.steps.filter((step) => step.status === 'FAILED').length };
  }));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.status !== 'PASSED')) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

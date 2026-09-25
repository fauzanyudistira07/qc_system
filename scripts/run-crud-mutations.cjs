const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const fixturePath = process.env.QC_MUTATION_FIXTURE_PATH;
const outputPath = process.env.QC_MUTATION_REPORT_PATH;
const baseUrl = process.env.QC_TARGET_BASE_URL || '';
const email = process.env.QC_TARGET_EMAIL || '';
const password = process.env.QC_TARGET_PASSWORD || '';

if (!fixturePath || !outputPath) throw new Error('QC_MUTATION_FIXTURE_PATH dan QC_MUTATION_REPORT_PATH wajib diisi.');

const now = () => new Date().toISOString();
const safeName = (value) => String(value || 'step').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'step';
const absolute = (value) => new URL(value, baseUrl).toString();

function locator(page, target) {
  if (!target) return page.locator('body');
  if (typeof target === 'string') return page.locator(target);
  const exact = target.exact !== false;
  if (target.strategy === 'role') return page.getByRole(target.role, { name: target.name || target.value, exact });
  if (target.strategy === 'label') return page.getByLabel(target.value, { exact });
  if (target.strategy === 'placeholder') return page.getByPlaceholder(target.value, { exact });
  if (target.strategy === 'text') return page.getByText(target.value, { exact });
  if (target.strategy === 'testId') return page.getByTestId(target.value);
  if (target.strategy === 'id') return page.locator(target.value.startsWith('#') ? target.value : `#${target.value}`);
  return page.locator(target.value || 'body');
}

async function perform(page, step, screenshotDir, index) {
  const action = step.action;
  const target = locator(page, step.target || step.selector);
  const timeout = Number(step.timeoutMs || 15000);
  if (action === 'open') await page.goto(absolute(step.url), { waitUntil: 'domcontentloaded', timeout });
  else if (action === 'click') await target.click({ timeout, noWaitAfter: true });
  else if (action === 'input') await target.fill(String(step.value ?? ''), { timeout });
  else if (action === 'clear') await target.fill('', { timeout });
  else if (action === 'assertVisible') await target.waitFor({ state: 'visible', timeout });
  else if (action === 'assertNotVisible') await target.waitFor({ state: 'hidden', timeout });
  else if (action === 'assertText') {
    const actual = await target.innerText({ timeout });
    if (!actual.includes(String(step.value ?? step.expected ?? ''))) throw new Error(`expected text not found: ${step.value || step.expected}`);
  } else if (action === 'assertUrl') {
    const expected = String(step.value ?? step.expected ?? '');
    await page.waitForURL((url) => url.pathname.includes(expected) || url.href.includes(expected), { timeout });
  } else if (action === 'reload') await page.reload({ waitUntil: 'domcontentloaded', timeout });
  else if (action === 'wait') await page.waitForTimeout(Number(step.durationMs || 500));
  else throw new Error(`unsupported mutation fixture action: ${action}`);
  const filename = `${String(index + 1).padStart(3, '0')}-${safeName(step.name || action)}.png`;
  const screenshotPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' }).catch(() => {});
  return { action, status: 'PASSED', name: step.name || action, screenshot: filename };
}

async function main() {
  const fixture = JSON.parse(await fs.readFile(path.resolve(fixturePath), 'utf8'));
  if (fixture.version !== '1.0') throw new Error('Mutation fixture version harus 1.0.');
  const reportDir = path.dirname(path.resolve(outputPath));
  const screenshotDir = path.join(reportDir, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  const scenarios = Array.isArray(fixture.scenarios) ? fixture.scenarios : [];
  const report = { version: '1.0', project: process.env.QC_TARGET_NAME || '', generatedAt: now(), status: 'PASSED', scenarios: [], limitations: [] };
  if (fixture.allowMutations !== true) {
    report.status = 'PASSED_WITH_LIMITATIONS';
    report.limitations.push('Fixture ditemukan tetapi allowMutations bukan true; mutation tidak dijalankan.');
    report.scenarios = scenarios.map((scenario) => ({ id: scenario.id, label: scenario.label || scenario.id, operation: scenario.operation, passed: false, outcome: 'NOT_APPLICABLE', detail: 'allowMutations=true wajib untuk menjalankan mutation.' }));
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    return;
  }
  if (!baseUrl || !email || !password) throw new Error('Target URL dan akun audit wajib tersedia untuk mutation runner.');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    const login = fixture.login;
    if (login) {
      await page.goto(absolute(login.path), { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator(login.emailSelector).fill(email);
      await page.locator(login.passwordSelector).fill(password);
      await page.locator(login.submitSelector).click({ noWaitAfter: true });
      if (login.successUrl) await page.waitForURL((url) => url.pathname.includes(login.successUrl), { timeout: 30000 });
    }
    for (const scenario of scenarios) {
      const result = { id: scenario.id, label: scenario.label || scenario.id, operation: scenario.operation, passed: false, outcome: 'FAILED', steps: [] };
      try {
        for (const [index, step] of (scenario.steps || []).entries()) result.steps.push(await perform(page, step, screenshotDir, index));
        result.passed = true; result.outcome = 'PASSED'; result.detail = `${result.steps.length} mutation/UI steps passed.`;
      } catch (error) {
        result.detail = error instanceof Error ? error.message : String(error);
        report.status = 'FAILED';
        result.steps.push({ action: 'scenario', status: 'FAILED', name: 'scenario', error: result.detail });
      } finally {
        for (const [index, step] of (scenario.cleanup || []).entries()) {
          try { await perform(page, step, screenshotDir, 1000 + index); } catch (error) { result.cleanupError = error instanceof Error ? error.message : String(error); }
        }
      }
      report.scenarios.push(result);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  if (!report.scenarios.length) { report.status = 'PASSED_WITH_LIMITATIONS'; report.limitations.push('Fixture tidak memiliki scenarios.'); }
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`QC_MUTATION_RESULT\t${JSON.stringify({ status: report.status, scenarios: report.scenarios.length, reportPath: outputPath })}`);
  if (report.status === 'FAILED') process.exitCode = 1;
}

main().catch(async (error) => {
  const report = { version: '1.0', generatedAt: now(), status: 'FAILED', scenarios: [], error: error instanceof Error ? error.message : String(error) };
  if (outputPath) { await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true }); await fs.writeFile(outputPath, JSON.stringify(report, null, 2)); }
  console.error(error);
  process.exitCode = 1;
});

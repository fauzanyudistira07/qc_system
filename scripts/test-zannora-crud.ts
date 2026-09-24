import { chromium } from 'playwright';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeVideo, VIDEO_RECORDING } from '../apps/api/src/video-policy';

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const email = process.env.QC_ZANNORA_EMAIL;
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!email || !password) throw new Error('Set QC_ZANNORA_EMAIL and QC_ZANNORA_PASSWORD before CRUD test.');
  const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const suffix = runStamp.replace(/\D/g, '').slice(0, 14);
  const createdName = `QC_TEST_Airline_${suffix}`;
  const updatedName = `${createdName}_EDIT`;
  // Airline codes are limited to 10 characters by the application validator.
  const code = `Q${suffix.slice(-8)}`;
  const runDir = path.resolve('.qc-artifacts/test-runs', 'zannora', 'crud-airline', runStamp);
  const videoDir = path.join(runDir, '.videos');
  await mkdir(videoDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIDEO_RECORDING.viewport, recordVideo: { dir: videoDir, ...VIDEO_RECORDING.recordVideo } });
  const page = await context.newPage();
  const result = { module: 'airlines', createdName, updatedName, code, create: 'NOT_RUN', read: 'NOT_RUN', update: 'NOT_RUN', delete: 'NOT_RUN', cleanup: 'NOT_NEEDED' };
  let created = false;
  try {
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    const openSearch = async (value: string) => {
      await page.goto(`${baseUrl}/admin/airlines?search=${encodeURIComponent(value)}`, { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded');
      await page.locator('tbody').waitFor({ state: 'visible' });
    };
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name=email]').fill(email);
    await page.locator('input[name=password]').fill(password);
    await page.locator('button[type=submit]').click({ noWaitAfter: true });
    await page.waitForURL(/\/admin\/dashboard/, { waitUntil: 'domcontentloaded' });

    await page.goto(`${baseUrl}/admin/airlines/create`, { waitUntil: 'domcontentloaded' });
    await page.locator('#name').fill(createdName);
    await page.locator('#code').fill(code);
    await page.locator('#description').fill('QC automated CRUD fixture');
    await page.getByRole('button', { name: 'Save Airline' }).click({ noWaitAfter: true });
    await page.waitForURL(/\/admin\/airlines(?:\?.*)?$/, { waitUntil: 'domcontentloaded' });
    created = true;
    result.create = (await page.locator('body').innerText()).includes(createdName) ? 'PASSED' : 'FAILED';
    if (result.create !== 'PASSED') throw new Error('Created airline was not visible after submit.');

    await openSearch(createdName);
    const row = page.locator('tbody tr').filter({ hasText: createdName }).first();
    if (await row.count() !== 1) throw new Error('Created airline was not found in the filtered list.');
    result.read = 'PASSED';

    const editLink = row.getByRole('link', { name: 'Edit' });
    if (await editLink.count() !== 1) throw new Error('Edit link was not found for created airline.');
    await editLink.click({ noWaitAfter: true });
    await page.waitForURL(/\/admin\/airlines\/\d+\/edit/, { waitUntil: 'domcontentloaded' });
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.locator('#name').fill(updatedName);
    await page.getByRole('button', { name: 'Update Airline' }).click({ noWaitAfter: true });
    await page.waitForURL(/\/admin\/airlines(?:\?.*)?$/, { waitUntil: 'domcontentloaded' });
    await openSearch(updatedName);
    if (await page.locator('tbody tr').filter({ hasText: updatedName }).count() !== 1) throw new Error('Updated airline was not found in the filtered list.');
    result.update = 'PASSED';

    page.once('dialog', (dialog) => { void dialog.accept(); });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.locator('tbody tr').filter({ hasText: updatedName }).first().getByRole('button', { name: 'Delete' }).click(),
    ]);
    const afterDelete = await page.request.get(`${baseUrl}/admin/airlines?search=${encodeURIComponent(updatedName)}`);
    const afterDeleteHtml = await afterDelete.text();
    const afterDeleteTable = afterDeleteHtml.match(/<tbody[^>]*>[\s\S]*?<\/tbody>/i)?.[0] ?? '';
    const afterDeleteRows = afterDeleteTable.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    if (!afterDelete.ok() || afterDeleteRows.some((row) => row.includes(updatedName))) throw new Error('Deleted airline still appears in the server-rendered filtered list.');
    result.delete = 'PASSED';
    created = false;
  } finally {
    if (created) {
      result.cleanup = 'REQUIRED';
      try {
        await openSearch(createdName);
        page.once('dialog', (dialog) => { void dialog.accept(); });
        const cleanupRow = page.locator('tbody tr').filter({ hasText: createdName }).first();
        if (await cleanupRow.count()) await cleanupRow.getByRole('button', { name: 'Delete' }).click({ noWaitAfter: true });
      } catch { /* Preserve the original failure; report cleanup as required. */ }
    }
    const video = page.video();
    await context.close().catch(() => {});
    if (video) {
      try {
        const output = path.join(runDir, 'video.webm');
        try { await normalizeVideo(await video.path(), output); } catch { await copyFile(await video.path(), output); }
      } catch { /* Preserve the test result if video finalization fails. */ }
    }
    await rm(videoDir, { recursive: true, force: true }).catch(() => {});
    await browser.close().catch(() => {});
  }
  const resultDir = path.resolve('.qc-artifacts/zannora/runs', 'crud-airline');
  await mkdir(resultDir, { recursive: true });
  await writeFile(path.join(resultDir, `${runStamp}.json`), JSON.stringify({ ...result, video: path.join(runDir, 'video.webm') }, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (Object.values(result).some((value) => value === 'FAILED' || value === 'REQUIRED')) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

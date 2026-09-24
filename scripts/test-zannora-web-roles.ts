import { chromium, type Page } from 'playwright';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeVideo, VIDEO_RECORDING } from '../apps/api/src/video-policy';

type Case = { role: string; email: string; route: string; expectedStatus: number; expectedPath?: RegExp };

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!password) throw new Error('Set QC_ZANNORA_PASSWORD before web role test.');
  const cases: Case[] = [
    { role: 'admin', email: 'admin@zannora.com', route: '/admin/dashboard', expectedStatus: 200, expectedPath: /\/admin\/dashboard/ },
    { role: 'admin', email: 'admin@zannora.com', route: '/admin/airlines', expectedStatus: 200 },
    { role: 'admin', email: 'admin@zannora.com', route: '/admin/reports', expectedStatus: 200 },
    { role: 'admin', email: 'admin@zannora.com', route: '/admin/users', expectedStatus: 200 },
    { role: 'manager', email: 'manager@zannora.com', route: '/admin/dashboard', expectedStatus: 200, expectedPath: /\/admin\/dashboard/ },
    { role: 'manager', email: 'manager@zannora.com', route: '/admin/reports', expectedStatus: 200 },
    { role: 'manager', email: 'manager@zannora.com', route: '/admin/users', expectedStatus: 200 },
    { role: 'manager', email: 'manager@zannora.com', route: '/admin/airlines', expectedStatus: 200, expectedPath: /\/admin\/dashboard/ },
    { role: 'staff', email: 'staff@zannora.com', route: '/admin/dashboard', expectedStatus: 200, expectedPath: /\/admin\/dashboard/ },
    { role: 'staff', email: 'staff@zannora.com', route: '/admin/flights', expectedStatus: 200 },
    { role: 'staff', email: 'staff@zannora.com', route: '/admin/bookings', expectedStatus: 200 },
    { role: 'staff', email: 'staff@zannora.com', route: '/admin/reports', expectedStatus: 200, expectedPath: /\/admin\/dashboard/ },
    { role: 'staff', email: 'staff@zannora.com', route: '/admin/users', expectedStatus: 200, expectedPath: /\/admin\/dashboard/ },
    { role: 'customer', email: 'user@zannora.com', route: '/user/dashboard', expectedStatus: 200, expectedPath: /\/user\/dashboard/ },
    { role: 'customer', email: 'user@zannora.com', route: '/admin/dashboard', expectedStatus: 200, expectedPath: /\/user\/dashboard/ },
    { role: 'customer', email: 'user@zannora.com', route: '/profile', expectedStatus: 200 },
    { role: 'customer', email: 'user@zannora.com', route: '/booking?flight=1', expectedStatus: 200 },
  ];
  const results: Array<Record<string, unknown>> = [];
  for (const role of ['admin', 'manager', 'staff', 'customer']) {
    const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
    const runDir = path.resolve('.qc-artifacts/test-runs', 'zannora', 'web-roles', role, runStamp);
    const videoDir = path.join(runDir, '.videos');
    await mkdir(videoDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIDEO_RECORDING.viewport, recordVideo: { dir: videoDir, ...VIDEO_RECORDING.recordVideo } });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[name=email]').fill(cases.find((test) => test.role === role)!.email);
      await page.locator('input[name=password]').fill(password);
      await page.locator('button[type=submit]').click({ noWaitAfter: true });
      await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded' });
      for (const test of cases.filter((item) => item.role === role)) {
        const response = await page.goto(`${baseUrl}${test.route}`, { waitUntil: 'domcontentloaded' });
        const status = response?.status() ?? 0;
        const finalPath = new URL(page.url()).pathname;
        const passed = status === test.expectedStatus && (!test.expectedPath || test.expectedPath.test(finalPath));
        results.push({ ...test, status, finalPath, passed });
        if (!passed) throw new Error(`${role} ${test.route}: expected ${test.expectedStatus}/${test.expectedPath} got ${status}/${finalPath}`);
      }
    } finally {
      const video = page.video();
      await context.close().catch(() => {});
      if (video) {
        const output = path.join(runDir, 'video.webm');
        try { await normalizeVideo(await video.path(), output); } catch { await copyFile(await video.path(), output).catch(() => {}); }
      }
      await rm(videoDir, { recursive: true, force: true }).catch(() => {});
      await browser.close().catch(() => {});
    }
  }
  const resultDir = path.resolve('.qc-artifacts/zannora/runs', 'web-roles');
  await mkdir(resultDir, { recursive: true });
  const reportStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  await writeFile(path.join(resultDir, `${reportStamp}.json`), JSON.stringify({ status: 'PASSED', results }, null, 2));
  console.log(JSON.stringify({ total: results.length, passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

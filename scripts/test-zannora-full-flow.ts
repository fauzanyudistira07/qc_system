import { chromium, type Page } from 'playwright';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeVideo, VIDEO_RECORDING } from '../apps/api/src/video-policy';

type Check = { name: string; passed: boolean };
type FullFlowResult = {
  status: 'PASSED' | 'FAILED';
  checks: Check[];
  airlineName: string;
  passengerName: string;
  bookingId: number | null;
  bookingCode: string;
  paymentId: number | null;
  video?: string;
  screenshots: string[];
  error?: string;
};

async function apiCall(baseUrl: string, method: string, route: string, token?: string, body?: unknown) {
  const response = await fetch(new URL(route, baseUrl), {
    method,
    headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: any = raw;
  try { payload = raw ? JSON.parse(raw) : null; } catch { /* Keep raw text for diagnostics. */ }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${typeof payload === 'string' ? payload.slice(0, 200) : JSON.stringify(payload).slice(0, 400)}`);
  return payload;
}

async function login(page: Page, baseUrl: string, email: string, password: string, role: 'admin' | 'customer') {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.locator('button[type=submit]').click({ noWaitAfter: true });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded' });
  const pathname = new URL(page.url()).pathname;
  if (role === 'admin' && !pathname.includes('/admin/dashboard')) throw new Error(`Admin login redirected to ${page.url()}`);
  if (role === 'customer' && !['/', '/user/dashboard'].includes(pathname)) throw new Error(`Customer login redirected to ${page.url()}`);
}

async function logout(page: Page, baseUrl: string) {
  const form = page.locator('form[action$="/logout"]').first();
  if (await form.count() === 0) return;
  const token = await form.locator('input[name="_token"]').inputValue();
  const response = await page.request.post(`${baseUrl}/logout`, { form: { _token: token } });
  if (!response.ok()) throw new Error(`Logout failed: ${response.status()}`);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
}

function safeScreenshotName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'checkpoint';
}

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!password) throw new Error('Set QC_ZANNORA_PASSWORD before full-flow recording.');

  const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const suffix = runStamp.replace(/\D/g, '').slice(0, 14);
  const airlineName = `QC_FULL_Airline_${suffix}`;
  const passengerName = `QC_FULL_Passenger_${suffix}`;
  const transactionCode = `QC_FULL_TRX_${suffix}`;
  const runDir = path.resolve('.qc-artifacts/test-runs', 'zannora', 'full-flow', runStamp);
  const videoDir = path.join(runDir, '.videos');
  const screenshotDir = path.join(runDir, 'screenshots');
  const resultDir = path.resolve('.qc-artifacts/zannora/runs', 'full-flow');
  const result: FullFlowResult = { status: 'FAILED', checks: [], airlineName, passengerName, bookingId: null, bookingCode: '', paymentId: null, screenshots: [] };

  await mkdir(videoDir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIDEO_RECORDING.viewport, recordVideo: { dir: videoDir, ...VIDEO_RECORDING.recordVideo } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const captureScreenshot = async (name: string) => {
    const filename = `${String(result.screenshots.length + 1).padStart(2, '0')}-${safeScreenshotName(name)}.png`;
    const target = path.join(screenshotDir, filename);
    try {
      await page.screenshot({ path: target, fullPage: false, animations: 'disabled', timeout: 8_000 });
      result.screenshots.push(target);
    } catch {
      // Screenshot failure must not turn a passed functional check into a failed test.
    }
  };
  const check = async (name: string, passed: boolean) => {
    result.checks.push({ name, passed });
    await captureScreenshot(name);
    if (!passed) throw new Error(name);
  };

  try {
    console.log('[full-flow] admin login');
    await login(page, baseUrl, 'admin@zannora.com', password, 'admin');
    await check('admin login', new URL(page.url()).pathname === '/admin/dashboard');

    for (const route of ['/admin/dashboard', '/admin/airlines', '/admin/airports', '/admin/airplanes', '/admin/flights', '/admin/bookings', '/admin/payments', '/admin/tickets', '/admin/reports', '/admin/users']) {
      console.log(`[full-flow] admin ${route}`);
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
      await check(`admin navigation ${route}`, response?.status() === 200);
      await page.waitForTimeout(180);
    }

    console.log('[full-flow] switching admin -> customer');
    await logout(page, baseUrl);
    console.log('[full-flow] logged out admin');
    await login(page, baseUrl, 'user@zannora.com', password, 'customer');
    await check('customer login', ['/', '/user/dashboard'].includes(new URL(page.url()).pathname));
    for (const route of ['/flights', '/profile', '/notifications']) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
      await check(`customer navigation ${route}`, response?.status() === 200);
    }

    await page.goto(`${baseUrl}/passengers`, { waitUntil: 'domcontentloaded' });
    const passengerForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add Passenger' }) });
    await passengerForm.locator('input[name=full_name]').fill(passengerName);
    await passengerForm.locator('select[name=gender]').selectOption('male');
    await passengerForm.locator('input[name=birth_date]').fill('1990-01-01');
    await passengerForm.locator('input[name=identity_number]').fill(`FULL${suffix}`);
    await passengerForm.locator('input[name=nationality]').fill('Indonesia');
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/passengers'),
      passengerForm.getByRole('button', { name: 'Add Passenger' }).click({ noWaitAfter: true }),
    ]);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await check('customer passenger create', (await page.locator('body').innerText()).includes(passengerName));

    await page.goto(`${baseUrl}/booking?flight=1`, { waitUntil: 'domcontentloaded' });
    const passengerLabel = page.locator('label').filter({ hasText: passengerName }).first();
    await check('customer booking passenger select', await passengerLabel.count() === 1);
    await passengerLabel.locator('input[type=checkbox]').check();
    await page.getByRole('button', { name: 'Next' }).click();
    const seats = page.locator('button[title]');
    let selected = false;
    for (const seat of await seats.all()) {
      if (await seat.isVisible() && await seat.isEnabled()) {
        await seat.click();
        selected = true;
        break;
      }
    }
    await check('customer booking seat select', selected);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Booking Summary', { exact: true }).waitFor({ state: 'visible' });
    await check('customer booking summary', await page.getByRole('button', { name: 'Confirm Booking' }).isVisible());
    await page.getByRole('button', { name: 'Confirm Booking' }).click({ noWaitAfter: true });
    await page.waitForURL(/\/payment\?booking=\d+/, { waitUntil: 'domcontentloaded' });
    result.bookingId = Number(new URL(page.url()).searchParams.get('booking'));
    await check('customer booking create', Number.isInteger(result.bookingId) && result.bookingId > 0);
    await check('customer payment page', (await page.locator('body').innerText()).includes('Pembayaran Midtrans'));

    const authPayload = await apiCall(baseUrl, 'POST', '/api/v1/login', undefined, { email: 'user@zannora.com', password });
    const customerToken = authPayload?.data?.token;
    const paymentPayload = await apiCall(baseUrl, 'POST', '/api/v1/payments', customerToken, { booking_id: result.bookingId, payment_method: 'bank_transfer' });
    result.paymentId = Number(paymentPayload?.data?.id);
    const bookingPayload = await apiCall(baseUrl, 'GET', `/api/v1/bookings/${result.bookingId}`, customerToken);
    result.bookingCode = String(bookingPayload?.data?.booking_code || '');
    await check('bank-transfer payment handoff', result.paymentId > 0 && result.bookingCode.length > 0);

    console.log('[full-flow] switching customer -> admin');
    await logout(page, baseUrl);
    console.log('[full-flow] logged out customer');
    await login(page, baseUrl, 'admin@zannora.com', password, 'admin');
    await page.goto(`${baseUrl}/admin/payments/${result.paymentId}`, { waitUntil: 'domcontentloaded' });
    await check('admin payment detail', (await page.locator('body').innerText()).includes(String(result.paymentId)));
    await page.locator('input[placeholder="Transaction Code"]').fill(transactionCode);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `/admin/payments/${result.paymentId}/verify`),
      page.getByRole('button', { name: 'Verifikasi Payment' }).click({ noWaitAfter: true }),
    ]);
    await page.waitForLoadState('domcontentloaded');
    await check('admin payment verify', (await page.locator('body').innerText()).includes('Paid'));
    const ticketLink = page.getByRole('link', { name: 'Lihat Ticket' }).first();
    await check('admin ticket issued', await ticketLink.count() === 1);
    await ticketLink.click({ noWaitAfter: true });
    await page.waitForURL(/\/admin\/tickets\/\d+/, { waitUntil: 'domcontentloaded' });
    await check('admin ticket detail', (await page.locator('body').innerText()).includes('Ticket'));

    console.log('[full-flow] switching admin -> customer final');
    await logout(page, baseUrl);
    console.log('[full-flow] logged out admin final');
    await login(page, baseUrl, 'user@zannora.com', password, 'customer');
    await page.goto(`${baseUrl}/my-bookings/${result.bookingId}`, { waitUntil: 'domcontentloaded' });
    await check('customer confirmed booking', (await page.locator('body').innerText()).includes('Confirmed'));
    await page.getByRole('link', { name: 'Download Ticket' }).click({ noWaitAfter: true });
    await page.waitForURL(/\/tickets\/\d+/, { waitUntil: 'domcontentloaded' });
    await check('customer e-ticket', (await page.locator('body').innerText()).toLowerCase().includes('e-ticket'));

    result.status = 'PASSED';
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(result.error);
    process.exitCode = 1;
  } finally {
    const video = page.video();
    await context.close().catch(() => {});
    if (video) {
      const videoPath = path.join(runDir, 'full-flow.webm');
      try {
        await normalizeVideo(await video.path(), videoPath);
      } catch {
        await copyFile(await video.path(), videoPath).catch(() => {});
      }
      result.video = videoPath;
    }
    await rm(videoDir, { recursive: true, force: true }).catch(() => {});
    await browser.close().catch(() => {});
  }

  await mkdir(resultDir, { recursive: true });
  const report = JSON.stringify(result, null, 2);
  await writeFile(path.join(runDir, 'report.json'), report);
  await writeFile(path.join(resultDir, `${runStamp}.json`), report);
  console.log(JSON.stringify({ status: result.status, total: result.checks.length, passed: result.checks.filter((item) => item.passed).length, failed: result.checks.filter((item) => !item.passed).length, bookingCode: result.bookingCode, video: result.video, screenshots: result.screenshots.length, runDir }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

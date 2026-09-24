import { chromium, type BrowserContext, type Page } from 'playwright';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeVideo, VIDEO_RECORDING } from '../apps/api/src/video-policy';

type Result = {
  status: 'PASSED' | 'FAILED';
  passengerName: string;
  bookingId: number | null;
  bookingCode: string;
  paymentId: number | null;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
  videos: string[];
};

async function login(page: Page, baseUrl: string, email: string, password: string, admin = false) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.locator('button[type=submit]').click({ noWaitAfter: true });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded' });
  const pathname = new URL(page.url()).pathname;
  if (admin && !/\/admin\/dashboard/.test(pathname)) throw new Error(`Admin login redirected to ${page.url()}`);
  if (!admin && !['/', '/user/dashboard'].includes(pathname)) throw new Error(`Customer login redirected to ${page.url()}`);
}

async function closeWithVideo(context: BrowserContext, page: Page, runDir: string, filename: string, videos: string[]) {
  const video = page.video();
  await context.close().catch(() => {});
  if (video) {
    const output = path.join(runDir, filename);
    try { await normalizeVideo(await video.path(), output); } catch { await copyFile(await video.path(), output).catch(() => {}); }
    videos.push(output);
  }
}

async function apiCall(baseUrl: string, method: string, route: string, token?: string, body?: unknown) {
  const response = await fetch(new URL(route, baseUrl), {
    method,
    headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: any = raw;
  try { payload = raw ? JSON.parse(raw) : null; } catch { /* Keep text for diagnostics. */ }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${typeof payload === 'string' ? payload.slice(0, 240) : JSON.stringify(payload).slice(0, 500)}`);
  return payload;
}

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!password) throw new Error('Set QC_ZANNORA_PASSWORD before web booking E2E.');

  const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const suffix = runStamp.replace(/\D/g, '').slice(0, 14);
  const passengerName = `QC_TEST_WEB_Passenger_${suffix}`;
  const transactionCode = `QC_WEB_TRX_${suffix}`;
  const runDir = path.resolve('.qc-artifacts/test-runs', 'zannora', 'web-booking', runStamp);
  const videoDir = path.join(runDir, '.videos');
  await mkdir(videoDir, { recursive: true });

  const result: Result = { status: 'FAILED', passengerName, bookingId: null, bookingCode: '', paymentId: null, checks: [], videos: [] };
  const check = (name: string, passed: boolean, detail?: string) => {
    result.checks.push({ name, passed, detail });
    if (!passed) throw new Error(detail || name);
  };

  const browser = await chromium.launch({ headless: true });
  let customerContext: BrowserContext | undefined;
  let adminContext: BrowserContext | undefined;
  let customerPage: Page | undefined;
  let adminPage: Page | undefined;

  try {
    customerContext = await browser.newContext({ viewport: VIDEO_RECORDING.viewport, recordVideo: { dir: videoDir, ...VIDEO_RECORDING.recordVideo } });
    customerPage = await customerContext.newPage();
    customerPage.setDefaultTimeout(15_000);
    customerPage.setDefaultNavigationTimeout(30_000);

    await login(customerPage, baseUrl, 'user@zannora.com', password);
    await customerPage.goto(`${baseUrl}/passengers`, { waitUntil: 'domcontentloaded' });
    const addPassengerForm = customerPage.locator('form').filter({ has: customerPage.getByRole('button', { name: 'Add Passenger' }) });
    await addPassengerForm.locator('input[name=full_name]').fill(passengerName);
    await addPassengerForm.locator('select[name=gender]').selectOption('male');
    await addPassengerForm.locator('input[name=birth_date]').fill('1990-01-01');
    await addPassengerForm.locator('input[name=identity_number]').fill(`WEB${suffix}`);
    await addPassengerForm.locator('input[name=nationality]').fill('Indonesia');
    await Promise.all([
      customerPage.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/passengers'),
      addPassengerForm.getByRole('button', { name: 'Add Passenger' }).click({ noWaitAfter: true }),
    ]);
    await customerPage.waitForLoadState('domcontentloaded');
    check('customer UI passenger create', (await customerPage.locator('body').innerText()).includes(passengerName));

    await customerPage.goto(`${baseUrl}/booking?flight=1`, { waitUntil: 'domcontentloaded' });
    const passengerLabel = customerPage.locator('label').filter({ hasText: passengerName }).first();
    check('booking UI passenger fixture visible', await passengerLabel.count() === 1);
    await passengerLabel.locator('input[type=checkbox]').check();
    await customerPage.getByRole('button', { name: 'Next' }).click();
    const seats = customerPage.locator('button[title]');
    let seatSelected = false;
    for (const seat of await seats.all()) {
      if (await seat.isVisible() && await seat.isEnabled()) {
        await seat.click();
        seatSelected = true;
        break;
      }
    }
    check('booking UI available seat select', seatSelected);
    await customerPage.getByRole('button', { name: 'Next' }).click();
    await customerPage.waitForTimeout(250);
    const summaryHeading = customerPage.locator('h2').filter({ hasText: 'Booking Summary' });
    check('booking UI summary visible', await summaryHeading.isVisible());
    await customerPage.getByRole('button', { name: 'Confirm Booking' }).click({ noWaitAfter: true });
    await customerPage.waitForURL(/\/payment\?booking=\d+/, { waitUntil: 'domcontentloaded' });
    const bookingUrl = new URL(customerPage.url());
    result.bookingId = Number(bookingUrl.searchParams.get('booking'));
    check('booking UI creates pending booking', Number.isInteger(result.bookingId) && result.bookingId > 0);
    check('payment UI page renders', (await customerPage.locator('body').innerText()).includes('Pembayaran Midtrans'));

    const loginPayload = await apiCall(baseUrl, 'POST', '/api/v1/login', undefined, { email: 'user@zannora.com', password });
    const customerToken = loginPayload?.data?.token;
    check('API customer login for payment handoff', Boolean(customerToken));
    const paymentPayload = await apiCall(baseUrl, 'POST', '/api/v1/payments', customerToken, { booking_id: result.bookingId, payment_method: 'bank_transfer' });
    result.paymentId = Number(paymentPayload?.data?.id);
    check('bank-transfer payment created', Number.isInteger(result.paymentId) && result.paymentId > 0);
    const bookingPayload = await apiCall(baseUrl, 'GET', `/api/v1/bookings/${result.bookingId}`, customerToken);
    result.bookingCode = String(bookingPayload?.data?.booking_code || '');
    check('booking code available', result.bookingCode.length > 0);

    await customerPage.goto(`${baseUrl}/my-bookings/${result.bookingId}`, { waitUntil: 'domcontentloaded' });
    check('customer booking detail pending visible', (await customerPage.locator('body').innerText()).includes('Pending'));

    adminContext = await browser.newContext({ viewport: VIDEO_RECORDING.viewport, recordVideo: { dir: videoDir, ...VIDEO_RECORDING.recordVideo } });
    adminPage = await adminContext.newPage();
    adminPage.setDefaultTimeout(15_000);
    adminPage.setDefaultNavigationTimeout(30_000);
    await login(adminPage, baseUrl, 'admin@zannora.com', password, true);
    await adminPage.goto(`${baseUrl}/admin/payments/${result.paymentId}`, { waitUntil: 'domcontentloaded' });
    check('admin payment detail visible', (await adminPage.locator('body').innerText()).includes(String(result.paymentId)));
    await adminPage.locator('input[placeholder="Transaction Code"]').fill(transactionCode);
    await Promise.all([
      adminPage.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `/admin/payments/${result.paymentId}/verify`),
      adminPage.getByRole('button', { name: 'Verifikasi Payment' }).click({ noWaitAfter: true }),
    ]);
    await adminPage.waitForLoadState('domcontentloaded');
    check('admin verifies payment in UI', (await adminPage.locator('body').innerText()).includes('Paid'));
    const adminTicketLink = adminPage.getByRole('link', { name: 'Lihat Ticket' }).first();
    check('admin ticket issued after UI verification', await adminTicketLink.count() === 1);
    await adminTicketLink.click({ noWaitAfter: true });
    await adminPage.waitForURL(/\/admin\/tickets\/\d+/, { waitUntil: 'domcontentloaded' });
    check('admin ticket detail renders', (await adminPage.locator('body').innerText()).includes('Ticket'));

    await customerPage.goto(`${baseUrl}/my-bookings/${result.bookingId}`, { waitUntil: 'domcontentloaded' });
    check('customer confirmed booking visible', (await customerPage.locator('body').innerText()).includes('Confirmed'));
    const userTicketLink = customerPage.getByRole('link', { name: 'Download Ticket' });
    check('customer ticket link visible', await userTicketLink.count() === 1);
    await userTicketLink.click({ noWaitAfter: true });
    await customerPage.waitForURL(/\/tickets\/\d+/, { waitUntil: 'domcontentloaded' });
    check('customer e-ticket page renders', (await customerPage.locator('body').innerText()).toLowerCase().includes('e-ticket'));

    result.status = 'PASSED';
  } finally {
    if (customerContext && customerPage) await closeWithVideo(customerContext, customerPage, runDir, 'customer-booking.webm', result.videos);
    if (adminContext && adminPage) await closeWithVideo(adminContext, adminPage, runDir, 'admin-payment-ticket.webm', result.videos);
    await rm(videoDir, { recursive: true, force: true }).catch(() => {});
    await browser.close().catch(() => {});
  }

  const resultDir = path.resolve('.qc-artifacts/zannora/runs', 'web-booking');
  await mkdir(resultDir, { recursive: true });
  await writeFile(path.join(resultDir, `${runStamp}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, total: result.checks.length, passed: result.checks.filter((item) => item.passed).length, failed: result.checks.filter((item) => !item.passed).length, bookingId: result.bookingId, paymentId: result.paymentId, passengerName: result.passengerName, videos: result.videos }, null, 2));
  if (result.status !== 'PASSED') process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

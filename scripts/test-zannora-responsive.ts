import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ViewportCase = { name: string; width: number; height: number };
type AuditResult = {
  viewport: string;
  role: string;
  route: string;
  status: number;
  finalPath: string;
  horizontalOverflow: boolean;
  clippedControls: string[];
  textQualityIssues: string[];
  passed: boolean;
  screenshot?: string;
  error?: string;
};

const viewports: ViewportCase[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const publicRoutes = ['/login', '/', '/flights'];
const adminRoutes = [
  '/admin/dashboard',
  '/admin/airlines',
  '/admin/airports',
  '/admin/airplanes',
  '/admin/flights',
  '/admin/bookings',
  '/admin/payments',
  '/admin/tickets',
  '/admin/reports',
  '/admin/users',
];
const customerRoutes = ['/user/dashboard', '/flights', '/profile', '/notifications', '/passengers', '/booking?flight=1'];

function slug(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'page';
}

async function login(page: Page, baseUrl: string, email: string, password: string, expectedPath: RegExp) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.locator('button[type=submit]').click({ noWaitAfter: true });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded' });
  if (!expectedPath.test(new URL(page.url()).pathname)) throw new Error(`Login ${email} redirected to ${page.url()}`);
}

async function inspectLayout(page: Page) {
  const probe = `(() => {
    const viewportWidth = window.innerWidth;
    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    }
    const controls = [];
    const elements = document.querySelectorAll('a,button,input,select,textarea,[role="button"]');
    for (const element of elements) {
      if (!isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      const input = element;
      const label = ((element.textContent || input.ariaLabel || input.placeholder || element.tagName) || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
      if (rect.left < -2 || rect.right > viewportWidth + 2) controls.push({ label, left: rect.left, right: rect.right });
    }
    const root = document.documentElement;
    const body = document.body;
    const clippedControls = [];
    for (const item of controls.slice(0, 12)) clippedControls.push(item.label + ' [' + Math.round(item.left) + '..' + Math.round(item.right) + ']');
    const textQualityIssues = [];
    const textElements = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,label,a,button,th,td,small,legend,caption,span,div,li'))
      .filter(isVisible)
      .filter((element) => Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim().length >= 2);
    const describedText = [
      ...textElements.map((element) => {
      const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      const selector = element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (element.className && typeof element.className === 'string' ? '.' + element.className.split(/\s+/)[0] : '');
      return { element, text, selector, sample: text.slice(0, 80) };
      }),
      ...Array.from(document.querySelectorAll('input[placeholder],textarea[placeholder],select')).filter(isVisible).map((element) => {
        const text = (element.getAttribute('placeholder') || element.value || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        const selector = element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (element.className && typeof element.className === 'string' ? '.' + element.className.split(/\s+/)[0] : '');
        return { element, text, selector, sample: text.slice(0, 80), formText: true };
      }).filter((item) => item.text.length >= 2),
    ];
    for (const item of describedText) {
      const rect = item.element.getBoundingClientRect();
      const style = getComputedStyle(item.element);
      const mergedWords = item.text.match(/[\p{Ll}][\p{Lu}]/gu);
      const likelyUiMerge = /(?:^|[\s_-])(total|payment|paid|cancelled|booking|flight|passenger|seat|user|status|aktif|pending|expired|revenue|ticket|route|nama|jumlah|penerbangan|pembayaran|penumpang)[\p{Lu}]/iu.test(item.text) || /(?:total|payment|paid|cancelled|booking|flight|passenger|seat|user|status|aktif|pending|expired|revenue|ticket|route|nama|jumlah|penerbangan|pembayaran|penumpang)[\p{Lu}]/u.test(item.text);
      let rangeClipped = false;
      try {
        const range = document.createRange();
        range.selectNodeContents(item.element);
        const rangeRect = range.getBoundingClientRect();
        rangeClipped = rangeRect.right > rect.right + 1 || rangeRect.bottom > rect.bottom + 1;
      } catch {}
      if (mergedWords?.length && likelyUiMerge) textQualityIssues.push(item.selector + ' "' + item.sample + '" has merged/camelCase words');
      if (item.element.scrollWidth > item.element.clientWidth + 1 || item.element.scrollHeight > item.element.clientHeight + 1 || rangeClipped) textQualityIssues.push(item.selector + ' "' + item.sample + '" text is clipped or exceeds its box');
      if (item.formText) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          context.font = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
          const availableWidth = item.element.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0);
          if (context.measureText(item.text).width > availableWidth + 1) textQualityIssues.push(item.selector + ' placeholder/value "' + item.sample + '" is clipped in the control');
        }
      }
      if (style.lineHeight !== 'normal' && Number.parseFloat(style.lineHeight) < (Number.parseFloat(style.fontSize) || 16) * 1.05 && item.text.length > 12) textQualityIssues.push(item.selector + ' "' + item.sample + '" line-height is too tight for its text');
    }
    for (let index = 0; index < describedText.length; index += 1) {
      const left = describedText[index];
      const leftRect = left.element.getBoundingClientRect();
      for (let otherIndex = index + 1; otherIndex < describedText.length; otherIndex += 1) {
        const right = describedText[otherIndex];
        if (left.element.contains(right.element) || right.element.contains(left.element)) continue;
        const rightRect = right.element.getBoundingClientRect();
        const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
        const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
        if (overlapWidth > 2 && overlapHeight > 2) {
          const leftArea = Math.max(1, leftRect.width * leftRect.height);
          const rightArea = Math.max(1, rightRect.width * rightRect.height);
          if ((overlapWidth * overlapHeight) / Math.min(leftArea, rightArea) > 0.2) textQualityIssues.push(left.selector + ' overlaps ' + right.selector);
        }
        if (textQualityIssues.length >= 40) break;
      }
      if (textQualityIssues.length >= 40) break;
    }
    return {
      horizontalOverflow: root.scrollWidth > root.clientWidth + 2 || body.scrollWidth > body.clientWidth + 2,
      clippedControls,
      textQualityIssues: [...new Set(textQualityIssues)].slice(0, 40),
    };
  })()`;
  return page.evaluate(probe);
}

async function auditRoute(
  page: Page,
  baseUrl: string,
  role: string,
  viewport: ViewportCase,
  route: string,
  screenshotDir: string,
): Promise<AuditResult> {
  const result: AuditResult = {
    viewport: viewport.name,
    role,
    route,
    status: 0,
    finalPath: '',
    horizontalOverflow: false,
    clippedControls: [],
    textQualityIssues: [],
    passed: false,
  };
  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    result.status = response?.status() ?? 0;
    result.finalPath = new URL(page.url()).pathname;
    const layout = await inspectLayout(page);
    result.horizontalOverflow = layout.horizontalOverflow;
    result.clippedControls = layout.clippedControls;
    result.textQualityIssues = layout.textQualityIssues;
    result.passed = result.status === 200 && result.clippedControls.length === 0 && result.textQualityIssues.length === 0 && !result.horizontalOverflow;
    const screenshot = path.join(screenshotDir, `${viewport.name}-${role}-${slug(route)}.png`);
    await page.screenshot({ path: screenshot, fullPage: false, animations: 'disabled', timeout: 10_000 });
    result.screenshot = screenshot;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function auditContext(
  browserContext: BrowserContext,
  baseUrl: string,
  role: string,
  viewport: ViewportCase,
  routes: string[],
  screenshotDir: string,
) {
  const page = await browserContext.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const results: AuditResult[] = [];
  for (const route of routes) results.push(await auditRoute(page, baseUrl, role, viewport, route, screenshotDir));
  await page.close();
  return results;
}

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!password) throw new Error('Set QC_ZANNORA_PASSWORD before responsive audit.');
  const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const runDir = path.resolve('.qc-artifacts/test-runs/zannora/responsive', runStamp);
  const screenshotDir = path.join(runDir, 'screenshots');
  await mkdir(screenshotDir, { recursive: true });
  const results: AuditResult[] = [];

  const browser = await chromium.launch({ headless: true });
  for (const viewport of viewports) {
    const publicContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    results.push(...await auditContext(publicContext, baseUrl, 'public', viewport, publicRoutes, screenshotDir));
    await publicContext.close();

    const adminContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const adminPage = await adminContext.newPage();
    adminPage.setDefaultTimeout(15_000);
    adminPage.setDefaultNavigationTimeout(30_000);
    try {
      await login(adminPage, baseUrl, 'admin@zannora.com', password, /\/admin\/dashboard/);
      for (const item of await auditContext(adminContext, baseUrl, 'admin', viewport, adminRoutes, screenshotDir)) results.push(item);
    } catch (error) {
      results.push({ viewport: viewport.name, role: 'admin', route: 'login', status: 0, finalPath: adminPage.url(), horizontalOverflow: false, clippedControls: [], textQualityIssues: [], passed: false, error: error instanceof Error ? error.message : String(error) });
    }
    await adminContext.close();

    const customerContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const customerPage = await customerContext.newPage();
    customerPage.setDefaultTimeout(15_000);
    customerPage.setDefaultNavigationTimeout(30_000);
    try {
      await login(customerPage, baseUrl, 'user@zannora.com', password, /^(\/|\/user\/dashboard)$/);
      for (const item of await auditContext(customerContext, baseUrl, 'customer', viewport, customerRoutes, screenshotDir)) results.push(item);
    } catch (error) {
      results.push({ viewport: viewport.name, role: 'customer', route: 'login', status: 0, finalPath: customerPage.url(), horizontalOverflow: false, clippedControls: [], textQualityIssues: [], passed: false, error: error instanceof Error ? error.message : String(error) });
    }
    await customerContext.close();
  }
  await browser.close();

  const report = {
    status: results.every((item) => item.passed) ? 'PASSED' : 'FAILED',
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    viewports,
    runDir,
    results,
  };
  await writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  const resultDir = path.resolve('.qc-artifacts/zannora/runs/responsive');
  await mkdir(resultDir, { recursive: true });
  await writeFile(path.join(resultDir, `${runStamp}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, total: report.total, passed: report.passed, failed: report.failed, runDir }, null, 2));
  if (report.failed > 0) {
    console.log(JSON.stringify(results.filter((item) => !item.passed), null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

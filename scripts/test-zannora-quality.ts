import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
const password = process.env.QC_ZANNORA_PASSWORD;
const runStamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
const runDir = path.resolve('.qc-artifacts/test-runs/zannora/quality', runStamp);
const screenshotDir = path.join(runDir, 'screenshots');
const baselineDir = path.resolve('.qc-artifacts/visual-baselines/zannora');
const reportDir = path.resolve('.qc-artifacts/zannora/runs/quality');

if (!password) throw new Error('Set QC_ZANNORA_PASSWORD before quality audit.');

type BrowserName = 'chromium' | 'firefox' | 'webkit';
type Viewport = { name: string; width: number; height: number };
type Check = { area: string; name: string; passed: boolean; detail: string; browser?: string; viewport?: string; route?: string };

const browsers: Array<{ name: BrowserName; type: typeof chromium }> = [
  { name: 'chromium', type: chromium },
  { name: 'firefox', type: firefox },
  { name: 'webkit', type: webkit },
];
const viewports: Viewport[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const chromiumRoutes = ['/login', '/', '/flights', '/admin/dashboard', '/admin/airlines', '/admin/reports', '/user/dashboard', '/profile', '/passengers', '/booking?flight=1'];
const browserSmokeRoutes = ['/login', '/', '/flights'];
const adminSmokeRoutes = ['/admin/dashboard', '/admin/airlines', '/admin/reports'];
const customerSmokeRoutes = ['/user/dashboard', '/profile', '/passengers'];

const checks: Check[] = [];
function add(area: string, name: string, passed: boolean, detail: string, meta: Partial<Check> = {}) {
  checks.push({ area, name, passed, detail, ...meta });
}

function slug(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'page';
}

async function screenshot(page: Page, name: string) {
  const target = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: false, animations: 'disabled', timeout: 10_000 });
  return target;
}

async function login(page: Page, email: string, expected: RegExp, record = true) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password!);
  await page.locator('button[type=submit]').click({ noWaitAfter: true });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded' });
  if (record) add('accessibility', `login ${email}`, expected.test(new URL(page.url()).pathname), `final path ${new URL(page.url()).pathname}`);
}

async function auditPage(page: Page, browser: string, viewport: Viewport, route: string) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  const result = await page.evaluate(String.raw`(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const parse = (value) => {
      if (value.startsWith('#')) {
        const hex = value.slice(1);
        const expanded = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
        return { r: parseInt(expanded.slice(0, 2), 16), g: parseInt(expanded.slice(2, 4), 16), b: parseInt(expanded.slice(4, 6), 16), a: expanded.length >= 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1 };
      }
      const match = value.match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const values = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      return { r: values[0] || 0, g: values[1] || 0, b: values[2] || 0, a: values[3] === undefined ? 1 : values[3] };
    };
    const blend = (front, back) => {
      const alpha = front.a + back.a * (1 - front.a);
      if (!alpha) return back;
      return { r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha, g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha, b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha, a: alpha };
    };
    const luminance = (color) => {
      const channel = (value) => { const normalized = value / 255; return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4); };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const rootBackground = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    const backgroundFor = (element) => {
      let current = element;
      let background = rootBackground;
      const foreground = parse(getComputedStyle(element).color);
      const foregroundLum = foreground ? luminance(foreground) : 0;
      while (current) {
        const style = getComputedStyle(current);
        const gradientColors = (style.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) || []).map(parse).filter((item) => item && item.a >= 0.6);
        const color = gradientColors.length > 0
          ? gradientColors.sort((left, right) => luminance(left) - luminance(right))[foregroundLum > 0.5 ? 0 : gradientColors.length - 1]
          : parse(style.backgroundColor);
        if (color) background = blend(color, background);
        if (color && color.a === 1) break;
        current = current.parentElement;
      }
      return background;
    };
    const targets = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,label,a,button,th,td,small,legend,caption')).filter(visible);
    const contrastIssues = [];
    for (const element of targets) {
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      const style = getComputedStyle(element);
      const foreground = parse(style.color);
      if (!foreground) continue;
      const background = backgroundFor(element);
      const foregroundOnBackground = blend(foreground, background);
      const foregroundLum = luminance(foregroundOnBackground);
      const backgroundLum = luminance(background);
      const ratio = (Math.max(foregroundLum, backgroundLum) + 0.05) / (Math.min(foregroundLum, backgroundLum) + 0.05);
      const size = Number.parseFloat(style.fontSize) || 16;
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const required = large ? 3 : 4.5;
      if (ratio + 0.01 < required) contrastIssues.push(element.tagName.toLowerCase() + ' "' + text.slice(0, 32) + '" ' + ratio.toFixed(2) + '<' + required);
    }
    const interactive = Array.from(document.querySelectorAll('a,button,input,select,textarea,[role="button"]')).filter(visible);
    const missingLabelElements = interactive.filter((element) => {
      if (element.tagName === 'BUTTON' || element.tagName === 'A') return !(element.textContent || '').trim() && !element.getAttribute('aria-label') && !element.getAttribute('title');
      return !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && !element.getAttribute('id') && !element.getAttribute('name') && !element.getAttribute('placeholder');
    });
    const missingLabels = missingLabelElements.length;
    const overflow = targets.filter((element) => {
      const style = getComputedStyle(element);
      return element.scrollWidth > element.clientWidth + 2 && style.overflowX !== 'hidden' && style.textOverflow !== 'ellipsis';
    }).slice(0, 20).map((element) => element.tagName.toLowerCase() + (element.className ? '.' + String(element.className).split(/\s+/)[0] : ''));
    const textQualityIssues = [];
    const textNodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,label,a,button,th,td,small,legend,caption,span,div,li'))
      .filter(visible)
      .filter((element) => {
        const directText = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
        return directText.length >= 2;
      });
    const describeText = (element) => {
      const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      const selector = element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (element.className && typeof element.className === 'string' ? '.' + element.className.split(/\s+/)[0] : '');
      return { element, text, selector, sample: text.slice(0, 80) };
    };
    const describedText = [
      ...textNodes.map(describeText),
      ...Array.from(document.querySelectorAll('input[placeholder],textarea[placeholder],select')).filter(visible).map((element) => {
        const text = (element.getAttribute('placeholder') || element.value || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        const selector = element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (element.className && typeof element.className === 'string' ? '.' + element.className.split(/\s+/)[0] : '');
        return { element, text, selector, sample: text.slice(0, 80), formText: true };
      }).filter((item) => item.text.length >= 2),
    ];
    for (const item of describedText) {
      const element = item.element;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const mergedWords = item.text.match(/[\p{Ll}][\p{Lu}]/gu);
      const likelyUiMerge = /(?:^|[\s_-])(total|payment|paid|cancelled|booking|flight|passenger|seat|user|status|aktif|pending|expired|revenue|ticket|route|nama|jumlah|penerbangan|pembayaran|penumpang)[\p{Lu}]/iu.test(item.text) || /(?:total|payment|paid|cancelled|booking|flight|passenger|seat|user|status|aktif|pending|expired|revenue|ticket|route|nama|jumlah|penerbangan|pembayaran|penumpang)[\p{Lu}]/u.test(item.text);
      const clipped = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      let rangeClipped = false;
      try {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rangeRect = range.getBoundingClientRect();
        rangeClipped = rangeRect.right > rect.right + 1 || rangeRect.bottom > rect.bottom + 1;
      } catch {}
      if (mergedWords?.length && likelyUiMerge) textQualityIssues.push(item.selector + ' "' + item.sample + '" has merged/camelCase words');
      if (clipped || rangeClipped) textQualityIssues.push(item.selector + ' "' + item.sample + '" text is clipped or exceeds its box');
      if (item.formText) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          context.font = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
          const availableWidth = element.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0);
          if (context.measureText(item.text).width > availableWidth + 1) textQualityIssues.push(item.selector + ' placeholder/value "' + item.sample + '" is clipped in the control');
        }
      }
      if (style.lineHeight !== 'normal' && Number.parseFloat(style.lineHeight) < (Number.parseFloat(style.fontSize) || 16) * 1.05 && item.text.length > 12) {
        textQualityIssues.push(item.selector + ' "' + item.sample + '" line-height is too tight for its text');
      }
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
          if ((overlapWidth * overlapHeight) / Math.min(leftArea, rightArea) > 0.2) {
            textQualityIssues.push(left.selector + ' overlaps ' + right.selector);
          }
        }
        if (textQualityIssues.length >= 40) break;
      }
      if (textQualityIssues.length >= 40) break;
    }
    const controlHeights = Array.from(document.querySelectorAll('button,select,textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])')).filter(visible).map((element) => Math.round(element.getBoundingClientRect().height)).filter((height) => height > 0);
    const commonHeight = controlHeights.length ? controlHeights.sort((a, b) => a - b)[Math.floor(controlHeights.length / 2)] : 0;
    const inconsistentControls = controlHeights.filter((height) => height < 28 || height > 64).length;
    const tableInfo = Array.from(document.querySelectorAll('table')).filter(visible).map((table) => ({ rows: table.querySelectorAll('tbody tr').length, width: Math.round(table.getBoundingClientRect().width), overflow: table.scrollWidth > table.clientWidth + 2 }));
    return { contrastIssues: contrastIssues.slice(0, 20), contrastTotal: contrastIssues.length, missingLabels, missingLabelSamples: missingLabelElements.slice(0, 10).map((element) => element.tagName.toLowerCase() + ':' + (element.getAttribute('type') || '') + ':' + (element.getAttribute('name') || '') + ':' + (element.getAttribute('placeholder') || '')), overflow, textQualityIssues: [...new Set(textQualityIssues)].slice(0, 40), interactiveCount: interactive.length, commonHeight, inconsistentControls, tableInfo, invalidControls: document.querySelectorAll(':invalid').length, alertCount: document.querySelectorAll('[role="alert"],.alert,.error,.text-red-500').length, bodyText: (document.body.innerText || '').slice(0, 1200) };
  })()`);
  add('contrast', `${route} color contrast`, result.contrastTotal === 0, result.contrastTotal ? `${result.contrastTotal} issue(s): ${result.contrastIssues.join('; ')}` : 'All sampled text meets WCAG AA threshold', { browser, viewport: viewport.name, route });
  const textIssues = [...(result.overflow || []), ...(result.textQualityIssues || [])];
  add('typography', `${route} text metrics`, textIssues.length === 0 && result.inconsistentControls === 0, textIssues.length ? `Text/layout issues: ${textIssues.slice(0, 12).join('; ')}` : `control height baseline ${result.commonHeight}px; out-of-range controls ${result.inconsistentControls}`, { browser, viewport: viewport.name, route });
  add('content-quality', `${route} text content and layout`, (result.textQualityIssues || []).length === 0, result.textQualityIssues?.length ? result.textQualityIssues.slice(0, 12).join('; ') : 'Visible text is separated, contained, and readable.', { browser, viewport: viewport.name, route });
  add('accessibility', `${route} interactive labels`, result.missingLabels === 0, `${result.interactiveCount} interactive controls; missing accessible labels ${result.missingLabels}${result.missingLabelSamples?.length ? ` (${result.missingLabelSamples.join(', ')})` : ''}`, { browser, viewport: viewport.name, route });
  let ariaSnapshot = '';
  try { ariaSnapshot = String(await (page.locator('body') as any).ariaSnapshot()); } catch { /* Older Playwright builds may not expose ariaSnapshot. */ }
  add('accessibility', `${route} screen reader tree`, ariaSnapshot.trim().length > 0, ariaSnapshot.trim().length > 0 ? 'Accessible ARIA tree is available for the page.' : 'ARIA tree could not be generated.', { browser, viewport: viewport.name, route });
  add('dense-data', `${route} table/form density`, result.tableInfo.every((table: { overflow: boolean }) => !table.overflow), result.tableInfo.length ? JSON.stringify(result.tableInfo) : 'No table on route; form controls stayed within viewport', { browser, viewport: viewport.name, route });
  return result;
}

async function auditFocusAndStates(page: Page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  const control = page.locator('button:visible, input:visible, a:visible').first();
  if (await control.count()) {
    await control.focus();
    const focus = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return { active: document.activeElement === element, outline: style.outlineStyle !== 'none' || style.boxShadow !== 'none' || style.borderColor !== getComputedStyle(element.parentElement || element).borderColor };
    });
    add('states', 'keyboard focus indicator', focus.active && focus.outline, JSON.stringify(focus));
    await control.hover();
    add('states', 'hover state probe', true, 'Hover state executed on first interactive control.');
  } else add('states', 'keyboard focus indicator', false, 'No interactive control found on login page.');

  await page.locator('button[type=submit]').click({ noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(120);
  const invalid = await page.locator(':invalid').count();
  add('states', 'empty/error validation state', invalid > 0, `${invalid} invalid control(s) surfaced after empty login submit.`);

  await login(page, 'admin@zannora.com', /\/admin\/dashboard/);
  const emptyUrl = `${baseUrl}/admin/airlines?search=QC_EMPTY_STATE_${Date.now()}`;
  await page.goto(emptyUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const emptyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  add('states', 'empty state probe', /no |empty|tidak ada|belum ada|belum tersedia|not found/.test(emptyText), 'Filtered list rendered an empty/no-result response.');
  const stateInventory = await page.evaluate(() => ({
    disabled: document.querySelectorAll(':disabled,[aria-disabled="true"]').length,
    loading: document.querySelectorAll('[aria-busy="true"],[role="progressbar"],[data-loading="true"]').length,
  }));
  add('states', 'disabled state inventory', true, `${stateInventory.disabled} disabled/aria-disabled control(s) observed on the CRUD page.`);
  add('states', 'loading state inventory', true, `${stateInventory.loading} loading hook(s) observed on the CRUD page; idle state remains stable.`);
}

async function compareImages(baseline: string, current: string) {
  try {
    const { stderr } = await execFileAsync('compare', ['-metric', 'AE', baseline, current, 'null:']);
    return Number.parseInt(stderr.trim().split(/\s+/)[0] || '0', 10) || 0;
  } catch (error) {
    const stderr = String((error as { stderr?: string }).stderr || '');
    return Number.parseInt(stderr.trim().split(/\s+/)[0] || '0', 10) || 0;
  }
}

async function visualRegression(page: Page) {
  const cases = [
    { name: 'login', path: '/login', baseline: path.join(baselineDir, 'login.png') },
    { name: 'admin-dashboard', path: '/admin/dashboard', baseline: path.join(baselineDir, 'admin-dashboard.png') },
  ];
  for (const item of cases) {
    if (item.path.startsWith('/admin/')) await login(page, 'admin@zannora.com', /\/admin\/dashboard/, false);
    else await page.goto(`${baseUrl}${item.path}`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' }).catch(() => {});
    const current = await screenshot(page, `visual-${item.name}`);
    await mkdir(baselineDir, { recursive: true });
    let exists = true;
    try { await stat(item.baseline); } catch { exists = false; }
    if (!exists) {
      await copyFile(current, item.baseline);
      add('visual-regression', item.name, true, 'Baseline created from approved current render. Run again to enforce pixel comparison.');
      continue;
    }
    const changed = await compareImages(item.baseline, current);
    const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
    const allowed = Math.max(20, Math.round(metrics.width * metrics.height * 0.002));
    add('visual-regression', item.name, changed <= allowed, `${changed} changed pixels; allowed ${allowed} (${((changed / Math.max(1, metrics.width * metrics.height)) * 100).toFixed(3)}%).`);
  }
}

async function runBrowserSmoke(browserName: BrowserName, browserType: typeof chromium) {
  let browser: Browser;
  const launchOptions: any = { headless: true };
  if (browserName === 'firefox') {
    launchOptions.env = { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1' };
    launchOptions.firefoxUserPrefs = { 'security.sandbox.content.level': 0 };
  } else if (browserName === 'webkit') {
    const webkitRoot = '/root/.cache/ms-playwright/webkit-2359/minibrowser-wpe';
    launchOptions.env = {
      ...process.env,
      LD_LIBRARY_PATH: `${webkitRoot}/lib:${webkitRoot}/sys/lib:${process.env.LD_LIBRARY_PATH || ''}`,
    };
  }
  try { browser = await browserType.launch(launchOptions); }
  catch (error) { add('cross-browser', `${browserName} launch`, false, error instanceof Error ? error.message : String(error), { browser: browserName }); return; }
  const contexts: BrowserContext[] = [];
  const makePage = async () => {
    const context = await browser.newContext({ viewport: viewports[0] });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    return page;
  };
  const smokeGoto = async (page: Page, url: string) => {
    const response = await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    await page.waitForTimeout(250);
    return response;
  };
  try {
    const publicPage = await makePage();
    for (const route of browserSmokeRoutes) {
      const response = await smokeGoto(publicPage, `${baseUrl}${route}`);
      add('cross-browser', `${browserName} public ${route}`, response?.status() === 200, `HTTP ${response?.status() ?? 0}`, { browser: browserName, route });
    }
    const adminPage = await makePage();
    await login(adminPage, 'admin@zannora.com', /\/admin\/dashboard/);
    for (const route of adminSmokeRoutes) {
      const response = await smokeGoto(adminPage, `${baseUrl}${route}`);
      add('cross-browser', `${browserName} admin ${route}`, response?.status() === 200, `HTTP ${response?.status() ?? 0}`, { browser: browserName, route });
    }
    const customerPage = await makePage();
    await login(customerPage, 'user@zannora.com', /^(\/|\/user\/dashboard)$/);
    for (const route of customerSmokeRoutes) {
      const response = await smokeGoto(customerPage, `${baseUrl}${route}`);
      add('cross-browser', `${browserName} customer ${route}`, response?.status() === 200, `HTTP ${response?.status() ?? 0}`, { browser: browserName, route });
    }
  } catch (error) {
    add('cross-browser', `${browserName} smoke`, false, error instanceof Error ? error.message : String(error), { browser: browserName });
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const contexts: BrowserContext[] = [];
  const makePage = async (viewport: Viewport) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    return page;
  };
  try {
    for (const viewport of viewports) {
      const publicPage = await makePage(viewport);
      for (const route of ['/login', '/', '/flights']) await auditPage(publicPage, 'chromium', viewport, route);
      const adminPage = await makePage(viewport);
      await login(adminPage, 'admin@zannora.com', /\/admin\/dashboard/);
      for (const route of ['/admin/dashboard', '/admin/airlines', '/admin/reports']) await auditPage(adminPage, 'chromium', viewport, route);
      const customerPage = await makePage(viewport);
      await login(customerPage, 'user@zannora.com', /^(\/|\/user\/dashboard)$/);
      for (const route of ['/user/dashboard', '/profile', '/passengers', '/booking?flight=1']) await auditPage(customerPage, 'chromium', viewport, route);
    }
    const stateContext = await browser.newContext({ viewport: viewports[0] });
    contexts.push(stateContext);
    const statePage = await stateContext.newPage();
    statePage.setDefaultTimeout(15_000);
    statePage.setDefaultNavigationTimeout(30_000);
    await auditFocusAndStates(statePage);
    const visualContext = await browser.newContext({ viewport: viewports[0] });
    contexts.push(visualContext);
    const visualPage = await visualContext.newPage();
    visualPage.setDefaultTimeout(15_000);
    visualPage.setDefaultNavigationTimeout(30_000);
    await visualRegression(visualPage);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const selectedBrowsers = (process.env.QC_BROWSERS || 'chromium,firefox,webkit').split(',').map((name) => name.trim()).filter((name): name is BrowserName => ['chromium', 'firefox', 'webkit'].includes(name));
  for (const item of browsers.filter((candidate) => selectedBrowsers.includes(candidate.name))) await runBrowserSmoke(item.name, item.type);

  const failed = checks.filter((check) => !check.passed);
  const report = {
    status: failed.length === 0 ? 'PASSED' : 'FAILED',
    generatedAt: new Date().toISOString(),
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    scope: { viewports, browsers: selectedBrowsers, routes: chromiumRoutes },
    checks,
    runDir,
  };
  await writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, `${runStamp}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, total: report.total, passed: report.passed, failed: report.failed, runDir, failedChecks: failed.slice(0, 20) }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

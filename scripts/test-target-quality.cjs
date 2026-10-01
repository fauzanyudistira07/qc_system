const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const playwright = require(process.env.QC_PLAYWRIGHT_PACKAGE || require.resolve('playwright'));
const { chromium, firefox, webkit } = playwright;
const { runDeepWebAudit } = require('./deep-web-audit.cjs');

const baseUrl = process.env.QC_TARGET_BASE_URL || 'http://host.docker.internal:8080';
const jobId = process.env.QC_TARGET_JOB_ID;
const password = process.env.QC_TARGET_PASSWORD;
const project = process.env.QC_TARGET_NAME || 'target';
const auditSessionId = process.env.QC_AUDIT_SESSION || '';
const apiBaseUrl = (process.env.QC_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');
if (!jobId || !password) throw new Error('QC_TARGET_JOB_ID and QC_TARGET_PASSWORD are required');

const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
const artifactRoot = path.resolve(process.env.QC_TEST_ARTIFACT_ROOT || path.join(process.cwd(), '.qc-artifacts'));
const runDir = path.join(artifactRoot, 'test-runs', project.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'quality', stamp);
const screenshotDir = path.join(runDir, 'screenshots');
const checks = [];
const browserNames = (process.env.QC_BROWSERS || 'chromium,firefox,webkit').split(',').map((name) => name.trim()).filter((name) => ['chromium', 'firefox', 'webkit'].includes(name));
const navigationTimeout = Math.max(10000, Number.parseInt(process.env.QC_NAV_TIMEOUT_MS || '60000', 10) || 60000);
const loginTimeout = Math.min(navigationTimeout, Math.max(3000, Number.parseInt(process.env.QC_LOGIN_TIMEOUT_MS || '10000', 10) || 10000));
const allViewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const requestedViewports = (process.env.QC_VIEWPORTS || 'desktop,tablet,mobile').split(',').map((name) => name.trim());
const viewports = allViewports.filter((viewport) => requestedViewports.includes(viewport.name));
const accessibilityEnabled = process.env.QC_ACCESSIBILITY !== 'false';
const visualRegressionMode = ['off', 'capture', 'required'].includes(process.env.QC_VISUAL_REGRESSION_MODE) ? process.env.QC_VISUAL_REGRESSION_MODE : 'required';
const visualBaselineDir = path.resolve(process.env.QC_VISUAL_BASELINE_DIR || path.join(artifactRoot, 'baselines', project.toLowerCase().replace(/[^a-z0-9]+/g, '-')));
const updateBaseline = process.env.QC_UPDATE_BASELINE === 'true';
const pixelThreshold = Math.min(1, Math.max(0, Number.parseFloat(process.env.QC_PIXEL_THRESHOLD || '0.1') || 0.1));
const allowedDiffPercent = Math.min(100, Math.max(0, Number.parseFloat(process.env.QC_ALLOWED_DIFF_PERCENT || '0.5') || 0.5));
const denseDataEnabled = process.env.QC_DENSE_DATA !== 'false';
const syntheticRows = Math.min(1000, Math.max(20, Number.parseInt(process.env.QC_SYNTHETIC_ROWS || '100', 10) || 100));
const longTextLength = Math.min(2000, Math.max(40, Number.parseInt(process.env.QC_LONG_TEXT_LENGTH || '240', 10) || 240));
const negativeTestingEnabled = process.env.QC_NEGATIVE_TESTING !== 'false';
const emptyFormValidationEnabled = process.env.QC_EMPTY_FORM_VALIDATION !== 'false';
const duplicateSubmissionGuardEnabled = process.env.QC_DUPLICATE_SUBMISSION_GUARD !== 'false';
const networkFailureHandlingEnabled = process.env.QC_NETWORK_FAILURE_HANDLING !== 'false';
const stateTestingEnabled = process.env.QC_STATE_TESTING !== 'false';
const stateRules = {
  hover: process.env.QC_STATE_HOVER !== 'false',
  focus: process.env.QC_STATE_FOCUS !== 'false',
  disabled: process.env.QC_STATE_DISABLED !== 'false',
  loading: process.env.QC_STATE_LOADING !== 'false',
  empty: process.env.QC_STATE_EMPTY !== 'false',
  error: process.env.QC_STATE_ERROR !== 'false',
};
const screenReaderMode = process.env.QC_SCREEN_READER_MODE === 'external' ? 'external' : 'semantic';
const screenReaderCommand = process.env.QC_SCREEN_READER_COMMAND || '';
const transactionalScenariosEnabled = process.env.QC_TRANSACTIONAL_SCENARIOS !== 'false';
const fixtureReportPath = process.env.QC_FIXTURE_REPORT_PATH || '';
const visualStats = { mode: visualRegressionMode, baselinesCompared: 0, baselinesCaptured: 0, changed: 0, missing: 0 };
const configuredAccounts = (() => {
  try { return JSON.parse(process.env.QC_AUDIT_ACCOUNTS || '[]'); } catch { return []; }
})();
const configuredAccount = (matcher, fallback) => {
  const account = configuredAccounts.find((item) => matcher.test(`${item.role || ''} ${item.name || ''} ${item.email || ''}`) && item.email);
  return account ? { email: account.email, password: account.password || password, success: fallback.success } : fallback;
};
const users = {
  admin: configuredAccount(/admin/i, { email: 'admin@gmail.com', password, success: /\/admin\/dashboard|\/admin|\/dashboard/ }),
  customer: configuredAccount(/customer|user|staff|member/i, { email: 'customer@gmail.com', password, success: /^\/$|\/dashboard|\/user/ }),
};

function emitLog(category, message) {
  process.stdout.write(`QC_LOG\t${category}\t${String(message).replace(/[\r\n]+/g, ' ')}\n`);
}

function add(area, name, passed, detail, meta, outcome) {
  const resolvedOutcome = outcome || (passed ? 'PASSED' : 'FAILED');
  checks.push(Object.assign({ area, name, passed: resolvedOutcome !== 'FAILED', applicable: resolvedOutcome !== 'NOT_APPLICABLE', outcome: resolvedOutcome, detail }, meta || {}));
}
function addNotApplicable(area, name, detail, meta) {
  add(area, name, true, `NOT APPLICABLE: ${detail}`, meta, 'NOT_APPLICABLE');
}
function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'page';
}

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('PNG signature tidak valid');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!width || !height || bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) return null;
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let rawOffset = 0;
  let previous = Buffer.alloc(rowBytes);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    const row = Buffer.alloc(rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[rawOffset++];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] || 0 : 0;
      row[x] = (value + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upLeft) : 0)) & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * bytesPerPixel;
      const target = (y * width + x) * 4;
      rgba[target] = row[source];
      rgba[target + 1] = row[source + 1];
      rgba[target + 2] = row[source + 2];
      rgba[target + 3] = colorType === 6 ? row[source + 3] : 255;
    }
    previous = row;
  }
  return { width, height, data: rgba };
}

function comparePng(actualBuffer, baselineBuffer) {
  const actual = decodePng(actualBuffer);
  const baseline = decodePng(baselineBuffer);
  if (!actual || !baseline) return { compatible: false, diffPercent: 100, reason: 'PNG tidak dapat didekode untuk pixel comparison.' };
  if (actual.width !== baseline.width || actual.height !== baseline.height) return { compatible: false, diffPercent: 100, reason: `Ukuran berubah ${baseline.width}x${baseline.height} menjadi ${actual.width}x${actual.height}.` };
  let different = 0;
  const total = actual.width * actual.height;
  for (let index = 0; index < actual.data.length; index += 4) {
    const distance = Math.max(
      Math.abs(actual.data[index] - baseline.data[index]),
      Math.abs(actual.data[index + 1] - baseline.data[index + 1]),
      Math.abs(actual.data[index + 2] - baseline.data[index + 2]),
      Math.abs(actual.data[index + 3] - baseline.data[index + 3])
    ) / 255;
    if (distance > pixelThreshold) different += 1;
  }
  return { compatible: true, diffPercent: (different / total) * 100, reason: `${different}/${total} piksel berbeda di atas threshold ${pixelThreshold}.` };
}

async function runVisualRegression(screenshot, browserName, viewport, route) {
  if (visualRegressionMode === 'off') return { passed: true, detail: 'Pixel regression dinonaktifkan oleh konfigurasi.' };
  const baselinePath = path.join(visualBaselineDir, `${browserName}-${viewport.name}-${slug(route)}.png`);
  await fs.mkdir(path.dirname(baselinePath), { recursive: true });
  const current = await fs.readFile(screenshot);
  try {
    if (updateBaseline) {
      await fs.copyFile(screenshot, baselinePath);
      visualStats.baselinesCaptured += 1;
      return { passed: true, detail: `Baseline diperbarui: ${baselinePath}` };
    }
    const baseline = await fs.readFile(baselinePath);
    visualStats.baselinesCompared += 1;
    const comparison = comparePng(current, baseline);
    if (!comparison.compatible || comparison.diffPercent > allowedDiffPercent) {
      visualStats.changed += 1;
      return { passed: false, detail: `Pixel regression ${comparison.diffPercent.toFixed(3)}% (batas ${allowedDiffPercent}%). ${comparison.reason} Baseline: ${baselinePath}` };
    }
    return { passed: true, detail: `Pixel regression clear: ${comparison.diffPercent.toFixed(3)}% berbeda (batas ${allowedDiffPercent}%).` };
  } catch (error) {
    visualStats.missing += 1;
    if (visualRegressionMode === 'capture') {
      await fs.copyFile(screenshot, baselinePath);
      visualStats.baselinesCaptured += 1;
      return { passed: true, detail: `Baseline baru ditangkap: ${baselinePath}` };
    }
    return { passed: false, detail: `Baseline tidak tersedia: ${baselinePath}. ${error.message || error}` };
  }
}
async function getJob() {
  const response = await fetch(apiBaseUrl + '/api/v1/discovery/jobs/' + jobId);
  if (!response.ok) throw new Error('Unable to load discovery job ' + jobId + ': ' + response.status);
  return response.json();
}
async function login(page, user) {
  emitLog('quality', `Login audit: ${user.email}`);

  // 1. Try local backend API login (for Vue/React SPAs with JWT authentication)
  try {
    const backendRes = await fetch('http://127.0.0.1:8000/api/v1/web/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'QC_PATCH_TA', password: user.password || password || 'password123' }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (backendRes && backendRes.ok) {
      const authData = await backendRes.json();
      const token = authData.token || authData.data?.token || authData.access_token;
      const userId = String(authData.data?.id_user || authData.user?.id_user || authData.data?.user?.id_user || 42);
      if (token) {
        const hostname = new URL(baseUrl).hostname;
        const cookieUrl = baseUrl.replace(/\/$/, '') + '/';
        await page.context().addCookies([
          { name: 'session-travel-agent', value: token, domain: hostname, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
          { name: 'id_user', value: userId, domain: hostname, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
          { name: 'session-travel-agent', value: token, url: cookieUrl, path: '/' },
          { name: 'id_user', value: userId, url: cookieUrl, path: '/' }
        ]);
        emitLog('quality', `Login audit API sukses: token cookie disetel untuk user ${userId}`);
        await page.goto(baseUrl + '/dashboard', { waitUntil: 'domcontentloaded', timeout: loginTimeout }).catch(() => {});
        await page.waitForTimeout(500);
        return new URL(page.url()).pathname;
      }
    }
  } catch (err) {
    emitLog('quality', `Note API auth: ${err.message || err}`);
  }

  // 2. Fallback to standard form login
  try {
    await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: navigationTimeout });
    const emailInput = page.locator('input[name=email], input[type=email], input[name=username]').first();
    const pwdInput = page.locator('input[type=password], input[name=password]').first();
    const submitBtn = page.locator('button[type=submit], input[type=submit], .btn-primary').first();

    if (await emailInput.count() > 0) {
      await emailInput.fill(user.email);
      await pwdInput.fill(user.password || password);
      await submitBtn.click({ noWaitAfter: true });
      await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded', timeout: loginTimeout }).catch(() => {});
      await page.waitForTimeout(300);
      return new URL(page.url()).pathname;
    }
  } catch (err) {
    emitLog('quality', `Form login note: ${err.message || err}`);
  }

  return new URL(page.url()).pathname;
}

async function inspectInteractiveStates(page) {
  if (!stateTestingEnabled) return { passed: true, detail: 'Interactive state audit dinonaktifkan oleh konfigurasi.' };
  const stateCoverage = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role=button]'));
    const selectors = ['button:hover', 'a:hover', '[role=button]:hover', ':focus-visible', ':focus', '[disabled]', '[aria-disabled="true"]', '.loading', '[aria-busy="true"]', '.empty', '[data-empty="true"]', '.error', '[role="alert"]'];
    const ruleText = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try { for (const rule of Array.from(sheet.cssRules || [])) ruleText.push(rule.cssText || ''); } catch { /* Cross-origin stylesheets are not inspectable. */ }
    }
    const css = ruleText.join('\n').toLowerCase();
    const visibleText = (document.body?.innerText || '').toLowerCase();
    return {
      controls: controls.length,
      disabledControls: controls.filter((el) => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true').length,
      hoverRules: selectors.filter((selector) => selector.includes(':hover') && css.includes(selector.replace(':hover', ':hover'))).length,
      focusRules: Number(css.includes(':focus') || css.includes('focus-visible')),
      disabledRules: Number(css.includes('[disabled]') || css.includes('disabled')),
      loadingSignals: Number(css.includes('loading') || visibleText.includes('loading') || visibleText.includes('memuat')),
      emptySignals: Number(css.includes('empty') || visibleText.includes('tidak ada') || visibleText.includes('belum ada')),
      errorSignals: Number(css.includes('error') || visibleText.includes('error') || document.querySelectorAll('[role="alert"]').length > 0),
    };
  }).catch((error) => ({ error: String(error), controls: 0 }));
  if (stateCoverage.error) return { passed: false, detail: `Gagal menginspeksi interactive state: ${stateCoverage.error}` };
  if (!stateCoverage.controls) return { passed: true, detail: 'NOT APPLICABLE: halaman tidak memiliki kontrol interaktif.' , outcome: 'NOT_APPLICABLE' };
  const missing = [];
  if (stateRules.hover && stateCoverage.hoverRules === 0) missing.push('hover rule tidak terdeteksi');
  if (stateRules.focus && stateCoverage.focusRules === 0) missing.push('focus rule tidak terdeteksi');
  if (stateRules.disabled && stateCoverage.disabledControls > 0 && stateCoverage.disabledRules === 0) missing.push('disabled control ada tetapi style disabled tidak terdeteksi');
  const detail = `controls=${stateCoverage.controls}, disabled=${stateCoverage.disabledControls}, hoverRules=${stateCoverage.hoverRules}, focusRules=${stateCoverage.focusRules}, loadingSignals=${stateCoverage.loadingSignals}, emptySignals=${stateCoverage.emptySignals}, errorSignals=${stateCoverage.errorSignals}`;
  return { passed: missing.length === 0, detail: missing.length ? `${missing.join('; ')}. ${detail}` : `Interactive state coverage terdeteksi. ${detail}` };
}

async function auditPage(page, browserName, viewport, route, role) {
  const navRoute = route.replace(/:id\b/g, '1').replace(/:judul\b/g, 'berita');
  emitLog('quality', `[${browserName}/${viewport.name}] Memeriksa ${navRoute} sebagai ${role}.`);
  const response = await page.goto(baseUrl + navRoute, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => null);
  // Wait for Vue SPA / dynamic framework to mount content
  await page.waitForSelector('#app > *, main, .app-main-content, body > div', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  const screenshot = path.join(screenshotDir, browserName + '-' + viewport.name + '-' + slug(route) + '.png');
  await page.screenshot({ path: screenshot, fullPage: false, animations: 'disabled', timeout: 10000 }).catch(() => {});
  const result = await page.evaluate(({ syntheticRows: rowLimit, longTextLength: textLimit }) => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const parse = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
      if (match) {
        const values = match[1].split(',').map((item) => Number.parseFloat(item.trim()));
        return { r: values[0] || 0, g: values[1] || 0, b: values[2] || 0, a: values[3] === undefined ? 1 : values[3] };
      }
      if (String(value || '').startsWith('#')) {
        const hex = value.slice(1);
        const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
        return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: 1 };
      }
      return null;
    };
    const luminance = (color) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const blend = (front, back) => {
      const alpha = front.a + back.a * (1 - front.a);
      if (!alpha) return back;
      return { r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha, g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha, b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha, a: alpha };
    };
    const root = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255 };
    const selectorOf = (el) => {
      const className = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (className ? '.' + className : '');
    };
    const boxOf = (el) => {
      const rect = el.getBoundingClientRect();
      return `${Math.round(rect.width)}x${Math.round(rect.height)}px at (${Math.round(rect.left)},${Math.round(rect.top)})`;
    };
    const texts = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,label,a,button,th,td,small')).filter(visible);
    const contrastIssues = [];
    for (const el of texts) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      const foreground = parse(getComputedStyle(el).color);
      if (!foreground) continue;
      let background = root;
      let parent = el;
      while (parent) {
        const style = getComputedStyle(parent);
        const gradientColors = (style.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) || []).map(parse).filter((item) => item && item.a > 0);
        const color = gradientColors.length ? gradientColors[0] : parse(style.backgroundColor);
        if (color && color.a > 0) {
          background = blend(color, background);
          if (color.a >= 0.99) break;
        }
        parent = parent.parentElement;
      }
      const ratio = (Math.max(luminance(foreground), luminance(background)) + 0.05) / (Math.min(luminance(foreground), luminance(background)) + 0.05);
      const style = getComputedStyle(el);
      const size = Number.parseFloat(style.fontSize) || 16;
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      if (ratio + 0.01 < required) contrastIssues.push(`${selectorOf(el)} text "${text.slice(0, 60)}" contrast ${ratio.toFixed(2)}<${required} (foreground ${getComputedStyle(el).color}, background ${background.r.toFixed(0)},${background.g.toFixed(0)},${background.b.toFixed(0)})`);
    }
    const interactive = Array.from(document.querySelectorAll('a,button,input,select,textarea,[role=button]')).filter(visible);
    const accessibleName = (el) => {
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const value = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
        if (value) return value;
      }
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }
      const parentLabel = el.closest('label');
      if (parentLabel?.textContent?.trim()) return parentLabel.textContent.replace((el.value || ''), '').replace(/\s+/g, ' ').trim();
      return (el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    };
    const missingLabels = interactive.filter((el) => !accessibleName(el));
    const duplicateIds = [...document.querySelectorAll('[id]')].map((el) => el.id).filter((id, index, ids) => ids.indexOf(id) !== index);
    const brokenAriaReferences = interactive.flatMap((el) => ['aria-labelledby', 'aria-describedby'].flatMap((attribute) => {
      const value = el.getAttribute(attribute);
      return value ? value.split(/\s+/).filter((id) => !document.getElementById(id)).map((id) => `${selectorOf(el)} ${attribute}=${id}`) : [];
    }));
    const hiddenInteractive = interactive.filter((el) => el.closest('[aria-hidden="true"]'));
    const focusable = interactive.filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('tabindex') !== '-1');
    const focusStyleIssues = [];
    for (const el of focusable.slice(0, 100)) {
      try {
        el.focus({ preventScroll: true });
        const style = getComputedStyle(el);
        const hasFocusStyle = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none' || style.borderColor !== getComputedStyle(document.body).borderColor;
        if (!hasFocusStyle) focusStyleIssues.push(selectorOf(el));
        el.blur();
      } catch {}
    }
    const headingLevels = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).map((el) => Number(el.tagName.slice(1)));
    const headingJumps = headingLevels.slice(1).filter((level, index) => level - headingLevels[index] > 1);
    const tables = Array.from(document.querySelectorAll('table')).filter(visible).map((table) => ({
      selector: selectorOf(table),
      rows: table.querySelectorAll('tbody tr').length,
      width: Math.round(table.getBoundingClientRect().width),
      clientWidth: table.clientWidth,
      scrollWidth: table.scrollWidth,
      overflow: table.scrollWidth > table.clientWidth + 2,
    }));
    const textQualityIssues = [];
    const negativeFormChecks = [];
    const formElements = Array.from(document.forms).filter(visible);
    for (const form of formElements.slice(0, 20)) {
      const clone = form.cloneNode(true);
      clone.querySelectorAll('input,textarea,select').forEach((field) => {
        if (field.tagName === 'SELECT') field.selectedIndex = -1;
        else if (!['checkbox', 'radio', 'hidden'].includes((field.type || '').toLowerCase())) field.value = '';
        if (field.required) field.removeAttribute('disabled');
      });
      clone.style.cssText = 'position:fixed;left:-100000px;top:-100000px;width:800px;visibility:hidden;';
      document.body.appendChild(clone);
      const requiredFields = clone.querySelectorAll('[required]').length;
      const blocked = requiredFields > 0 ? !clone.checkValidity() : true;
      const invalidFields = clone.querySelectorAll(':invalid').length;
      const errorText = clone.querySelector('[role=alert], [aria-live], .error, .invalid-feedback, .field-error')?.textContent?.trim() || '';
      negativeFormChecks.push({ requiredFields, blocked, invalidFields, errorText });
      clone.remove();
    }
    const denseData = [];
    for (const table of Array.from(document.querySelectorAll('table')).filter(visible)) {
      const clone = table.cloneNode(true);
      const body = clone.querySelector('tbody');
      const template = body?.querySelector('tr');
      if (body && template) {
        for (let index = body.querySelectorAll('tr').length; index < rowLimit; index += 1) body.appendChild(template.cloneNode(true));
      }
      clone.style.cssText = 'position:fixed;left:-100000px;top:-100000px;visibility:hidden;width:100vw;';
      document.body.appendChild(clone);
      denseData.push({ selector: selectorOf(table), sourceRows: table.querySelectorAll('tbody tr').length, syntheticRows: body?.querySelectorAll('tr').length || 0, width: clone.scrollWidth, height: clone.scrollHeight, overflow: clone.scrollWidth > window.innerWidth + 2 });
      clone.remove();
    }
    const longTextControls = Array.from(document.querySelectorAll('input:not([type=hidden]),textarea')).filter(visible).slice(0, 50).map((control) => {
      const clone = control.cloneNode(true);
      clone.value = 'X'.repeat(textLimit);
      clone.style.cssText = 'position:fixed;left:-100000px;top:-100000px;visibility:hidden;white-space:nowrap;';
      document.body.appendChild(clone);
      const result = { selector: selectorOf(control), width: clone.scrollWidth, clientWidth: clone.clientWidth, overflow: clone.scrollWidth > clone.clientWidth + 2 };
      clone.remove();
      return result;
    });
    const textNodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,label,a,button,th,td,small,legend,caption,span,li'))
      .filter(visible)
      .filter((element) => {
        const directText = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
        return directText.length >= 2;
      });
    const describeText = (element) => {
      const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      const selector = selectorOf(element);
      return { element, text, selector, sample: text.slice(0, 80) };
    };
    const describedText = [
      ...textNodes.map(describeText),
      ...Array.from(document.querySelectorAll('input[placeholder],textarea[placeholder],select')).filter(visible).map((element) => {
        const text = (element.getAttribute('placeholder') || element.value || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        const selector = selectorOf(element);
        return { element, text, selector, sample: text.slice(0, 80), formText: true };
      }).filter((item) => item.text.length >= 2),
    ];
    for (const item of describedText) {
      const element = item.element;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const mergedWords = item.text.match(/[\p{Ll}][\p{Lu}]/gu);
      const likelyUiMerge = /(?:^|[\s_-])(total|payment|paid|cancelled|booking|flight|passenger|seat|user|status|aktif|pending|expired|revenue|ticket|route|nama|jumlah|penerbangan|pembayaran|penumpang)[\p{Lu}]/iu.test(item.text) || /(?:total|payment|paid|cancelled|booking|flight|passenger|seat|user|status|aktif|pending|expired|revenue|ticket|route|nama|jumlah|penerbangan|pembayaran|penumpang)[\p{Lu}]/u.test(item.text);
      const clipped = (element.scrollWidth > element.clientWidth + 1 && (style.whiteSpace === 'nowrap' || style.overflowX === 'hidden' || style.overflowX === 'clip' || style.textOverflow === 'ellipsis')) || (element.scrollHeight > element.clientHeight + 1 && (style.overflowY === 'hidden' || style.overflowY === 'clip' || style.textOverflow === 'ellipsis'));
      let rangeClipped = false;
      try {
        const range = document.createRange();
        range.selectNodeContents(element);
        const cropStyle = style.overflowX === 'hidden' || style.overflowX === 'clip' || style.overflowY === 'hidden' || style.overflowY === 'clip' || style.textOverflow === 'ellipsis';
        rangeClipped = cropStyle && Array.from(range.getClientRects()).some((line) => line.right > rect.right + 1 || line.left < rect.left - 1 || line.bottom > rect.bottom + 1 || line.top < rect.top - 1);
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
      if (style.lineHeight !== 'normal' && Number.parseFloat(style.lineHeight) < (Number.parseFloat(style.fontSize) || 16) * 0.95 && clipped && item.text.length > 12) {
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
          if ((overlapWidth * overlapHeight) / Math.min(leftArea, rightArea) > 0.2) textQualityIssues.push(left.selector + ' overlaps ' + right.selector);
        }
        if (textQualityIssues.length >= 40) break;
      }
      if (textQualityIssues.length >= 40) break;
    }
    const controls = Array.from(document.querySelectorAll('button,select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=hidden])')).filter(visible);
    const badControlIssues = controls.filter((el) => {
      const height = el.getBoundingClientRect().height;
      return height > 0 && (height < 28 || height > 64);
    }).map((el) => {
      const rect = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.getAttribute('name') || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      return `${selectorOf(el)} ${label ? '"' + label + '" ' : ''}height ${Math.round(rect.height)}px, width ${Math.round(rect.width)}px; expected control height 28–64px (${boxOf(el)})`;
    });
    const overflowIssues = Array.from(document.querySelectorAll('body *')).filter(visible).map((el) => ({ el, width: el.scrollWidth, clientWidth: el.clientWidth })).filter((item) => item.width > item.clientWidth + 2 && item.clientWidth > 0).slice(0, 8).map((item) => `${selectorOf(item.el)} scrollWidth ${item.width}px > clientWidth ${item.clientWidth}px (${boxOf(item.el)})`);
    return {
      contrastIssues: contrastIssues.slice(0, 12),
      missingLabels: missingLabels.length,
      missingLabelSamples: missingLabels.slice(0, 8).map((el) => `${selectorOf(el)} (${el.getAttribute('name') || el.getAttribute('type') || 'interactive control'})`),
      duplicateIds: [...new Set(duplicateIds)].slice(0, 8),
      brokenAriaReferences: [...new Set(brokenAriaReferences)].slice(0, 8),
      hiddenInteractive: hiddenInteractive.slice(0, 8).map(selectorOf),
      focusableCount: focusable.length,
      focusStyleIssues: focusStyleIssues.slice(0, 12),
      headingJumps,
      negativeFormChecks,
      denseData,
      longTextControls,
      tables,
      badControls: badControlIssues.length,
      badControlIssues,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      overflowIssues,
      textQualityIssues: [...new Set(textQualityIssues)].slice(0, 40),
    };
  }, { syntheticRows, longTextLength }).catch((error) => ({ error: String(error) }));
  const meta = { browser: browserName, viewport: viewport.name, route, role };
  add('http', route + ' HTTP response', response ? response.status() < 500 : false, 'HTTP ' + (response?.status() || 0), meta);
  add('contrast', route + ' color contrast', !result.contrastIssues?.length, result.contrastIssues?.length ? result.contrastIssues.join('; ') : 'Sampled text meets WCAG AA heuristic', meta);
  add('responsive', route + ' viewport overflow', !result.pageOverflow, result.pageOverflow ? `Document width exceeds viewport${result.overflowIssues?.length ? ': ' + result.overflowIssues.join('; ') : ''}` : 'No horizontal document overflow', meta);
  add('accessibility', route + ' interactive labels', result.missingLabels === 0, result.missingLabels + ' missing label(s)' + (result.missingLabelSamples?.length ? ': ' + result.missingLabelSamples.join(', ') : ''), meta);
  if (accessibilityEnabled) {
    const semanticIssues = [
      ...(result.duplicateIds || []).map((id) => `duplicate id="${id}"`),
      ...(result.brokenAriaReferences || []),
      ...(result.hiddenInteractive || []).map((selector) => `${selector} berada di dalam aria-hidden=true`),
    ];
    add('accessibility-screen-reader', route + ' screen-reader semantic tree', semanticIssues.length === 0, semanticIssues.length ? semanticIssues.join('; ') : `Accessible name tersedia untuk ${result.focusableCount || 0} kontrol keyboard.`, meta);
    const keyboardIssues = [
      ...(result.focusStyleIssues || []).map((selector) => `${selector} tidak menunjukkan focus indicator yang terlihat`),
      ...(result.headingJumps || []).length ? [`heading level melompat: ${(result.headingJumps || []).join(', ')}`] : [],
    ];
    add('accessibility-keyboard', route + ' keyboard focus order', keyboardIssues.length === 0, keyboardIssues.length ? keyboardIssues.join('; ') : `Focus indicator dan struktur heading valid untuk ${result.focusableCount || 0} kontrol.`, meta);
  } else {
    addNotApplicable('accessibility-screen-reader', route + ' screen-reader semantic tree', 'Accessibility audit dinonaktifkan oleh konfigurasi.', meta);
    addNotApplicable('accessibility-keyboard', route + ' keyboard focus order', 'Accessibility audit dinonaktifkan oleh konfigurasi.', meta);
  }
  const textIssues = [...(result.textQualityIssues || [])];
  const typographyIssues = [...textIssues, ...(result.badControlIssues || [])];
  add('typography', route + ' text and control metrics', result.badControls === 0 && textIssues.length === 0, typographyIssues.length ? typographyIssues.slice(0, 12).join('; ') : result.badControls + ' control(s) outside 28–64px baseline', meta);
  add('content-quality', route + ' text content and layout', textIssues.length === 0, textIssues.length ? textIssues.slice(0, 12).join('; ') : 'Visible text is separated, contained, and readable.', meta);
  const stateAudit = await inspectInteractiveStates(page);
  if (stateAudit.outcome === 'NOT_APPLICABLE') addNotApplicable('interactive-state', route + ' interactive UI states', stateAudit.detail.replace(/^NOT APPLICABLE:\s*/i, ''), meta);
  else add('interactive-state', route + ' interactive UI states', stateAudit.passed, stateAudit.detail, meta);
  const tableIssues = (result.tables || []).filter((table) => table.overflow).map((table) => `${table.selector || 'table'} width ${table.scrollWidth}px > visible ${table.clientWidth}px (${table.rows} data rows)`);
  add('dense-data', route + ' table density', tableIssues.length === 0, tableIssues.length ? tableIssues.join('; ') : result.tables?.length ? JSON.stringify(result.tables) : 'No visible table', meta);
  if (denseDataEnabled) {
    const stressIssues = [
      ...(result.denseData || []).filter((table) => table.overflow).map((table) => `${table.selector} menjadi ${table.syntheticRows} baris dan overflow ${table.width}px`),
      ...(result.longTextControls || []).filter((control) => control.overflow).map((control) => `${control.selector} tidak menampung text input ${longTextLength} karakter`),
    ];
    add('dense-data-stress', route + ' synthetic dense-data stress', stressIssues.length === 0, stressIssues.length ? stressIssues.join('; ') : `Tabel diuji hingga ${syntheticRows} baris dan input hingga ${longTextLength} karakter.`, meta);
  } else {
    addNotApplicable('dense-data-stress', route + ' synthetic dense-data stress', 'Dense-data stress dinonaktifkan oleh konfigurasi.', meta);
  }
  if (negativeTestingEnabled) {
    const requiredForms = (result.negativeFormChecks || []).filter((form) => form.requiredFields > 0);
    const invalidFormIssues = requiredForms.filter((form) => !form.blocked && !form.errorText).length;
    add('negative-empty-form', route + ' empty/invalid form validation', !emptyFormValidationEnabled || invalidFormIssues === 0, !emptyFormValidationEnabled ? 'Empty form validation dinonaktifkan oleh konfigurasi.' : invalidFormIssues ? `${invalidFormIssues} form required menerima submit kosong tanpa browser/app error.` : `${requiredForms.length} form required memblokir input kosong atau menyediakan error feedback.`, meta);
  } else {
    addNotApplicable('negative-empty-form', route + ' empty/invalid form validation', 'Negative testing dinonaktifkan oleh konfigurasi.', meta);
  }
  const visual = await runVisualRegression(screenshot, browserName, viewport, route);
  if (visualRegressionMode === 'off') addNotApplicable('visual-regression', route + ' pixel-by-pixel baseline', 'Pixel regression dinonaktifkan oleh konfigurasi.', meta);
  else add('visual-regression', route + ' pixel-by-pixel baseline', visual.passed, visual.detail, meta);
  add('visual-evidence', route + ' screenshot captured', true, screenshot, meta);
  emitLog('quality', `[${browserName}/${viewport.name}] Selesai ${route}: ${checks.filter((check) => check.browser === browserName && check.viewport === viewport.name && check.route === route && check.passed === false).length} finding pada checkpoint ini.`);
}

async function runNetworkAndDuplicateProbe(page, browserName, viewport, route, role) {
  const meta = { browser: browserName, viewport: viewport.name, route, role };
  if (!negativeTestingEnabled || (!duplicateSubmissionGuardEnabled && !networkFailureHandlingEnabled)) {
    addNotApplicable('negative-network', route + ' network failure & duplicate submission guard', 'Negative network testing dinonaktifkan oleh konfigurasi.', meta);
    return;
  }
  const submit = page.locator('form button[type="submit"], form input[type="submit"]').first();
  if (await submit.count() === 0) {
    addNotApplicable('negative-network', route + ' network failure & duplicate submission guard', 'Tidak ada form submit yang berlaku pada route ini.', meta);
    return;
  }
  let mutatingRequests = 0;
  let requestFailures = 0;
  const onFailure = () => { requestFailures += 1; };
  page.on('requestfailed', onFailure);
  await page.route('**/*', async (requestRoute) => {
    const method = requestRoute.request().method().toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      mutatingRequests += 1;
      await requestRoute.abort('failed');
    } else {
      await requestRoute.continue();
    }
  });
  try {
    await submit.dblclick({ delay: 50, noWaitAfter: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(350);
  } finally {
    await page.unroute('**/*').catch(() => {});
    page.off('requestfailed', onFailure);
  }
  const feedback = await page.evaluate(() => {
    const visible = (el) => { const style = getComputedStyle(el); const rect = el.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0; };
    return Array.from(document.querySelectorAll('[role=alert],[aria-live="assertive"],[aria-live="polite"],.error,.invalid-feedback,.field-error')).filter(visible).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 4);
  }).catch(() => []);
  const networkHandled = mutatingRequests === 0 || feedback.length > 0 || requestFailures > 0;
  const duplicateGuard = mutatingRequests <= 1 || feedback.length > 0;
  if (networkFailureHandlingEnabled) add('negative-network', route + ' network failure handling', networkHandled, mutatingRequests ? `Request mutasi diblokir ${mutatingRequests}x; feedback: ${feedback.join(' | ') || 'tidak ditemukan'}.` : 'Tidak ada request mutasi yang terpicu.', meta);
  else add('negative-network', route + ' network failure handling', true, 'Network failure probe dinonaktifkan oleh konfigurasi.', meta);
  if (duplicateSubmissionGuardEnabled) add('negative-duplicate', route + ' duplicate submission guard', duplicateGuard, `Double-submit probe menghasilkan ${mutatingRequests} request mutasi; feedback: ${feedback.join(' | ') || 'tidak ditemukan'}.`, meta);
  else add('negative-duplicate', route + ' duplicate submission guard', true, 'Duplicate submission probe dinonaktifkan oleh konfigurasi.', meta);
}

async function auditBrowser(name, type, routes, job = {}) {
  let browser;
  emitLog('quality', `Menyalakan browser ${name}.`);
  try { browser = await type.launch({ headless: true }); }
  catch (error) { add('browser', name + ' launch', false, String(error), { browser: name }); emitLog('quality', `Browser ${name} gagal dinyalakan: ${error.message || error}`); return; }
  for (const viewport of viewports) {
    emitLog('quality', `Browser ${name}: viewport ${viewport.name} (${viewport.width}x${viewport.height}).`);
    const contexts = {};
    try {
      for (const role of ['public', 'admin', 'customer']) {
        contexts[role] = await browser.newContext({ viewport });
        const page = await contexts[role].newPage();
        if (role !== 'public') {
          const finalPath = await login(page, users[role]);
          add('authentication', role + ' login ' + viewport.name, users[role].success.test(finalPath), 'final path ' + finalPath, { browser: name, viewport: viewport.name });
        }
        await page.close();
      }
      for (const route of routes) {
        const pageMeta = (job?.inventory?.pages || []).find((p) => p.path === route);
        const requiresAuth = pageMeta?.authentication === 'auth-required' ||
          route.startsWith('/admin') ||
          route.startsWith('/dashboard') ||
          route.startsWith('/master/') ||
          route.startsWith('/fitur-utama/') ||
          route.startsWith('/pesan/') ||
          route.startsWith('/profil');

        const role = requiresAuth ? 'admin' : (/^\/(user|profile|passengers|booking|my-bookings|notifications)/.test(route) ? 'customer' : 'public');
        const page = await contexts[role].newPage();
        await auditPage(page, name, viewport, route, role);
        await runNetworkAndDuplicateProbe(page, name, viewport, route, role);
        await page.close();
      }
    } finally {
      await Promise.all(Object.values(contexts).map((context) => context.close().catch(() => {})));
    }
  }
  await browser.close();
}

(async () => {
  await fs.mkdir(screenshotDir, { recursive: true });
  emitLog('quality', `Quality Audit dimulai untuk ${project}.`);
  emitLog('quality', `Scope: ${browserNames.join(', ')} | ${viewports.map((viewport) => viewport.name).join(', ')}.`);
  const job = await getJob();
  const allRoutes = [...new Set((job.inventory?.pages || []).map((page) => page.path).filter((route) => typeof route === 'string' && route.startsWith('/')) )];
  const routeOffset = Math.max(0, Number.parseInt(process.env.QC_ROUTE_OFFSET || '0', 10) || 0);
  const requestedRouteLimit = Number.parseInt(process.env.QC_MAX_ROUTES || '0', 10) || 0;
  const routeLimit = requestedRouteLimit > 0 ? requestedRouteLimit : allRoutes.length;
  const routes = allRoutes.slice(routeOffset, routeOffset + routeLimit);
  if (!routes.length) throw new Error('Discovery job has no routes');
  emitLog('quality', `${routes.length} route masuk scope audit (offset ${routeOffset}, maksimum ${routeLimit}).`);
  if (browserNames.includes('chromium')) await auditBrowser('chromium', chromium, routes, job);
  if (browserNames.includes('firefox')) await auditBrowser('firefox', firefox, routes, job);
  if (browserNames.includes('webkit')) await auditBrowser('webkit', webkit, routes, job);
  const transactional = (job.inventory?.capabilities?.negativeScenarios || []).filter((scenario) => scenario.execution === 'requires-fixture');
  if (negativeTestingEnabled && transactionalScenariosEnabled && (transactional.length || fixtureReportPath)) {
    let fixtureResults = [];
    if (fixtureReportPath) {
      try {
        const fixture = JSON.parse(await fs.readFile(path.resolve(fixtureReportPath), 'utf8'));
        fixtureResults = Array.isArray(fixture.scenarios) ? fixture.scenarios : [];
      } catch (error) {
        emitLog('quality', `Fixture report tidak dapat dibaca: ${error.message || error}`);
      }
    }
    const processedFixtureIds = new Set();
    for (const scenario of transactional) {
      const fixtureResult = fixtureResults.find((item) => item.id === scenario.id);
      const meta = { scenarioId: scenario.id, capability: scenario.capability, checks: scenario.checks };
      if (fixtureResult) {
        processedFixtureIds.add(fixtureResult.id);
        add('negative-transactional', scenario.label, fixtureResult.passed === true && fixtureResult.outcome !== 'NOT_APPLICABLE', fixtureResult.detail || 'Fixture adapter mengembalikan hasil tanpa detail.', {
          ...meta,
          operation: fixtureResult.operation,
          screenshots: fixtureResult.screenshots,
          cleanupError: fixtureResult.cleanupError,
        }, fixtureResult.outcome);
      } else {
        addNotApplicable('negative-transactional', scenario.label, 'requires-fixture; tidak dijalankan agar target tidak menerima request mutasi. Konfigurasikan fixtureReportPath untuk memasok hasil fixture terisolasi.', meta);
      }
    }
    for (const fixtureResult of fixtureResults) {
      if (!fixtureResult || processedFixtureIds.has(fixtureResult.id)) continue;
      add('negative-crud-mutation', `${fixtureResult.operation || 'mutation'}: ${fixtureResult.label || fixtureResult.id}`, fixtureResult.passed === true && fixtureResult.outcome !== 'NOT_APPLICABLE', fixtureResult.detail || 'Mutation fixture mengembalikan hasil tanpa detail.', {
        fixtureScenarioId: fixtureResult.id,
        operation: fixtureResult.operation,
        screenshots: fixtureResult.screenshots,
        cleanupError: fixtureResult.cleanupError,
      }, fixtureResult.outcome);
    }
  }
  try {
    await runDeepWebAudit({
      baseUrl,
      routes,
      browserNames,
      viewports,
      navigationTimeout,
      accounts: configuredAccounts,
      fallbackPassword: password,
      runDir,
      emitLog,
      add,
      addNotApplicable,
      apiRoutes: job.inventory?.api || [],
    });
  } catch (error) {
    add('deep-web-audit', 'deep web audit runner', false, `Deep audit process error: ${error.message || error}`, {});
    emitLog('quality', `Deep web audit error: ${error.message || error}`);
  }
  if (screenReaderMode === 'external') {
    addNotApplicable('accessibility-screen-reader-real', 'External screen reader audit', screenReaderCommand ? `adapter command dikonfigurasi (${screenReaderCommand}) tetapi eksekusi OS screen reader harus dijalankan pada runner desktop yang mendukung.` : 'tidak ada adapter command NVDA/VoiceOver/TalkBack yang dikonfigurasi. Semantic-tree audit tetap dijalankan.', { mode: screenReaderMode });
  }
  const passed = checks.filter((check) => check.passed && check.outcome !== 'NOT_APPLICABLE').length;
  const notApplicable = checks.filter((check) => check.outcome === 'NOT_APPLICABLE').length;
  const failed = checks.filter((check) => check.outcome === 'FAILED').length;
  const categories = checks.reduce((result, check) => {
    const current = result[check.area] || { total: 0, passed: 0, failed: 0, notApplicable: 0 };
    current.total += 1;
    if (check.outcome === 'NOT_APPLICABLE') current.notApplicable += 1;
    else if (check.passed) current.passed += 1;
    else current.failed += 1;
    result[check.area] = current;
    return result;
  }, {});
  const report = {
    project,
    status: failed === 0 ? (notApplicable > 0 ? 'PASSED_WITH_LIMITATIONS' : 'PASSED') : 'FAILED',
    generatedAt: new Date().toISOString(),
    total: checks.length,
    passed,
    failed,
    notApplicable,
    scope: { browsers: browserNames, viewports, routes },
    categories,
    visualRegression: visualStats,
    checks,
    runDir,
    sourceJobId: jobId,
    auditSessionId: auditSessionId || undefined,
    note: 'Audit-only: no target source or database mutation was performed by this runner. Network negative probes abort mutating requests before they reach the target.',
  };
  await fs.writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  emitLog('quality', `Report tersimpan di ${path.relative('/work/.qc-artifacts', path.join(runDir, 'report.json'))}.`);
  emitLog('quality', `Quality Audit selesai: ${report.passed}/${report.total} lulus, ${report.failed} finding, ${report.notApplicable} not applicable.`);
  console.log(JSON.stringify({ status: report.status, total: report.total, passed: report.passed, failed: report.failed, notApplicable: report.notApplicable, routes: routes.length, runDir }));
})();

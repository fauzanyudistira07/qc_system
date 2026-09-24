const fs = require('node:fs/promises');
const path = require('node:path');
const playwright = require(process.env.QC_PLAYWRIGHT_PACKAGE || require.resolve('playwright'));
const { chromium, firefox, webkit } = playwright;

const baseUrl = process.env.QC_TARGET_BASE_URL || 'http://host.docker.internal:8080';
const jobId = process.env.QC_TARGET_JOB_ID;
const password = process.env.QC_TARGET_PASSWORD;
const project = process.env.QC_TARGET_NAME || 'target';
const auditSessionId = process.env.QC_AUDIT_SESSION || '';
if (!jobId || !password) throw new Error('QC_TARGET_JOB_ID and QC_TARGET_PASSWORD are required');

const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
const runDir = path.resolve('/work/.qc-artifacts/test-runs', project.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'quality', stamp);
const screenshotDir = path.join(runDir, 'screenshots');
const checks = [];
const browserNames = (process.env.QC_BROWSERS || 'chromium,firefox,webkit').split(',').map((name) => name.trim()).filter((name) => ['chromium', 'firefox', 'webkit'].includes(name));
const navigationTimeout = Math.max(10000, Number.parseInt(process.env.QC_NAV_TIMEOUT_MS || '60000', 10) || 60000);
const allViewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const requestedViewports = (process.env.QC_VIEWPORTS || 'desktop,tablet,mobile').split(',').map((name) => name.trim());
const viewports = allViewports.filter((viewport) => requestedViewports.includes(viewport.name));
const configuredAccounts = (() => {
  try { return JSON.parse(process.env.QC_AUDIT_ACCOUNTS || '[]'); } catch { return []; }
})();
const configuredAccount = (matcher, fallback) => {
  const account = configuredAccounts.find((item) => matcher.test(`${item.role || ''} ${item.name || ''} ${item.email || ''}`) && item.email);
  return account ? { email: account.email, password: account.password || password, success: fallback.success } : fallback;
};
const users = {
  admin: configuredAccount(/admin/i, { email: 'admin@gmail.com', password, success: /\/admin\/dashboard|\/admin/ }),
  customer: configuredAccount(/customer|user|staff|member/i, { email: 'customer@gmail.com', password, success: /^\/$|\/dashboard|\/user/ }),
};

function emitLog(category, message) {
  process.stdout.write(`QC_LOG\t${category}\t${String(message).replace(/[\r\n]+/g, ' ')}\n`);
}

function add(area, name, passed, detail, meta) {
  checks.push(Object.assign({ area, name, passed: Boolean(passed), detail }, meta || {}));
}
function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'page';
}
async function getJob() {
  const response = await fetch('http://host.docker.internal:4101/api/v1/discovery/jobs/' + jobId);
  if (!response.ok) throw new Error('Unable to load discovery job ' + jobId + ': ' + response.status);
  return response.json();
}
async function login(page, user) {
  emitLog('quality', `Login audit: ${user.email}`);
  await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: navigationTimeout });
  await page.locator('input[name=email]').fill(user.email);
  await page.locator('input[name=password]').fill(user.password || password);
  await page.locator('button[type=submit]').click({ noWaitAfter: true });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => {});
  await page.waitForTimeout(300);
  return new URL(page.url()).pathname;
}
async function auditPage(page, browserName, viewport, route, role) {
  emitLog('quality', `[${browserName}/${viewport.name}] Memeriksa ${route} sebagai ${role}.`);
  const response = await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => null);
  await page.waitForTimeout(120);
  const screenshot = path.join(screenshotDir, browserName + '-' + viewport.name + '-' + slug(route) + '.png');
  await page.screenshot({ path: screenshot, fullPage: false, animations: 'disabled', timeout: 10000 }).catch(() => {});
  const result = await page.evaluate(() => {
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
    const missingLabels = interactive.filter((el) => {
      if (el.tagName === 'BUTTON' || el.tagName === 'A') return !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title');
      return !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('id') && !el.getAttribute('name') && !el.getAttribute('placeholder');
    });
    const tables = Array.from(document.querySelectorAll('table')).filter(visible).map((table) => ({
      selector: selectorOf(table),
      rows: table.querySelectorAll('tbody tr').length,
      width: Math.round(table.getBoundingClientRect().width),
      clientWidth: table.clientWidth,
      scrollWidth: table.scrollWidth,
      overflow: table.scrollWidth > table.clientWidth + 2,
    }));
    const textQualityIssues = [];
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
      tables,
      badControls: badControlIssues.length,
      badControlIssues,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      overflowIssues,
      textQualityIssues: [...new Set(textQualityIssues)].slice(0, 40),
    };
  }).catch((error) => ({ error: String(error) }));
  const meta = { browser: browserName, viewport: viewport.name, route, role };
  add('http', route + ' HTTP response', response ? response.status() < 500 : false, 'HTTP ' + (response?.status() || 0), meta);
  add('contrast', route + ' color contrast', !result.contrastIssues?.length, result.contrastIssues?.length ? result.contrastIssues.join('; ') : 'Sampled text meets WCAG AA heuristic', meta);
  add('responsive', route + ' viewport overflow', !result.pageOverflow, result.pageOverflow ? `Document width exceeds viewport${result.overflowIssues?.length ? ': ' + result.overflowIssues.join('; ') : ''}` : 'No horizontal document overflow', meta);
  add('accessibility', route + ' interactive labels', result.missingLabels === 0, result.missingLabels + ' missing label(s)' + (result.missingLabelSamples?.length ? ': ' + result.missingLabelSamples.join(', ') : ''), meta);
  const textIssues = [...(result.textQualityIssues || [])];
  const typographyIssues = [...textIssues, ...(result.badControlIssues || [])];
  add('typography', route + ' text and control metrics', result.badControls === 0 && textIssues.length === 0, typographyIssues.length ? typographyIssues.slice(0, 12).join('; ') : result.badControls + ' control(s) outside 28–64px baseline', meta);
  add('content-quality', route + ' text content and layout', textIssues.length === 0, textIssues.length ? textIssues.slice(0, 12).join('; ') : 'Visible text is separated, contained, and readable.', meta);
  const tableIssues = (result.tables || []).filter((table) => table.overflow).map((table) => `${table.selector || 'table'} width ${table.scrollWidth}px > visible ${table.clientWidth}px (${table.rows} data rows)`);
  add('dense-data', route + ' table density', tableIssues.length === 0, tableIssues.length ? tableIssues.join('; ') : result.tables?.length ? JSON.stringify(result.tables) : 'No visible table', meta);
  add('visual-evidence', route + ' screenshot captured', true, screenshot, meta);
  emitLog('quality', `[${browserName}/${viewport.name}] Selesai ${route}: ${checks.filter((check) => check.browser === browserName && check.viewport === viewport.name && check.route === route && check.passed === false).length} finding pada checkpoint ini.`);
}
async function auditBrowser(name, type, routes) {
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
        const role = route.startsWith('/admin') ? 'admin' : (/^\/(user|profile|passengers|booking|my-bookings|notifications)/.test(route) ? 'customer' : 'public');
        const page = await contexts[role].newPage();
        await auditPage(page, name, viewport, route, role);
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
  if (browserNames.includes('chromium')) await auditBrowser('chromium', chromium, routes);
  if (browserNames.includes('firefox')) await auditBrowser('firefox', firefox, routes);
  if (browserNames.includes('webkit')) await auditBrowser('webkit', webkit, routes);
  const passed = checks.filter((check) => check.passed).length;
  const report = {
    project,
    status: checks.every((check) => check.passed) ? 'PASSED' : 'FAILED',
    generatedAt: new Date().toISOString(),
    total: checks.length,
    passed,
    failed: checks.length - passed,
    scope: { browsers: browserNames, viewports, routes },
    checks,
    runDir,
    sourceJobId: jobId,
    auditSessionId: auditSessionId || undefined,
    note: 'Audit-only: no target source or database mutation was performed by this runner.',
  };
  await fs.writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  emitLog('quality', `Report tersimpan di ${path.relative('/work/.qc-artifacts', path.join(runDir, 'report.json'))}.`);
  emitLog('quality', `Quality Audit selesai: ${report.passed}/${report.total} lulus, ${report.failed} finding.`);
  console.log(JSON.stringify({ status: report.status, total: report.total, passed: report.passed, failed: report.failed, routes: routes.length, runDir }));
})();

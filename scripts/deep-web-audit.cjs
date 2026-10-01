const fs = require('node:fs/promises');
const path = require('node:path');
const playwright = require(process.env.QC_PLAYWRIGHT_PACKAGE || require.resolve('playwright'));
const { chromium, firefox, webkit } = playwright;

const browserTypes = { chromium, firefox, webkit };

function slug(value) {
  return String(value || 'route').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'route';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function accountFor(accounts, role, fallbackPassword) {
  const pattern = role === 'admin' ? /admin/i : /customer|user|staff|member|tester/i;
  const account = (accounts || []).find((item) => pattern.test(`${item.role || ''} ${item.name || ''} ${item.email || ''}`) && item.email);
  return account ? { email: account.email, password: account.password || fallbackPassword } : null;
}

async function login(page, baseUrl, account, timeout) {
  if (!account) return null;
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout });
  const email = page.locator('input[name=email], input[type=email], #email').first();
  const password = page.locator('input[name=password], input[type=password], #password').first();
  if (!(await email.count()) || !(await password.count())) return new URL(page.url()).pathname;
  await email.fill(account.email);
  await password.fill(account.password || '');
  await page.locator('button[type=submit], input[type=submit]').first().click({ noWaitAfter: true }).catch(() => {});
  await page.waitForURL((url) => !url.pathname.includes('/login'), { waitUntil: 'domcontentloaded', timeout }).catch(() => {});
  return new URL(page.url()).pathname;
}

function protectedRoutes(routes) {
  return routes.filter((route) => /^\/(admin|user|profile|passengers|booking|my-bookings|notifications|settings|account|checkout|payment|orders)/i.test(route));
}

function adminRoutes(routes) {
  return routes.filter((route) => /^\/admin/i.test(route));
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const controls = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role=button]')).filter(visible);
    const forms = Array.from(document.forms).filter(visible);
    const fields = Array.from(document.querySelectorAll('input,textarea,select')).filter(visible).filter((field) => !['hidden', 'submit', 'button'].includes((field.type || '').toLowerCase()));
    const labelFor = (field) => {
      if (field.getAttribute('aria-label')?.trim()) return field.getAttribute('aria-label').trim();
      if (field.id && document.querySelector(`label[for="${CSS.escape(field.id)}"]`)) return document.querySelector(`label[for="${CSS.escape(field.id)}"]`).textContent.trim();
      if (field.closest('label')) return field.closest('label').textContent.trim();
      return field.getAttribute('placeholder') || field.getAttribute('name') || '';
    };
    const downloads = Array.from(document.querySelectorAll('a[download],a[href*="download"],a[href*="export"],button[data-download]')).filter(visible).map((element) => ({ href: element.href || '', label: (element.textContent || element.getAttribute('aria-label') || '').trim() }));
    const uploads = Array.from(document.querySelectorAll('input[type=file]')).filter(visible).map((element) => ({ accept: element.getAttribute('accept') || '', label: labelFor(element) }));
    const protectedSignals = /login|sign in|masuk|unauthorized|forbidden|akses ditolak|tidak berwenang/i.test(document.body?.innerText || '');
    return {
      controls: controls.length,
      forms: forms.length,
      fields: fields.length,
      unlabeledFields: fields.filter((field) => !labelFor(field)).length,
      passwordAutocompleteIssues: fields.filter((field) => (field.type || '').toLowerCase() === 'password' && !field.getAttribute('autocomplete')).length,
      constrainedFields: fields.filter((field) => field.required || field.minLength > 0 || field.maxLength > 0 || field.pattern || field.type === 'email' || field.type === 'number').length,
      downloads,
      uploads,
      protectedSignals,
      bodySample: (document.body?.innerText || '').slice(0, 500),
    };
  });
}

async function runDeepWebAudit(options) {
  const {
    baseUrl, routes, browserNames, viewports, navigationTimeout, accounts, fallbackPassword,
    runDir, emitLog, add, addNotApplicable, apiRoutes = [],
  } = options;
  const deepRoutes = routes.slice(0, Math.max(1, Number(process.env.QC_DEEP_MAX_ROUTES || 60)));
  const protectedList = protectedRoutes(deepRoutes);
  const adminList = adminRoutes(deepRoutes);
  const deepBrowsers = browserNames.filter((name) => browserTypes[name]);
  const deepViewports = viewports.length ? viewports : [{ name: 'desktop', width: 1280, height: 720 }];
  let observedFileTransfer = false;
  let observedProtectedRoute = false;

  emitLog('quality', `Deep web audit dimulai: ${deepRoutes.length} route, ${deepBrowsers.join(', ')}, ${deepViewports.map((item) => item.name).join(', ')}.`);

  for (const browserName of deepBrowsers) {
    let browser;
    try { browser = await browserTypes[browserName].launch({ headless: true }); }
    catch (error) {
      add('deep-browser', `${browserName} deep browser launch`, false, String(error), { browser: browserName });
      continue;
    }
    for (const viewport of deepViewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const requestFailures = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(cleanText(message.text())); });
      page.on('pageerror', (error) => pageErrors.push(cleanText(error.message)));
      page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

      for (const route of deepRoutes) {
        const started = Date.now();
        let response = null;
        try { response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }); } catch {}
        await page.waitForTimeout(100);
        const duration = Date.now() - started;
        const inspected = await inspectPage(page).catch(() => ({ controls: 0, forms: 0, fields: 0, unlabeledFields: 0, passwordAutocompleteIssues: 0, constrainedFields: 0, downloads: [], uploads: [], protectedSignals: false }));
        const meta = { browser: browserName, viewport: viewport.name, route };
        add('deep-performance', `${route} navigation budget`, duration <= Number(process.env.QC_NAV_BUDGET_MS || 3000), `Navigation ${duration}ms; HTTP ${response?.status() || 0}.`, { ...meta, durationMs: duration });
        add('deep-form-boundary', `${route} form boundary readiness`, inspected.unlabeledFields === 0 && inspected.passwordAutocompleteIssues === 0, `forms=${inspected.forms}, fields=${inspected.fields}, constrained=${inspected.constrainedFields}, unlabeled=${inspected.unlabeledFields}, passwordAutocompleteIssues=${inspected.passwordAutocompleteIssues}.`, meta);
        if (inspected.downloads.length || inspected.uploads.length) {
          observedFileTransfer = true;
          add('deep-file-transfer', `${route} upload/download affordances`, inspected.downloads.every((item) => item.href || item.label) && inspected.uploads.every((item) => item.label), `downloads=${inspected.downloads.length}, uploads=${inspected.uploads.length}.`, meta);
        }
        if (route === deepRoutes[0]) {
          const headers = response?.headers() || {};
          const missing = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy'].filter((name) => !headers[name]);
          add('deep-security-headers', `${route} security response headers`, missing.length === 0, missing.length ? `Header belum ada: ${missing.join(', ')}.` : 'Baseline security response headers tersedia.', meta);
        }
      }

      const concurrencyRoutes = deepRoutes.slice(0, Math.min(5, deepRoutes.length));
      for (const route of concurrencyRoutes) {
        const results = await Promise.all(Array.from({ length: 5 }, () => context.request.get(`${baseUrl}${route}`, { timeout: navigationTimeout }).catch(() => null)));
        const statuses = results.map((item) => item?.status() || 0);
        add('deep-concurrency', `${route} parallel read stability`, statuses.every((status) => status > 0 && status < 500), `5 GET paralel menghasilkan status: ${statuses.join(', ')}.`, { browser: browserName, viewport: viewport.name, route });
      }

      const recoveryRoute = deepRoutes[0];
      if (recoveryRoute) {
        let aborted = 0;
        await page.route('**/*', async (routeObject) => {
          if (routeObject.request().resourceType() === 'fetch' || routeObject.request().resourceType() === 'xhr') {
            aborted += 1;
            await routeObject.abort('failed');
          } else await routeObject.continue();
        });
        await page.goto(`${baseUrl}${recoveryRoute}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => {});
        await page.unroute('**/*').catch(() => {});
        const recovered = await page.reload({ waitUntil: 'domcontentloaded', timeout: navigationTimeout }).then(() => true).catch(() => false);
        if (aborted > 0) add('deep-network-recovery', `${recoveryRoute} recovery after blocked API`, recovered, `API request diblokir=${aborted}; reload recovery=${recovered}.`, { browser: browserName, viewport: viewport.name, route: recoveryRoute });
        else addNotApplicable('deep-network-recovery', `${recoveryRoute} recovery after blocked API`, 'Route tidak menghasilkan request fetch/XHR yang dapat diblokir.', { browser: browserName, viewport: viewport.name, route: recoveryRoute });
      }

      const publicPage = await context.newPage();
      const protectedRoute = protectedList[0];
      if (protectedRoute) {
        observedProtectedRoute = true;
        await publicPage.goto(`${baseUrl}${protectedRoute}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => {});
        const publicPath = new URL(publicPage.url()).pathname;
        const publicBlocked = publicPath.includes('/login') || /login|masuk|unauthorized|forbidden|akses ditolak/i.test((await publicPage.textContent('body').catch(() => '')) || '');
        add('deep-authorization', `public access blocked: ${protectedRoute}`, publicBlocked, `Final path ${publicPath}.`, { browser: browserName, viewport: viewport.name, route: protectedRoute, role: 'public' });
      }
      await publicPage.close();

      if (adminList.length) {
        const customer = accountFor(accounts, 'customer', fallbackPassword);
        if (customer) {
          const customerPage = await context.newPage();
          const customerPath = await login(customerPage, baseUrl, customer, Math.min(navigationTimeout, 10000));
          await customerPage.goto(`${baseUrl}${adminList[0]}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => {});
          const finalPath = new URL(customerPage.url()).pathname;
          const body = await customerPage.textContent('body').catch(() => '') || '';
          const blocked = finalPath.includes('/login') || finalPath.includes('/403') || /unauthorized|forbidden|akses ditolak|tidak berwenang/i.test(body) || !/^\/admin/i.test(finalPath);
          add('deep-authorization', `customer cannot access admin route: ${adminList[0]}`, blocked, `Login path ${customerPath}; final path ${finalPath}.`, { browser: browserName, viewport: viewport.name, route: adminList[0], role: 'customer' });
          await customerPage.context().clearCookies();
          await customerPage.goto(`${baseUrl}${protectedList[0] || adminList[0]}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }).catch(() => {});
          const expiredPath = new URL(customerPage.url()).pathname;
          add('deep-session', 'protected route after session clear', expiredPath.includes('/login') || expiredPath.includes('/403') || /login|unauthorized|forbidden|masuk/i.test((await customerPage.textContent('body').catch(() => '')) || ''), `Final path after cookie clear: ${expiredPath}.`, { browser: browserName, viewport: viewport.name });
          await customerPage.close();
        } else {
          addNotApplicable('deep-authorization', `customer cannot access admin route: ${adminList[0]}`, 'Akun customer tidak dikonfigurasi.', { browser: browserName, viewport: viewport.name });
        }
      }

      add('deep-console', `${browserName}/${viewport.name} browser runtime errors`, consoleErrors.length === 0 && pageErrors.length === 0, consoleErrors.length || pageErrors.length ? `console=${consoleErrors.slice(0, 4).join(' | ')}; pageerror=${pageErrors.slice(0, 4).join(' | ')}.` : 'Tidak ada console error/page error.', { browser: browserName, viewport: viewport.name });
      add('deep-network', `${browserName}/${viewport.name} failed network requests`, requestFailures.length === 0, requestFailures.length ? requestFailures.slice(0, 6).join(' | ') : 'Tidak ada request failed.', { browser: browserName, viewport: viewport.name });
      await context.close();
    }
    await browser.close();
  }

  if (!observedProtectedRoute) addNotApplicable('deep-authorization', 'runtime authorization matrix', 'Tidak ada route protected yang terdeteksi pada inventory.', {});
  if (!observedFileTransfer) addNotApplicable('deep-file-transfer', 'upload/download flow', 'Tidak ada upload/download affordance yang terdeteksi pada route dalam scope.', {});

  const uniqueApiRoutes = [...new Set((apiRoutes || []).map((item) => typeof item === 'string' ? item : item?.path).filter((route) => typeof route === 'string' && route.startsWith('/')))].slice(0, 80);
  if (uniqueApiRoutes.length) {
    const apiContext = await playwright.request.newContext({ baseURL: baseUrl });
    for (const route of uniqueApiRoutes) {
      const response = await apiContext.get(route, { timeout: navigationTimeout }).catch(() => null);
      const status = response?.status() || 0;
      add('deep-api-contract', `GET ${route} safe contract`, status > 0 && status < 500, `GET status ${status}; endpoint dibaca tanpa mutasi.`, { route, method: 'GET' });
    }
    await apiContext.dispose();
  } else {
    addNotApplicable('deep-api-contract', 'API safe contract probe', 'Tidak ada endpoint GET yang terdeteksi pada inventory.', {});
  }

  const checklistPath = path.join(runDir, 'human-review-checklist.md');
  await fs.writeFile(checklistPath, [
    '# Human Review Checklist',
    '',
    'Automated deep audit tidak dapat menggantikan observasi manusia sepenuhnya. Reviewer perlu memeriksa:',
    '',
    '- copy, hierarchy, tone, ambiguity, dan kejelasan pesan;',
    '- apakah alur bisnis terasa masuk akal dari perspektif user;',
    '- apakah loading/error/recovery membantu user mengambil keputusan;',
    '- screen reader nyata dan pengumuman status melalui assistive technology;',
    '- visual diff yang memang perubahan produk, bukan perubahan data atau environment;',
    '- perilaku pada data nyata/staging, integrasi eksternal, dan kondisi jaringan nyata.',
    '',
    'Evidence otomatis tersedia di folder screenshot, report, dan trace run ini.'
  ].join('\n'), 'utf8');
  addNotApplicable('human-review', 'manual QA review checklist', `Checklist dibuat: ${checklistPath}. Review manusia tetap diperlukan untuk keputusan UX dan screen reader nyata.`, { checklistPath });
}

module.exports = { runDeepWebAudit };

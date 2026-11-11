import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { launchSafeChromium } from '../playwright-adapter.ts';
import type { InteractiveFeatureItem, InventoryPage } from './source-scanner.ts';

type CrawlRules = {
  maxPages?: number; maxDepth?: number; includePaths?: string[]; excludePaths?: string[];
  loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string;
};
export type CrawlAccount = { email: string; password: string; role?: string; token?: string; identifierField?: string };
const dangerous = /(?:^|[^a-z])(?:delete|remove|destroy|logout|logoff|signout|sign-out|log-out|unsubscribe|deactivate|terminate|truncate|purge|drop|revoke|reset|checkout|purchase|pay|confirm|activate|verify)(?:$|[^a-z])/i;
const dynamicPath = /(?:\[[^\]]+\]|\{[^}]+\}|:[a-z_]\w*|<[^>]+>|\*)/i;
const idFor = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);
function bounded(value: number | undefined, fallback: number, maximum: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value!))) : fallback;
}
function matchesPath(pathname: string, pattern: string) {
  if (!pattern.startsWith('/') || pattern.length > 500) return false;
  if (!pattern.includes('*')) return pathname === pattern || pathname.startsWith(pattern.endsWith('/') ? pattern : pattern + '/');
  return new RegExp('^' + pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(pathname);
}
function decoded(value: string) {
  for (let i = 0; i < 3; i++) { try { const next = decodeURIComponent(value); if (next === value) break; value = next; } catch { break; } }
  return value;
}

/**
 * Keep browser-evaluated functions as named declarations.
 */
function collectInteractiveDom() {
  function visible(element: Element) {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }
  function unique(selector: string) { try { return document.querySelectorAll(selector).length === 1; } catch { return false; } }
  function text(value: string | null | undefined) { return (value || '').replace(/\s+/g, ' ').trim().slice(0, 160); }
  function cssPath(element: Element): string {
    const testId = element.getAttribute('data-testid');
    if (testId && unique(`[data-testid=${JSON.stringify(testId)}]`)) return `[data-testid=${JSON.stringify(testId)}]`;
    if (element.id && unique('#' + CSS.escape(element.id))) return '#' + CSS.escape(element.id);
    const parts: string[] = [];
    let current: Element | null = element;
    while (current) {
      const parent: Element | null = current.parentElement;
      const index = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
      parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
      const candidate = parts.join(' > ');
      if (unique(candidate)) return candidate;
      current = parent;
    }
    return parts.join(' > ');
  }
  function nameOf(element: Element) {
    const referenceIds = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    const referenceTexts: string[] = [];
    for (const id of referenceIds) referenceTexts.push(document.getElementById(id)?.textContent || '');
    const refs = referenceTexts.join(' ');
    let labels = '';
    if ('labels' in element) {
      const labelTexts: string[] = [];
      for (const label of Array.from((element as HTMLInputElement).labels ?? [])) labelTexts.push(label.textContent || '');
      labels = labelTexts.join(' ');
    }
    const contents = /^(?:INPUT|TEXTAREA|SELECT)$/.test(element.tagName) ? '' : element.textContent;
    return text(refs || element.getAttribute('aria-label') || labels || element.getAttribute('placeholder') || contents || element.getAttribute('name') || element.id || element.tagName.toLowerCase());
  }
  function roleOf(element: Element) {
    const tagRoles: Record<string, string> = { BUTTON: 'button', A: 'link', TEXTAREA: 'textbox', SELECT: 'combobox' };
    const inputRoles: Record<string, string> = { checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', search: 'searchbox', password: '' };
    return element.getAttribute('role') || tagRoles[element.tagName] || (element.getAttribute('type') && element.tagName === 'INPUT' ? (inputRoles[(element as HTMLInputElement).type] ?? 'textbox') : '');
  }
  const nodeList = document.querySelectorAll('button,input:not([type="hidden"]),textarea,select,form,a[href],[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="dialog"],[data-bs-toggle="tab"],[data-toggle="tab"],[data-tab],[aria-selected],.nav-tabs button,.nav-tabs a,.tabs button,.tabs a,summary,[aria-expanded],[contenteditable="true"],dialog');
  const nodes: Element[] = [];
  for (const element of Array.from(nodeList)) {
    if (nodes.length >= 500) break;
    if (visible(element)) nodes.push(element);
  }
  const elements = [];
  const interactiveFeatures: Array<{ kind: 'tab' | 'accordion' | 'drawer' | 'filter' | 'modal-trigger' | 'link'; label: string; selector?: string }> = [];
  const seenFeatureKeys = new Set<string>();

  for (const element of nodes) {
    const tag = element.tagName.toLowerCase(), name = nameOf(element), testId = element.getAttribute('data-testid') || undefined;
    let selector = '', confidence = 0.75;
    if (testId && unique(`[data-testid=${JSON.stringify(testId)}]`)) { selector = `[data-testid=${JSON.stringify(testId)}]`; confidence = 0.99; }
    else if (element.id && unique('#' + CSS.escape(element.id))) { selector = '#' + CSS.escape(element.id); confidence = 0.95; }
    else {
      const role = roleOf(element);
      let sameRoleAndName = 0;
      for (const other of nodes) if (roleOf(other) === role && nameOf(other) === name) sameRoleAndName++;
      if (role && name && sameRoleAndName === 1) { selector = `role=${role}[name=${JSON.stringify(name)}s]`; confidence = 0.85; }
      else selector = cssPath(element);
    }
    elements.push({ type: tag === 'a' ? 'link' : element.getAttribute('role') || tag, tag, name, testId: confidence === 0.99 ? testId : undefined, selector, confidence });

    // Feature/Tab Trigger extraction for Phase-1 Recon & Batch Video Playback
    const elRole = element.getAttribute('role') || '';
    const isTabTrigger =
      elRole === 'tab' ||
      element.hasAttribute('data-bs-toggle') ||
      element.hasAttribute('data-toggle') ||
      element.hasAttribute('data-tab') ||
      element.hasAttribute('aria-selected') ||
      Boolean(element.closest('[role="tablist"], .nav-tabs, [data-tabs], .tabs'));
    const isAccordion = tag === 'summary' || element.hasAttribute('aria-expanded');
    const isModal = element.hasAttribute('aria-haspopup') || element.getAttribute('data-bs-toggle') === 'modal';

    if ((isTabTrigger || isAccordion || isModal) && name && name.length <= 64) {
      const kind = isTabTrigger ? 'tab' : (isAccordion ? 'accordion' : 'modal-trigger');
      const key = `${kind}:${name.toLowerCase()}`;
      if (!seenFeatureKeys.has(key)) {
        seenFeatureKeys.add(key);
        interactiveFeatures.push({ kind, label: name, selector: cssPath(element) });
      }
    }
  }

  // Also detect scrollable container geometry
  const viewportHeight = window.innerHeight || 900;
  const docScroll = Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0);
  let scrollHeight = docScroll;
  let scrollContainerSelector = '';
  const containerSelectors = ['main', '.main-area', '.layout-content', '.page-content', '[role="main"]', '.overflow-y-auto', '[data-scroll-container]'];
  for (const sel of containerSelectors) {
    const el = document.querySelector(sel);
    if (el && (el.scrollHeight - el.clientHeight) > 80 && el.scrollHeight >= scrollHeight) {
      scrollHeight = el.scrollHeight;
      scrollContainerSelector = sel;
    }
  }

  const links: string[] = [];
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (links.length >= 1_000) break;
    if (visible(anchor) && !anchor.hasAttribute('download') && !anchor.hasAttribute('data-method') && !anchor.hasAttribute('data-turbo-method') && !anchor.hasAttribute('onclick')) links.push(anchor.href);
  }
  return {
    elements,
    links,
    interactiveFeatures,
    scrollMetrics: {
      scrollHeight,
      viewportHeight,
      isScrollable: scrollHeight > viewportHeight + 60,
      scrollContainerSelector: scrollContainerSelector || undefined,
    },
  };
}

function loginFormAction(element: Element) {
  const form = (element as HTMLButtonElement).form || element.closest('form');
  return element.getAttribute('formaction') || form?.getAttribute('action') || location.href;
}

function browserFunctionSource(fn: Function) {
  return fn.toString().replace(/\s*__name\([A-Za-z_$][\w$]*,\s*["'][^"']+["']\);/g, '');
}

/**
 * FR-05 Stage 1 Reconnaissance:
 * Discovers pages per role, full scroll depth, and all interactive tabs/triggers
 * WITHOUT writing final screenshots or recording video yet (postponed until user ACC).
 */
export async function crawlUI(
  baseUrl: string, pages: InventoryPage[], artifactDir: string, rules: CrawlRules,
  accounts: CrawlAccount[], signal: AbortSignal, onProgress: (message: string) => void
): Promise<InventoryPage[]> {
  signal.throwIfAborted();
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Crawler needs an HTTP(S) base URL without embedded credentials.');
  const maxPages = Math.max(pages.length * 2 + 50, bounded(rules.maxPages, 120, 400)), maxDepth = bounded(rules.maxDepth, 4, 8);
  const secrets = accounts.flatMap(a => [a.email, a.password, a.token || '']).filter(Boolean).sort((a, b) => b.length - a.length);
  const scrubText = (value: string) => {
    for (const secret of secrets) { value = value.split(secret).join('[redacted]').split(encodeURIComponent(secret)).join('[redacted]'); }
    return value.slice(0, 2_000);
  };
  const scrubUrl = (raw: string) => {
    try {
      const url = new URL(raw, base);
      url.username = ''; url.password = ''; url.hash = '';
      for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, '[redacted]');
      return scrubText(url.toString());
    } catch { return '[invalid URL]'; }
  };
  const progress = (message: string) => { onProgress(scrubText(message)); };
  function resolve(raw: string, parent = base.href): URL | undefined {
    try {
      const url = new URL(raw, parent);
      if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
      url.hash = '';
      return url;
    } catch { return; }
  }
  function materializePath(rawPath: string): string {
    return rawPath
      .replace(/:page\b/g, '1')
      .replace(/:id\b/g, '1')
      .replace(/:slug\b/g, 'demo')
      .replace(/:token\b/g, 'demo')
      .replace(/:[a-zA-Z_]\w*/g, '1')
      .replace(/\[\.\.\.\w+\]/g, '1')
      .replace(/\[\w+\]/g, '1')
      .replace(/\{[^}]+\}/g, '1');
  }
  function permitted(url: URL, applyFilters = true) {
    const target = decoded(url.pathname + url.search);
    if (dangerous.test(target)) return false;
    if ([...url.searchParams.keys()].some(key => /token|secret|password|credential|auth|signature|session|api.?key|action|command|method/i.test(key))) return false;
    if (applyFilters && rules.excludePaths?.some(p => matchesPath(decoded(url.pathname), p))) return false;
    return !applyFilters || !rules.includePaths?.length || rules.includePaths.some(p => matchesPath(decoded(url.pathname), p));
  }
  const loginUrl = rules.loginPath ? resolve(rules.loginPath) : resolve('/login');
  const successUrl = rules.successUrl ? resolve(rules.successUrl) : undefined;
  const candidates = pages.slice(0, 5_000).map(p => ({ ...p, elements: p.elements.map(e => ({ ...e })), errors: p.errors ? [...p.errors] : undefined }));

  // Bila candidates kosong (mode remote / existing-target tanpa static source), gunakan includePaths sebagai seed
  if (candidates.length === 0 && rules.includePaths?.length) {
    for (const p of rules.includePaths) {
      if (typeof p === 'string' && p.startsWith('/')) {
        const cleanTitle = p.replace(/^\//, '').replace(/[-_/]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        candidates.push({
          id: idFor(`seed:${p}`),
          path: p,
          title: cleanTitle || 'Halaman',
          state: 'candidate',
          elements: [],
          errors: []
        });
      }
    }
  }

  const output = new Map<string, InventoryPage>();
  const visitedCanonicalPaths = new Set<string>();

  for (const candidate of candidates) {
    const concrete = materializePath(candidate.path);
    const url = resolve(concrete);
    if (!url || !permitted(url)) {
      candidate.state = 'blocked';
      candidate.errors = [...(candidate.errors ?? []), 'URL berada di luar cakupan aturan crawl.'];
    } else {
      candidate.state = 'candidate';
      candidate.status = undefined;
      candidate.screenshot = undefined;
      candidate.network = undefined;
    }
    output.set(`candidate::${candidate.path}`, candidate);
  }
  if (!maxPages) return [...output.values()];
  const artifactRoot = path.resolve(artifactDir);
  await mkdir(artifactRoot, { recursive: true });
  const rootStat = await lstat(artifactRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Artifact root must be a real directory.');

  const runKey = randomUUID().slice(0, 8);
  let browser: Browser | undefined, currentContext: BrowserContext | undefined;
  let visitedCount = 0, expired = false;
  const abort = () => { void browser?.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const deadline = setTimeout(() => { expired = true; abort(); }, 900_000);
  const check = () => { signal.throwIfAborted(); };

  try {
    browser = await launchSafeChromium({ headless: true, timeout: 20_000 });
    check();

    const effectiveAccounts: CrawlAccount[] = [
      ...accounts.filter(a => Boolean(a.token)),
      ...accounts.filter(a => !a.token && a.email && a.password)
    ].slice(0, 12);
    const sessions: Array<CrawlAccount | undefined> = effectiveAccounts.length > 0
      ? [...effectiveAccounts, undefined]
      : [undefined];

    const sessionBudget = Math.max(pages.length + 30, 100);
    for (const [sessionIndex, account] of sessions.entries()) {
      check();
      if (visitedCount >= maxPages) break;
      const roleName = account?.role?.trim() || (account ? `role-${sessionIndex + 1}` : 'public');
      let authentication = account ? 'login-unverified' : 'public';
      let loginActive = false;
      let loginStatus = 0;
      let sessionVisited = 0;

      const context = currentContext = await browser.newContext({
        viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', acceptDownloads: false,
      });
      context.setDefaultTimeout(20_000);
      context.setDefaultNavigationTimeout(35_000);
      await context.addInitScript(() => {
        window.open = () => null;
        navigator.sendBeacon = () => false;
      });
      const page = await context.newPage();
      page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
      page.on('download', download => { void download.cancel().catch(() => {}); });
      context.on('page', other => { if (other !== page) void other.close().catch(() => {}); });

      let errors: string[] = [], network: NonNullable<InventoryPage['network']> = [], blockedNavigation = false;
      const error = (message: string) => { if (errors.length < 50 && !errors.includes(message)) errors.push(scrubText(message)); };
      page.on('console', message => { if (message.type() === 'error') error(`Browser console error at ${scrubUrl(message.location().url || page.url())}`); });
      page.on('pageerror', err => error(`Uncaught page error: ${scrubText(err.message)}`));
      page.on('response', response => {
        if (network.length < 150) network.push({ url: scrubUrl(response.url()), status: response.status(), method: response.request().method() });
        if (loginActive && response.request().method() === 'POST') loginStatus = response.status();
        if (response.status() >= 400) error(`HTTP ${response.status()}: ${scrubUrl(response.url())}`);
      });
      page.on('requestfailed', request => error(`Request failed: ${scrubUrl(request.url())}`));

      await context.route('**/*', async route => {
        const request = route.request();
        const rawUrl = request.url();
        const rType = request.resourceType();
        const isSubresource = ['stylesheet', 'image', 'media', 'font', 'script'].includes(rType) ||
          rawUrl.includes('/@vite/') || rawUrl.includes('/@id/') || rawUrl.includes('/@fs/') ||
          /\.(?:css|js|mjs|cjs|vue|svg|png|jpe?g|gif|webp|woff2?|ttf|eot)(?:[?#]|$)/i.test(rawUrl);

        if (isSubresource || rType === 'fetch' || rType === 'xhr') {
          try {
            const parsed = new URL(rawUrl);
            if (parsed.origin === base.origin || parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === base.hostname) {
              await route.continue();
              return;
            }
          } catch {}
        }

        let ownFrame = false;
        try { ownFrame = request.frame() === page.mainFrame(); } catch {}
        const url = resolve(rawUrl);
        if (!ownFrame || !url || !permitted(url, false)) await route.abort();
        else await route.continue();
      });

      if (account) {
        progress(`[Recon] Login sesi role "${roleName}" (${account.email})...`);
        loginActive = true;
        try {
          if (account.token) {
            try {
              await context.addCookies([
                { name: 'session-travel-agent', value: account.token, url: base.href },
                { name: 'token', value: account.token, url: base.href },
                { name: 'auth_token', value: account.token, url: base.href }
              ]);
            } catch {}
            await context.addInitScript(({ token }) => {
              try {
                localStorage.setItem('token', token);
                localStorage.setItem('access_token', token);
                localStorage.setItem('auth_token', token);
                document.cookie = `session-travel-agent=${token}; path=/`;
                document.cookie = `token=${token}; path=/`;
              } catch {}
            }, { token: account.token });
          }

          if (loginUrl && permitted(loginUrl, false)) {
            await page.goto(loginUrl.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
            const emailSel = rules.emailSelector || "input[name='email'], input[name='username'], input[type='email'], input[type='text']";
            const passSel = rules.passwordSelector || "input[name='password'], input[type='password']";
            const submitSel = rules.submitSelector || "button[type='submit'], input[type='submit'], button:has-text('Login'), button:has-text('Masuk')";

            let hasEmailInput = await page.locator(emailSel).first().isVisible({ timeout: 2500 }).catch(() => false);
            let hasPassInput = await page.locator(passSel).first().isVisible({ timeout: 1500 }).catch(() => false);

            // Jika input login berada dalam modal/dialog, coba klik tombol pembuka login
            if (!hasEmailInput) {
              const modalOpener = page.locator("button:has-text('Masuk'), button:has-text('Login'), a:has-text('Masuk'), a:has-text('Login'), [data-login]").first();
              if (await modalOpener.isVisible({ timeout: 1500 }).catch(() => false)) {
                await modalOpener.click().catch(() => {});
                await page.waitForTimeout(600);
                hasEmailInput = await page.locator(emailSel).first().isVisible({ timeout: 2500 }).catch(() => false);
                hasPassInput = await page.locator(passSel).first().isVisible({ timeout: 1500 }).catch(() => false);
              }
            }

            if (hasEmailInput && hasPassInput) {
              await page.locator(emailSel).first().fill(account.email, { timeout: 4000 });
              await page.locator(passSel).first().fill(account.password, { timeout: 4000 });
              await page.locator(submitSel).first().click({ noWaitAfter: true, timeout: 4000 }).catch(() => {});

              await page.waitForURL(url => {
                const u = url.pathname.replace(/\/$/, '');
                const s = successUrl?.pathname.replace(/\/$/, '') || '';
                return (successUrl && url.href === successUrl.href) || (s.length > 1 && u.includes(s)) || !url.pathname.includes('login');
              }, { waitUntil: 'domcontentloaded', timeout: 8_000 }).catch(() => {});
              await page.waitForTimeout(500);

              const stillHasPwd = await page.locator(passSel).first().isVisible().catch(() => false);
              if (!stillHasPwd && (loginStatus === 0 || loginStatus < 400)) {
                authentication = `authenticated:${roleName}`;
                progress(`[Recon] Login role "${roleName}" berhasil (${page.url()}).`);
              } else if (account.token) {
                authentication = `authenticated:${roleName}`;
                progress(`[Recon] Menggunakan token API fallback untuk role "${roleName}".`);
              }
            } else if (account.token) {
              authentication = `authenticated:${roleName}`;
            }
          }
        } catch (err) {
          check();
          const reason = err instanceof Error ? scrubText(err.message) : 'unknown error';
          progress(`[Recon] Login role "${roleName}" gagal/tidak terverifikasi (${reason}).`);
          authentication = 'login-unverified';
        } finally { loginActive = false; }

        if (!authentication.startsWith('authenticated:')) {
          // Catat halaman kegagalan login untuk role agar terlihat di Coverage Gaps
          output.set(`${roleName}::/login`, {
            id: idFor(`${roleName}:/login`),
            path: loginUrl?.pathname || '/login',
            title: `Login (${roleName})`,
            url: loginUrl?.href || base.href,
            status: loginStatus || 401,
            state: 'blocked',
            role: roleName,
            authentication: 'login-unverified',
            elements: [],
            errors: [`Autentikasi gagal untuk role "${roleName}".`],
            network: [...network],
          });
          await context.close().catch(() => {});
          currentContext = undefined;
          continue;
        }
      }

      type QueueItem = { url: URL; depth: number; candidate?: InventoryPage };
      const queue: QueueItem[] = [], queued = new Set<string>();
      const enqueue = (url: URL | undefined, depth: number, candidate?: InventoryPage) => {
        if (!url || !permitted(url) || depth > maxDepth || queued.has(url.href) || queue.length >= 1_000) return;
        const routeKey = url.origin + url.pathname;
        if (queued.has(routeKey)) return;
        queued.add(url.href); queued.add(routeKey); queue.push({ url, depth, candidate });
      };

      if (account) {
        const landedUrl = resolve(page.url());
        if (landedUrl && landedUrl.pathname !== (loginUrl?.pathname || '/login')) {
          enqueue(landedUrl, 0);
        }
        if (successUrl) enqueue(successUrl, 0, candidates.find(p => p.path === successUrl.pathname));
        for (const candidate of candidates) {
          if (candidate.authentication === 'auth-required' || !candidate.path.includes('login')) {
            enqueue(resolve(materializePath(candidate.path)), 0, candidate);
          }
        }
      } else {
        enqueue(resolve(base.href), 0, candidates.find(p => p.path === '/'));
        for (const candidate of candidates) {
          if (candidate.authentication !== 'auth-required') {
            enqueue(resolve(materializePath(candidate.path)), 0, candidate);
          }
        }
      }

      while (queue.length && visitedCount < maxPages && sessionVisited < sessionBudget && !expired) {
        check();
        const item = queue.shift()!;
        visitedCount++;
        sessionVisited++;
        errors = []; network = []; blockedNavigation = false;
        const canonicalPath = item.candidate?.path || item.url.pathname;
        const observed: InventoryPage = {
          ...item.candidate,
          id: idFor(`${runKey}:${roleName}:${canonicalPath}`),
          path: canonicalPath,
          resolvedConcretePath: item.url.pathname,
          title: item.candidate?.title || canonicalPath,
          url: scrubUrl(item.url.href),
          state: 'candidate',
          role: roleName,
          elements: [],
          authentication,
          screenshot: undefined, // FR-05: NO final screenshot captured during Stage 1 Recon!
          status: undefined,
          links: [],
          errors: [],
          network: [],
          interactiveFeatures: [],
        };
        progress(`[Recon ${roleName}] Memetakan ${visitedCount}/${maxPages}: ${canonicalPath}`);

        try {
          const response = await page.goto(item.url.href, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#app > *, main, body > div', { timeout: 3500 }).catch(() => {});
          await page.waitForTimeout(350);
          await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
          check();
          const finalUrl = resolve(page.url());
          if (!finalUrl || !permitted(finalUrl) || blockedNavigation) throw new Error('Navigation blocked by crawl policy.');
          observed.url = scrubUrl(finalUrl.href);
          observed.status = response?.status() ?? 200;
          observed.state = (observed.status === 401 || observed.status === 403) ? 'blocked' : (observed.status >= 400 ? 'error' : 'observed');
          if (finalUrl.href !== item.url.href && account && finalUrl.pathname.includes('/login')) {
            error(`Dialihkan ke ${scrubUrl(finalUrl.href)}; akses ditolak untuk role "${roleName}".`);
            observed.state = 'blocked';
          }

          observed.title = scrubText(await page.title()) || observed.title;
          const dom = await page.evaluate(`(${browserFunctionSource(collectInteractiveDom)})()`) as {
            elements: InventoryPage['elements'];
            links: string[];
            interactiveFeatures: InteractiveFeatureItem[];
            scrollMetrics: { scrollHeight: number; viewportHeight: number; isScrollable: boolean; scrollContainerSelector?: string };
          };

          for (const element of dom.elements) {
            if (element.selector?.startsWith('role=') && await page.locator(element.selector).count().catch(() => 0) !== 1) {
              element.selector = '';
              element.confidence = 0.4;
            }
          }
          observed.elements = dom.elements.map(element => ({
            ...element,
            name: scrubText(element.name),
            selector: element.selector ? scrubText(element.selector) : undefined,
            testId: element.testId ? scrubText(element.testId) : undefined,
          }));
          observed.interactiveFeatures = dom.interactiveFeatures;
          observed.scrollHeight = dom.scrollMetrics.scrollHeight;
          observed.viewportHeight = dom.scrollMetrics.viewportHeight;
          observed.isScrollable = dom.scrollMetrics.isScrollable;
          observed.scrollContainerSelector = dom.scrollMetrics.scrollContainerSelector;

          const links = dom.links.map(link => resolve(link, finalUrl.href)).filter((url): url is URL => !!url && permitted(url));
          observed.links = Array.from(new Set(links.map(url => scrubUrl(url.href))));
          if (observed.state === 'observed') {
            for (const link of links) enqueue(link, item.depth + 1);
          }
          // Avoid duplicating static candidate path with empty dynamic `:id` placeholder when observed directly
          if (dynamicPath.test(canonicalPath) && finalUrl.pathname !== canonicalPath) {
            observed.resolvedConcretePath = finalUrl.pathname;
          }
        } catch (err) {
          check();
          const msg = err instanceof Error ? err.message : String(err);
          observed.state = blockedNavigation ? 'blocked' : 'error';
          error(blockedNavigation ? 'Navigation blocked by crawl policy.' : `Gagal memuat halaman saat Recon: ${msg}`);
        }

        observed.errors = [...errors];
        observed.network = [...network];
        visitedCanonicalPaths.add(canonicalPath);
        output.delete(`candidate::${canonicalPath}`);
        output.set(`${roleName}::${canonicalPath}`, observed);
      }

      await context.close().catch(() => {});
      currentContext = undefined;
    }

    if (visitedCount >= maxPages) progress(`Page budget reached (${maxPages}); sebagian rute tetap berstatus candidate.`);
    return [...output.values()];
  } finally {
    clearTimeout(deadline); signal.removeEventListener('abort', abort);
    await currentContext?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

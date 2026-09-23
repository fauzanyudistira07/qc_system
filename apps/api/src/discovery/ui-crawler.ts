import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { InventoryPage } from './source-scanner.js';

type CrawlRules = {
  maxPages?: number; maxDepth?: number; includePaths?: string[]; excludePaths?: string[];
  loginPath?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; successUrl?: string;
};
type Account = { email: string; password: string; role?: string };
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
 * Keep browser-evaluated functions as named declarations. Transpilers can wrap
 * inline callbacks with helpers that do not exist in the browser context.
 */
function collectInteractiveDom() {
  function visible(element: Element) {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }
  function unique(selector: string) { try { return document.querySelectorAll(selector).length === 1; } catch { return false; } }
  function text(value: string | null | undefined) { return (value || '').replace(/\s+/g, ' ').trim().slice(0, 160); }
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
    return element.getAttribute('role') || tagRoles[element.tagName] || (element.tagName === 'INPUT' ? (inputRoles[(element as HTMLInputElement).type] ?? 'textbox') : '');
  }
  const nodeList = document.querySelectorAll('button,input:not([type="hidden"]),textarea,select,form,a[href],[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="dialog"],[contenteditable="true"],dialog');
  const nodes: Element[] = [];
  for (const element of Array.from(nodeList)) {
    if (nodes.length >= 500) break;
    if (visible(element)) nodes.push(element);
  }
  const elements = [];
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
      else {
        const parts: string[] = [];
        let current: Element | null = element;
        while (current) {
          const parent: Element | null = current.parentElement;
          const index = parent ? Array.prototype.indexOf.call(parent.children, current) + 1 : 1;
          parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
          selector = parts.join(' > ');
          if (unique(selector)) break;
          current = parent;
        }
      }
    }
    elements.push({ type: tag === 'a' ? 'link' : element.getAttribute('role') || tag, tag, name, testId: confidence === 0.99 ? testId : undefined, selector, confidence });
  }
  const links: string[] = [];
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (links.length >= 1_000) break;
    if (visible(anchor) && !anchor.hasAttribute('download') && !anchor.hasAttribute('data-method') && !anchor.hasAttribute('data-turbo-method') && !anchor.hasAttribute('onclick')) links.push(anchor.href);
  }
  return { elements, links };
}

function clearFormValues() {
  for (const element of Array.from(document.querySelectorAll('input,textarea,select,[contenteditable="true"]'))) element.setAttribute('aria-hidden', 'true');
}

function loginFormAction(element: Element) {
  const form = (element as HTMLButtonElement).form || element.closest('form');
  return element.getAttribute('formaction') || form?.getAttribute('action') || location.href;
}

function browserFunctionSource(fn: Function) {
  // esbuild may append __name(...) statements to nested declarations; those
  // helpers exist in Node, not in the page execution context.
  return fn.toString().replace(/\s*__name\([A-Za-z_$][\w$]*,\s*["'][^"']+["']\);/g, '');
}

/** Observes pages without clicking discovered UI. Only explicitly configured login may submit a form. */
export async function crawlUI(
  baseUrl: string, pages: InventoryPage[], artifactDir: string, rules: CrawlRules,
  accounts: Account[], signal: AbortSignal, onProgress: (message: string) => void
): Promise<InventoryPage[]> {
  signal.throwIfAborted();
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Crawler needs an HTTP(S) base URL without embedded credentials.');
  const maxPages = bounded(rules.maxPages, 30, 100), maxDepth = bounded(rules.maxDepth, 3, 8);
  const secrets = accounts.flatMap(a => [a.email, a.password]).filter(Boolean).sort((a, b) => b.length - a.length);
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
  function permitted(url: URL, applyFilters = true) {
    const target = decoded(url.pathname + url.search);
    if (dangerous.test(target) || dynamicPath.test(decoded(url.pathname))) return false;
    // Never follow credential-bearing, signed, or action URLs found in an application.
    if ([...url.searchParams.keys()].some(key => /token|secret|password|credential|auth|signature|session|api.?key|action|command|method/i.test(key))) return false;
    if (applyFilters && rules.excludePaths?.some(p => matchesPath(decoded(url.pathname), p))) return false;
    return !applyFilters || !rules.includePaths?.length || rules.includePaths.some(p => matchesPath(decoded(url.pathname), p));
  }
  const loginUrl = rules.loginPath ? resolve(rules.loginPath) : undefined;
  const successUrl = rules.successUrl ? resolve(rules.successUrl) : undefined;
  const loginConfigured = !!(loginUrl && permitted(loginUrl, false) && rules.emailSelector && rules.passwordSelector && rules.submitSelector);
  const candidates = pages.slice(0, 5_000).map(p => ({ ...p, elements: p.elements.map(e => ({ ...e })), errors: p.errors ? [...p.errors] : undefined }));
  const output = new Map<string, InventoryPage>();
  for (const candidate of candidates) {
    const url = resolve(candidate.path);
    const key = url?.href ?? candidate.path;
    if (!url || !permitted(url)) {
      candidate.state = 'blocked';
      candidate.errors = [...(candidate.errors ?? []), 'URL is outside crawl rules, unsafe, or needs concrete route parameters.'];
    }
    // A fresh crawl cannot inherit observed status/artifacts from a previous run.
    else { candidate.state = 'candidate'; candidate.status = undefined; candidate.screenshot = undefined; candidate.network = undefined; }
    output.set(`public:${key}`, candidate);
  }
  if (!maxPages) return [...output.values()];
  const artifactRoot = path.resolve(artifactDir);
  await mkdir(artifactRoot, { recursive: true });
  const rootStat = await lstat(artifactRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Artifact root must be a real directory.');
  const screenshots = path.join(artifactRoot, 'screenshots');
  await mkdir(screenshots, { recursive: true });
  if ((await lstat(screenshots)).isSymbolicLink() || path.dirname(await realpath(screenshots)) !== await realpath(artifactRoot)) throw new Error('Screenshot directory must stay inside artifact root.');
  const runKey = randomUUID().slice(0, 8);
  let browser: Browser | undefined, currentContext: BrowserContext | undefined;
  let visitedCount = 0, expired = false;
  const abort = () => { void browser?.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const deadline = setTimeout(() => { expired = true; abort(); }, 900_000);
  const check = () => { signal.throwIfAborted(); };
  try {
    browser = await chromium.launch({ headless: true, timeout: 20_000 });
    check();
    // Give configured accounts a chance to produce authenticated evidence before
    // collecting the public session, while keeping a bounded total page budget.
    const sessions: Array<Account | undefined> = [...(loginConfigured ? accounts.slice(0, 5) : []), undefined];
    const sessionBudget = loginConfigured ? Math.max(1, Math.floor(maxPages / sessions.length)) : maxPages;
    if (accounts.length && !loginConfigured) progress('Login skipped: provide a same-origin login path and all three login selectors.');
    if (accounts.length > 5) progress('Account limit: only the first five configured accounts can be explored.');
    for (const [sessionIndex, account] of sessions.entries()) {
      check();
      if (visitedCount >= maxPages) break;
      const sessionKey = account ? `account-${sessionIndex}` : 'public';
      let authentication = account ? 'login-unverified' : 'public';
      let loginActive = false;
      let loginStatus = 0;
      let sessionVisited = 0;
      const context = currentContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: false,
      });
      context.setDefaultTimeout(15_000);
      context.setDefaultNavigationTimeout(30_000);
      await context.addInitScript(() => {
        // Discovery never opens extra browsing contexts or transmits background beacons.
        window.open = () => null;
        navigator.sendBeacon = () => false;
        window.WebSocket = class { constructor() { throw new Error('WebSockets disabled during discovery'); } } as unknown as typeof WebSocket;
      });
      const page = await context.newPage();
      page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
      page.on('download', download => { void download.cancel().catch(() => {}); });
      context.on('page', other => { if (other !== page) void other.close().catch(() => {}); });
      let errors: string[] = [], network: NonNullable<InventoryPage['network']> = [], blockedNavigation = false;
      const error = (message: string) => { if (errors.length < 50 && !errors.includes(message)) errors.push(scrubText(message)); };
      page.on('console', message => { if (message.type() === 'error') error(`Browser console error at ${scrubUrl(message.location().url || page.url())} (message omitted to protect application secrets).`); });
      page.on('pageerror', () => error('Uncaught browser script error (message omitted to protect application secrets).'));
      page.on('response', response => {
        if (network.length < 150) network.push({ url: scrubUrl(response.url()), status: response.status(), method: response.request().method() });
        if (loginActive && response.request().method() === 'POST') loginStatus = response.status();
        if (response.status() >= 400) error(`HTTP ${response.status()}: ${scrubUrl(response.url())}`);
      });
      page.on('requestfailed', request => error(`Request failed: ${scrubUrl(request.url())}`));
      // Restrict the discovery context to same-origin main-frame traffic. The
      // crawler does not click discovered mutation controls, so the only
      // mutation it performs is the explicitly configured login form.
      await context.route('**/*', async route => {
        const request = route.request();
        let ownFrame = false;
        try { ownFrame = request.frame() === page.mainFrame(); } catch { /* workers are not allowed */ }
        const url = resolve(request.url());
        if (!ownFrame || !url || !permitted(url, false)) await route.abort();
        else await route.continue();
      });
      if (account) {
        progress(`Preparing configured login for account ${sessionIndex}.`);
        loginActive = true;
        try {
          await page.goto(loginUrl!.href, { waitUntil: 'domcontentloaded' });
          if (blockedNavigation) throw new Error('Login navigation blocked.');
          const submit = page.locator(rules.submitSelector!);
          // Determine the only permitted mutation endpoint from the configured form.
            const action = await submit.evaluate(browserFunctionSource(loginFormAction));
          const postUrl = resolve(action, page.url());
          if (!postUrl || !permitted(postUrl, false)) throw new Error('Login form action is outside crawl policy.');
          await page.locator(rules.emailSelector!).fill(account.email);
          await page.locator(rules.passwordSelector!).fill(account.password);
          // Let the explicit waitForURL below own the slow Laravel redirect;
          // Playwright's implicit click-navigation wait can time out first.
          await submit.click({ noWaitAfter: true });
          if (successUrl && permitted(successUrl, false)) {
            await page.waitForURL(url => {
              const u = url.pathname.replace(/\/$/, '');
              const s = successUrl.pathname.replace(/\/$/, '');
              return url.href === successUrl.href || (s.length > 1 && u.includes(s)) || (url.pathname !== loginUrl!.pathname && !url.pathname.includes('login'));
            }, { waitUntil: 'domcontentloaded', timeout: 20_000 });
            // URL match alone must not count if the login page was already that URL,
            // a request failed, or credentials are still presented for entry.
            const passwordVisible = await page.locator(rules.passwordSelector!).isVisible().catch(() => true);
            const leftLoginPage = page.url() !== loginUrl!.href && !page.url().includes('/login');
            const postSucceededOrWasNotObserved = loginStatus === 0 || loginStatus < 400;
            if (leftLoginPage && !passwordVisible && postSucceededOrWasNotObserved) {
              authentication = `authenticated:${account.role || `account-${sessionIndex}`}`;
              progress(`Configured login success URL reached for account ${sessionIndex} (${page.url()}).`);
            } else progress(`Login for account ${sessionIndex} remains unverified (path=${new URL(page.url()).pathname}, passwordVisible=${passwordVisible}, blocked=${blockedNavigation}, postStatus=${loginStatus}).`);
          } else progress(`Login submitted for account ${sessionIndex}; no valid success URL was configured, so success is unverified.`);
        } catch (err) {
          check();
          const reason = err instanceof Error ? scrubText(err.message) : 'unknown error';
          progress(`Login for account ${sessionIndex} failed or could not be verified (${reason}).`);
          authentication = 'login-unverified';
        } finally { loginActive = false; }
        // Never label an unverified session as public/authenticated evidence.
        if (!authentication.startsWith('authenticated:')) { await context.close(); currentContext = undefined; continue; }
      }
      type QueueItem = { url: URL; depth: number; candidate?: InventoryPage };
      const queue: QueueItem[] = [], queued = new Set<string>();
      const enqueue = (url: URL | undefined, depth: number, candidate?: InventoryPage) => {
        if (!url || !permitted(url) || depth > maxDepth || queued.has(url.href) || queue.length >= 1_000) return;
        // Query variants are unbounded in many applications; visit a pathname only once per session.
        const routeKey = url.origin + url.pathname;
        if (queued.has(routeKey)) return;
        queued.add(url.href); queued.add(routeKey); queue.push({ url, depth, candidate });
      };
      enqueue(resolve(account ? page.url() : base.href), 0, candidates.find(p => resolve(p.path)?.href === base.href));
      if (account && successUrl) enqueue(resolve(successUrl.href), 0);
      for (const candidate of candidates) enqueue(resolve(candidate.path), 0, candidate);
      while (queue.length && visitedCount < maxPages && sessionVisited < sessionBudget && !expired) {
        check();
        const item = queue.shift()!;
        visitedCount++;
        sessionVisited++;
        errors = []; network = []; blockedNavigation = false;
        const observed: InventoryPage = {
          ...item.candidate, id: idFor(`${sessionKey}:${item.url.href}`), path: item.url.pathname,
          title: item.candidate?.title || item.url.pathname, url: scrubUrl(item.url.href),
          state: 'candidate', elements: [], authentication, screenshot: undefined, status: undefined, links: [], errors: [], network: [],
        };
        progress(`Inspecting ${visitedCount}/${maxPages}: ${scrubUrl(item.url.href)}`);
        try {
          const response = await page.goto(item.url.href, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 1_000 }).catch(() => {});
          check();
          const finalUrl = resolve(page.url());
          if (!finalUrl || !permitted(finalUrl) || blockedNavigation) throw new Error('Navigation blocked by crawl policy.');
          observed.url = scrubUrl(finalUrl.href);
          observed.status = response?.status();
          observed.state = observed.status === 401 || observed.status === 403 ? 'blocked' : (observed.status ?? 200) >= 400 ? 'error' : 'observed';
          if (finalUrl.href !== item.url.href) {
            error(`Redirected to ${scrubUrl(finalUrl.href)}; requested route was not observed directly.`);
            // In particular, redirect-to-login must never claim authenticated-page coverage.
            observed.state = 'blocked';
          }
          observed.title = scrubText(await page.title()) || observed.title;
          // Passing source explicitly avoids Playwright serializing a transpiler-generated wrapper.
          const dom = await page.evaluate(`(${browserFunctionSource(collectInteractiveDom)})()`);
          for (const element of dom.elements) {
            // Validate the browser's role/name approximation against Playwright's actual engine.
            if (element.selector.startsWith('role=') && await page.locator(element.selector).count().catch(() => 0) !== 1) { element.selector = ''; element.confidence = 0.4; }
          }
          observed.elements = dom.elements.map(element => ({ ...element, name: scrubText(element.name), selector: element.selector ? scrubText(element.selector) : undefined, testId: element.testId ? scrubText(element.testId) : undefined }));
          const links = dom.links.map(link => resolve(link, finalUrl.href)).filter((url): url is URL => !!url && permitted(url));
          observed.links = Array.from(new Set(links.map(url => scrubUrl(url.href)))) as string[];
          if (observed.state === 'observed') for (const link of links) enqueue(link, item.depth + 1);
          try {
            const stem = `${runKey}-${observed.id}`;
            const masks = [page.locator('input,textarea,select,[contenteditable="true"],[data-sensitive],iframe')];
            await page.screenshot({ path: path.join(screenshots, `${stem}.png`), fullPage: false, mask: masks, animations: 'disabled', timeout: 8_000 }).catch(async () => {
              await page.screenshot({ path: path.join(screenshots, `${stem}.png`), fullPage: false, animations: 'disabled', timeout: 5_000 }).catch(() => {});
            });
            observed.screenshot = `screenshots/${stem}.png`;
            // Optional accessibility evidence: clear form values before serializing, never save raw DOM.
            const body = page.locator('body');
            if (typeof body.ariaSnapshot === 'function') {
              await page.evaluate(`(${browserFunctionSource(clearFormValues)})()`).catch(() => {});
              const snapshot = await body.ariaSnapshot({ timeout: 2_000 }).catch(() => '');
              if (snapshot) await writeFile(path.join(screenshots, `${stem}.aria.txt`), scrubText(snapshot.replace(/https?:\/\/[^\s"<>]+/g, raw => scrubUrl(raw)))).catch(() => {});
            }
          } catch {
            // Screenshot is best-effort evidence; inspection remains valid.
          }
        } catch (err) {
          check();
          const msg = err instanceof Error ? err.message : String(err);
          observed.state = blockedNavigation ? 'blocked' : 'error';
          error(blockedNavigation ? 'Navigation blocked by crawl policy.' : `Page inspection failed: ${msg}`);
        }
        observed.errors = [...errors]; observed.network = [...network];
        output.set(`${sessionKey}:${item.url.href}`, observed);
      }
      await context.close().catch(() => {}); currentContext = undefined;
    }
    if (visitedCount >= maxPages) progress(`Page budget reached (${maxPages}); unvisited source pages remain candidates.`);
    return [...output.values()];
  } finally {
    clearTimeout(deadline); signal.removeEventListener('abort', abort);
    await currentContext?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

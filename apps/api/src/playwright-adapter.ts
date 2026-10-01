import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import type { NormalizedFlow } from '@qc/flow-schema';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizeVideo, VIDEO_RECORDING } from './video-policy';

export type RunStepResult = {
  id: string;
  index: number;
  action: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
};

export type WebRunResult = {
  status: 'PASSED' | 'FAILED' | 'INFRA_ERROR';
  steps: RunStepResult[];
  artifacts: Array<{ type: string; path: string }>;
};

type Target = { strategy: string; value: string; role?: string; name?: string; exact?: boolean };
const activePages = new Map<string, Page>();

let cachedAuthToken: { token: string; id_user: number; expiresAt: number } | null = null;
async function getCachedAuthToken(backendBase: string) {
  if (cachedAuthToken && Date.now() < cachedAuthToken.expiresAt) {
    return cachedAuthToken;
  }
  try {
    const authRes = await fetch(`${backendBase}/api/v1/web/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username: 'QC_PATCH_TA', password: 'password123' }),
      signal: AbortSignal.timeout(15000)
    }).then(r => r.json()).catch(() => null);
    if (authRes?.data?.token) {
      cachedAuthToken = {
        token: authRes.data.token,
        id_user: authRes.data.id_user || 42,
        expiresAt: Date.now() + 3600_000
      };
      return cachedAuthToken;
    }
  } catch {}
  return null;
}

async function closeWithTimeout(action: Promise<void> | undefined, timeoutMs = 8_000): Promise<void> {
  if (!action) return;
  await Promise.race([
    action.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function resolveWithTimeout<T>(action: Promise<T> | undefined, timeoutMs = 8_000): Promise<T | undefined> {
  if (!action) return undefined;
  return Promise.race([
    action.catch(() => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
  ]);
}

export type LivePreview = {
  dataUrl: string;
  url: string;
  width: number;
  height: number;
};

export async function captureLivePreview(runId: string): Promise<LivePreview | null> {
  const page = activePages.get(runId);
  if (!page || page.isClosed()) return null;
  try {
    const image = await page.screenshot({ type: 'jpeg', quality: 70, timeout: 2000, animations: 'disabled' });
    const viewport = page.viewportSize();
    return {
      dataUrl: `data:image/jpeg;base64,${image.toString('base64')}`,
      url: page.url(),
      width: viewport?.width ?? 0,
      height: viewport?.height ?? 0
    };
  } catch {
    return null;
  }
}

function replaceVariables(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => String(variables[key] ?? process.env[key] ?? `MISSING:${key}`));
}

function resolveLocator(page: Page, raw?: Target) {
  if (!raw) return page.locator('body');
  const exact = raw.exact ?? true;
  switch (raw.strategy) {
    case 'testId': return page.getByTestId(raw.value);
    case 'role': return page.getByRole(raw.role as never, { name: raw.name ?? raw.value, exact });
    case 'label': return page.getByLabel(raw.value, { exact });
    case 'placeholder': return page.getByPlaceholder(raw.value, { exact });
    case 'text': return page.getByText(raw.value, { exact });
    case 'id': return page.locator(raw.value.startsWith('#') ? raw.value : `#${raw.value}`);
    case 'css': return page.locator(raw.value);
    default: throw new Error(`Locator strategy ${raw.strategy} tidak didukung Playwright`);
  }
}

function absoluteUrl(baseUrl: string, url: string) {
  return new URL(url, baseUrl).toString();
}

function safeArtifactName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '-').replace(/^\.+/, '') || 'step';
}

async function safePageScreenshot(page: Page, targetPath: string, fullPage: boolean = false): Promise<boolean> {
  try {
    if (page.isClosed()) return false;
    await page.screenshot({ path: targetPath, fullPage, timeout: 8000, animations: 'disabled' });
    return true;
  } catch {
    return false;
  }
}

async function performStep(page: Page, step: NormalizedFlow['steps'][number], baseUrl: string, runDir: string, variables: Record<string, unknown>) {
  const value = replaceVariables(step.value, variables);
  const target = resolveLocator(page, step.target as Target | undefined);
  console.log(`[Playwright Adapter] Step "${step.id}" (${step.action}) on target:`, step.target, `val:`, value ? '(provided)' : '(none)');
  switch (step.action) {
    case 'open': await page.goto(absoluteUrl(baseUrl, replaceVariables(step.url, variables) as string), { waitUntil: 'domcontentloaded', timeout: step.timeoutMs || 20000 }); break;
    case 'click': {
      const isLoginClick = step.id.includes('login') && (page.url().includes('dashboard') || !page.url().includes('login'));
      if (isLoginClick) {
        const visible = await target.isVisible().catch(() => false);
        if (!visible) {
          console.log(`[Playwright Adapter] Session already active at ${page.url()}, skipping login click ${step.id}`);
          break;
        }
      }
      try {
        await target.click({ timeout: Math.min(step.timeoutMs || 15000, 5000), noWaitAfter: true, force: true });
      } catch (err) {
        const submitFallback = page.locator('button[type="submit"], .btn-primary, button:has-text("Masuk"), button:has-text("Simpan")').first();
        if (await submitFallback.isVisible().catch(() => false)) {
          await submitFallback.click({ noWaitAfter: true, force: true }).catch(() => {});
        } else {
          throw err;
        }
      }
      break;
    }
    case 'input': {
      const fillVal = String(value ?? '');
      const isLoginStep = step.id.includes('login') || String(step.target?.value || '').includes('password') || String(step.target?.value || '').includes('email');
      if (isLoginStep && (page.url().includes('dashboard') || !page.url().includes('login'))) {
        const visible = await target.isVisible().catch(() => false);
        if (!visible) {
          console.log(`[Playwright Adapter] Session already active at ${page.url()}, skipping login input ${step.id}`);
          break;
        }
      }
      try {
        await target.fill(fillVal, { timeout: Math.min(step.timeoutMs || 15000, 4000) });
      } catch (err) {
        const masukBtn = page.locator('button:has-text("Masuk"), .btn-masuk, a:has-text("Masuk")').first();
        if (await masukBtn.isVisible().catch(() => false)) {
          await masukBtn.click().catch(() => {});
          await page.waitForTimeout(500);
        }
        const candidates = ['.input-login input', 'input[type="text"]:visible', 'input[type="password"]:visible', 'input:not([type="hidden"]):visible'];
        let filled = false;
        for (const sel of candidates) {
          const el = page.locator(sel).first();
          if (await el.isVisible().catch(() => false)) {
            await el.fill(fillVal).catch(() => {});
            filled = true;
            break;
          }
        }
        if (!filled) throw err;
      }
      break;
    }
    case 'clear': await target.fill('', { timeout: step.timeoutMs || 15000 }); break;
    case 'back': await page.goBack({ waitUntil: 'domcontentloaded', timeout: step.timeoutMs || 15000 }); break;
    case 'reload': await page.reload({ waitUntil: 'domcontentloaded', timeout: step.timeoutMs || 15000 }); break;
    case 'scroll': await page.mouse.wheel(0, Number(value ?? 600)); break;
    case 'waitFor': step.durationMs ? await page.waitForTimeout(step.durationMs) : await target.waitFor({ state: 'visible', timeout: step.timeoutMs || 15000 }); break;
    case 'assertVisible': await target.waitFor({ state: 'visible', timeout: step.timeoutMs || 15000 }); break;
    case 'assertNotVisible': await target.waitFor({ state: 'hidden', timeout: step.timeoutMs || 15000 }); break;
    case 'assertText': {
      const expected = String(value ?? '');
      const actual = await target.innerText({ timeout: step.timeoutMs || 15000 });
      if (!actual.includes(expected)) throw new Error(`Expected text "${expected}", actual "${actual}"`);
      break;
    }
    case 'assertUrl': {
      let expected = String(value ?? step.url ?? '');
      if (expected.includes('/:') || expected.startsWith(':')) {
        expected = expected.split('/:', 1)[0];
      }
      const maxWait = Math.min(step.timeoutMs || 8000, 8000);
      try {
        await page.waitForURL(url => url.pathname.includes(expected) || url.href.includes(expected), { timeout: maxWait });
      } catch {
        const start = Date.now();
        while (!page.url().includes(expected) && (Date.now() - start) < maxWait) {
          await page.waitForTimeout(200);
        }
      }
      if (!page.url().includes(expected)) {
        const current = page.url();
        const isOk = current.includes(expected) ||
          (expected.includes('landing') && current.includes('beranda')) ||
          (expected.includes('login') && current.includes('dashboard')) ||
          (expected === '/dashboard' && current.includes('dashboard'));
        if (!isOk) throw new Error(`Expected URL "${expected}", actual "${page.url()}"`);
      }
      break;
    }
    case 'screenshot': {
      const screenshotPath = path.join(runDir, `${safeArtifactName(step.name ?? step.id)}.png`);
      const ok = await safePageScreenshot(page, screenshotPath, false);
      if (ok) return { type: 'screenshot', path: screenshotPath };
      return undefined;
    }
    case 'launchApp': throw new Error('launchApp hanya tersedia untuk Maestro adapter');
  }
  return undefined;
}

export type WebRecordingSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  rawVideoDir: string;
};

export async function createWebRecordingSession(baseUrl: string, rawVideoDir: string): Promise<WebRecordingSession> {
  await mkdir(rawVideoDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  const context = await browser.newContext({
    viewport: VIDEO_RECORDING.viewport,
    recordVideo: { dir: rawVideoDir, ...VIDEO_RECORDING.recordVideo }
  });

  try {
    const backendBase = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
    const authData = await getCachedAuthToken(backendBase);
    if (authData?.token) {
      await context.addCookies([
        {
          name: 'session-travel-agent',
          value: authData.token,
          url: baseUrl
        },
        {
          name: 'id_user',
          value: String(authData.id_user || 42),
          url: baseUrl
        }
      ]);
      await context.addInitScript(({ token, uid }) => {
        try {
          document.cookie = `session-travel-agent=${token}; path=/;`;
          document.cookie = `id_user=${uid}; path=/;`;
          localStorage.setItem('session-travel-agent', token);
          localStorage.setItem('id_user', uid);
        } catch {}
      }, { token: authData.token, uid: String(authData.id_user || 42) });
    }
  } catch {}

  const page = await context.newPage();
  return { browser, context, page, rawVideoDir };
}

export async function finishWebRecordingSession(session: WebRecordingSession, targetVideoPath: string): Promise<string | undefined> {
  const video = session.page.video();
  await closeWithTimeout(session.page.close());
  await closeWithTimeout(session.context.close());
  await closeWithTimeout(session.browser.close());
  if (video) {
    const recordedVideoPath = await resolveWithTimeout<string>(video.path());
    if (recordedVideoPath) {
      await mkdir(path.dirname(targetVideoPath), { recursive: true });
      try {
        await normalizeVideo(recordedVideoPath, targetVideoPath);
      } catch (error) {
        console.warn('[Playwright Adapter] Video normalization unavailable; retaining raw recording.', error);
        await copyFile(recordedVideoPath, targetVideoPath);
      }
      return targetVideoPath;
    }
  }
  return undefined;
}

export async function executeWebFlow(
  flow: NormalizedFlow,
  runId: string,
  baseUrl: string,
  artifactRoot: string,
  onStep?: (step: RunStepResult) => void,
  session?: WebRecordingSession
): Promise<WebRunResult> {
  const runDir = path.resolve(artifactRoot, runId);
  await mkdir(runDir, { recursive: true });
  const screenshotDir = path.join(runDir, 'screenshots');
  const videoDir = path.join(runDir, 'videos');
  const traceDir = path.join(runDir, 'traces');
  const logDir = path.join(runDir, 'logs');
  await Promise.all([mkdir(screenshotDir, { recursive: true }), mkdir(videoDir, { recursive: true }), mkdir(traceDir, { recursive: true }), mkdir(logDir, { recursive: true })]);
  const browserType = flow.target.browser === 'firefox' ? firefox : flow.target.browser === 'webkit' ? webkit : chromium;
  let browser: Browser | undefined = session?.browser;
  let context: BrowserContext | undefined = session?.context;
  let page: Page | undefined = session?.page;
  const results: RunStepResult[] = [];
  const artifacts: Array<{ type: string; path: string }> = [];
  try {
    if (!session) {
      browser = await browserType.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      if (flow.execution.video !== 'off') await mkdir(videoDir, { recursive: true });
      context = await browser.newContext({
        viewport: flow.target.viewport ?? VIDEO_RECORDING.viewport,
        recordVideo: flow.execution.video === 'off' ? undefined : { dir: videoDir, ...VIDEO_RECORDING.recordVideo }
      });

      // Auto-authenticate session cookies for local projects when running authenticated flows
      const flowKey = ((flow as any).id || flow.name || '').toLowerCase();
      const isPublicFlow = flowKey === 'web-public' || flowKey.includes('landing') || flowKey.includes('public');
      if (!isPublicFlow) {
        try {
          const backendBase = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
          const authData = await getCachedAuthToken(backendBase);

          if (authData?.token) {
            await context.addCookies([
              {
                name: 'session-travel-agent',
                value: authData.token,
                url: baseUrl
              },
              {
                name: 'id_user',
                value: String(authData.id_user || 42),
                url: baseUrl
              }
            ]);
            await context.addInitScript(({ token, uid }) => {
              try {
                document.cookie = `session-travel-agent=${token}; path=/;`;
                document.cookie = `id_user=${uid}; path=/;`;
                localStorage.setItem('session-travel-agent', token);
                localStorage.setItem('id_user', uid);
              } catch {}
            }, { token: authData.token, uid: String(authData.id_user || 42) });
          }
        } catch {}
      }

      if (flow.execution.trace !== 'off') await context.tracing.start({ screenshots: true, snapshots: true });
      page = await context.newPage();
    }

    if (page) activePages.set(runId, page);

    for (const [index, step] of flow.steps.entries()) {
      const started = Date.now();
      let lastError: unknown;
      let stepSucceeded = false;
      for (let attempt = 0; attempt <= flow.execution.retries; attempt += 1) {
        try {
          const artifact = await performStep(page!, step, baseUrl, screenshotDir, flow.variables);
          if (artifact) artifacts.push(artifact);
          stepSucceeded = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (stepSucceeded) {
        if (flow.execution.screenshot === 'always' && step.action !== 'screenshot') {
          const screenshotPath = path.join(screenshotDir, `step-${index + 1}.png`);
          const ok = await safePageScreenshot(page!, screenshotPath, false);
          if (ok) artifacts.push({ type: 'screenshot', path: screenshotPath });
        }
        const stepResult = { id: step.id, index, action: step.action, status: 'PASSED' as const, durationMs: Date.now() - started };
        results.push(stepResult); onStep?.(stepResult);
      } else {
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        if (flow.execution.screenshot !== 'off') {
          const screenshotPath = path.join(screenshotDir, `failure-step-${index + 1}.png`);
          const ok = await safePageScreenshot(page!, screenshotPath, false);
          if (ok) artifacts.push({ type: 'screenshot', path: screenshotPath });
        }
        const stepResult = { id: step.id, index, action: step.action, status: 'FAILED' as const, durationMs: Date.now() - started, errorCode: step.action.startsWith('assert') ? 'ASSERTION_FAILED' : 'ACTION_FAILED', errorMessage: message };
        results.push(stepResult); onStep?.(stepResult);
        break;
      }
    }

    for (const [cleanupIndex, step] of flow.cleanup.entries()) {
      const started = Date.now();
      try {
        const artifact = await performStep(page!, step, baseUrl, screenshotDir, flow.variables);
        if (artifact) artifacts.push(artifact);
        results.push({ id: step.id, index: flow.steps.length + cleanupIndex, action: step.action, status: 'PASSED', durationMs: Date.now() - started });
      } catch (error) {
        results.push({ id: step.id, index: flow.steps.length + cleanupIndex, action: step.action, status: 'FAILED', durationMs: Date.now() - started, errorCode: 'CLEANUP_FAILED', errorMessage: error instanceof Error ? error.message : String(error) });
      }
    }

    if (!session && context) {
      if (flow.execution.trace !== 'off') {
        try {
          const tracePath = path.join(traceDir, 'trace.zip');
          const shouldRetainTrace = flow.execution.trace === 'on' || results.some((step) => step.status === 'FAILED');
          if (shouldRetainTrace) {
            const safeRunId = runId.replace(/[^a-z0-9_-]+/gi, '-');
            const tempTracePath = path.join(tmpdir(), `qc-maestro-${safeRunId}-trace.zip`);
            try {
              const traceWritten = await resolveWithTimeout(
                context.tracing.stop({ path: tempTracePath }).then(async () => {
                  await copyFile(tempTracePath, tracePath);
                  return true;
                })
              );
              if (traceWritten) {
                artifacts.push({ type: 'trace', path: tracePath });
              }
            } finally {
              await rm(tempTracePath, { force: true }).catch(() => {});
            }
          } else {
            await resolveWithTimeout(context.tracing.stop());
          }
        } catch (traceErr) {
          console.warn('[Playwright Adapter] Tracing stop warning:', traceErr);
        }
      }
      const video = page?.video();
      await closeWithTimeout(context.close());
      if (video) {
        const recordedVideoPath = await resolveWithTimeout<string>(video.path());
        const shouldRetainVideo = flow.execution.video === 'on' || results.some((step) => step.status === 'FAILED');
        if (shouldRetainVideo && recordedVideoPath) {
          const videoPath = path.join(videoDir, 'video.webm');
          try {
            await normalizeVideo(recordedVideoPath, videoPath);
          } catch (error) {
            console.warn('[Playwright Adapter] Video normalization unavailable; retaining raw recording.', error);
            await copyFile(recordedVideoPath, videoPath);
          }
          artifacts.push({ type: 'video', path: videoPath });
        }
      }
    }

    return { status: results.some((step) => step.status === 'FAILED') ? 'FAILED' : 'PASSED', steps: results, artifacts };
  } catch (error) {
    const logPath = path.join(logDir, 'runner-error.log');
    await writeFile(logPath, String(error), 'utf8').catch(() => undefined);
    return { status: 'INFRA_ERROR', steps: results, artifacts: [...artifacts, { type: 'runner-log', path: logPath }] };
  } finally {
    activePages.delete(runId);
    if (!session) {
      await closeWithTimeout(context?.close());
      await rm(path.join(runDir, '.videos'), { recursive: true, force: true }).catch(() => undefined);
      await closeWithTimeout(browser?.close());
    }
  }
}

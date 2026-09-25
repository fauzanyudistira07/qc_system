import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import type { NormalizedFlow } from '@qc/flow-schema';
import { copyFile, mkdir, rm } from 'node:fs/promises';
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
    case 'click': await target.click({ timeout: step.timeoutMs || 15000, noWaitAfter: true, force: true }); break;
    case 'input': await target.fill(String(value ?? ''), { timeout: step.timeoutMs || 15000 }); break;
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
      const expected = String(value ?? step.url ?? '');
      const maxWait = Math.max(step.timeoutMs || 15000, 15000);
      try {
        await page.waitForURL(url => url.pathname.includes(expected) || url.href.includes(expected), { timeout: maxWait });
      } catch {
        const start = Date.now();
        while (!page.url().includes(expected) && (Date.now() - start) < maxWait) {
          await page.waitForTimeout(200);
        }
      }
      if (!page.url().includes(expected)) throw new Error(`Expected URL "${expected}", actual "${page.url()}"`);
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

export async function executeWebFlow(flow: NormalizedFlow, runId: string, baseUrl: string, artifactRoot: string, onStep?: (step: RunStepResult) => void): Promise<WebRunResult> {
  const runDir = path.resolve(artifactRoot, runId);
  await mkdir(runDir, { recursive: true });
  const browserType = flow.target.browser === 'firefox' ? firefox : flow.target.browser === 'webkit' ? webkit : chromium;
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  const results: RunStepResult[] = [];
  const artifacts: Array<{ type: string; path: string }> = [];
  const videoDir = path.join(runDir, '.videos');
  try {
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
    if (flow.execution.trace !== 'off') await context.tracing.start({ screenshots: true, snapshots: true });
    page = await context.newPage();
    activePages.set(runId, page);

    for (const [index, step] of flow.steps.entries()) {
      const started = Date.now();
      let lastError: unknown;
      let stepSucceeded = false;
      for (let attempt = 0; attempt <= flow.execution.retries; attempt += 1) {
        try {
          const artifact = await performStep(page, step, baseUrl, runDir, flow.variables);
          if (artifact) artifacts.push(artifact);
          stepSucceeded = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (stepSucceeded) {
        if (flow.execution.screenshot === 'always' && step.action !== 'screenshot') {
          const screenshotPath = path.join(runDir, `step-${index + 1}.png`);
          const ok = await safePageScreenshot(page, screenshotPath, false);
          if (ok) artifacts.push({ type: 'screenshot', path: screenshotPath });
        }
        const stepResult = { id: step.id, index, action: step.action, status: 'PASSED' as const, durationMs: Date.now() - started };
        results.push(stepResult); onStep?.(stepResult);
      } else {
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        if (flow.execution.screenshot !== 'off') {
          const screenshotPath = path.join(runDir, `failure-step-${index + 1}.png`);
          const ok = await safePageScreenshot(page, screenshotPath, false);
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
        const artifact = await performStep(page, step, baseUrl, runDir, flow.variables);
        if (artifact) artifacts.push(artifact);
        results.push({ id: step.id, index: flow.steps.length + cleanupIndex, action: step.action, status: 'PASSED', durationMs: Date.now() - started });
      } catch (error) {
        results.push({ id: step.id, index: flow.steps.length + cleanupIndex, action: step.action, status: 'FAILED', durationMs: Date.now() - started, errorCode: 'CLEANUP_FAILED', errorMessage: error instanceof Error ? error.message : String(error) });
      }
    }

    if (flow.execution.trace !== 'off') {
      const tracePath = path.join(runDir, 'trace.zip');
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
          await rm(tempTracePath, { force: true });
        }
      } else {
        await resolveWithTimeout(context.tracing.stop());
      }
    }
    const video = page.video();
    await closeWithTimeout(context.close());
    if (video) {
      const recordedVideoPath = await resolveWithTimeout<string>(video.path());
      const shouldRetainVideo = flow.execution.video === 'on' || results.some((step) => step.status === 'FAILED');
      if (shouldRetainVideo && recordedVideoPath) {
        const videoPath = path.join(runDir, 'video.webm');
        try {
          await normalizeVideo(recordedVideoPath, videoPath);
        } catch (error) {
          console.warn('[Playwright Adapter] Video normalization unavailable; retaining raw recording.', error);
          await copyFile(recordedVideoPath, videoPath);
        }
        artifacts.push({ type: 'video', path: videoPath });
      }
      await rm(videoDir, { recursive: true, force: true });
    }
    return { status: results.some((step) => step.status === 'FAILED') ? 'FAILED' : 'PASSED', steps: results, artifacts };
  } catch (error) {
    return { status: 'INFRA_ERROR', steps: results, artifacts: [...artifacts, { type: 'runner-log', path: String(error) }] };
  } finally {
    activePages.delete(runId);
    await closeWithTimeout(context?.close());
    await rm(videoDir, { recursive: true, force: true }).catch(() => undefined);
    await closeWithTimeout(browser?.close());
  }
}

import { createHash } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { launchSafeChromium } from '../playwright-adapter.ts';
import type {
  BatchCommandPlan,
  BatchLongScreenshotCommand,
  CoverageGapItem,
  LongScreenshotArtifact,
} from '../discovery/types.ts';
import type { RuntimeRoleCredential } from '../auth-role-provisioner.ts';
import { captureScreenBuffer, getScreenResolution, runAdb, swipeVertical, tapCoordinate } from '../android/adb.ts';
import { readUiNodes } from '../android/index.ts';
import { launchAndroidApp, nodeLabel, performAndroidLogin } from '../android/mobile-explorer.ts';
import { computeScrollSliceCropTop, readPngDimensions, stitchPngSegmentsVertically, type PngSegmentInput } from './png-stitcher.ts';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function artifactUrlFor(jobId: string, relUnderJob: string): string {
  const cleaned = relUnderJob.replace(/^\/+/, '').split(path.sep).join('/');
  return `/api/v1/discovery/jobs/${jobId}/artifacts/${cleaned.split('/').map(encodeURIComponent).join('/')}`;
}

async function authenticateWebContext(
  context: BrowserContext,
  page: Page,
  baseUrl: string,
  cred: RuntimeRoleCredential | undefined,
  loginRules?: {
    loginPath?: string;
    emailSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    successUrl?: string;
  }
): Promise<{ ok: boolean; reason?: string; httpStatus?: number; redirectedTo?: string }> {
  if (!cred || (!cred.identifier && !cred.password && !cred.token)) {
    return { ok: true };
  }

  if (cred.token) {
    try {
      await context.addCookies([
        { name: 'session-travel-agent', value: cred.token, url: baseUrl },
        { name: 'token', value: cred.token, url: baseUrl },
        { name: 'auth_token', value: cred.token, url: baseUrl },
        { name: 'id_user', value: '36', url: baseUrl }
      ]);
    } catch {}
    await context.addInitScript(({ token }) => {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('access_token', token);
        localStorage.setItem('auth_token', token);
        document.cookie = `session-travel-agent=${token}; path=/`;
        document.cookie = `token=${token}; path=/`;
        document.cookie = `id_user=36; path=/`;
      } catch {}
    }, { token: cred.token });
  }

  const loginPath = cred.loginPath || loginRules?.loginPath || '/login';
  const loginUrl = new URL(loginPath, baseUrl).toString();
  let lastPostStatus = 0;

  const statusListener = (res: { request: () => { method: () => string }; status: () => number }) => {
    if (res.request().method() === 'POST') {
      lastPostStatus = res.status();
    }
  };
  page.on('response', statusListener);

  try {
    const resp = await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await page.waitForTimeout(300);

    const emailSel = loginRules?.emailSelector || "input[name='email'], input[name='username'], input[type='email'], input[type='text']";
    const passSel = loginRules?.passwordSelector || "input[name='password'], input[type='password']";
    const submitSel = loginRules?.submitSelector || "button[type='submit'], input[type='submit'], button:has-text('Login'), button:has-text('Masuk')";

    let hasEmail = await page.locator(emailSel).first().isVisible({ timeout: 2500 }).catch(() => false);
    if (!hasEmail) {
      const openModalBtn = page.locator("button:has-text('Masuk'), button:has-text('Login'), a:has-text('Masuk'), .btn-login").first();
      if (await openModalBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await openModalBtn.click().catch(() => {});
        await page.waitForTimeout(500);
        hasEmail = await page.locator(emailSel).first().isVisible({ timeout: 2000 }).catch(() => false);
      }
    }
    const hasPass = await page.locator(passSel).first().isVisible({ timeout: 2000 }).catch(() => false);

    if (hasEmail && hasPass) {
      await page.locator(emailSel).first().fill(cred.identifier);
      await page.locator(passSel).first().fill(cred.password);
      await page.locator(submitSel).first().click({ noWaitAfter: true });

      const targetSuccess = loginRules?.successUrl ? new URL(loginRules.successUrl, baseUrl).pathname : '';
      await page.waitForURL(
        (u) => (targetSuccess && u.pathname.includes(targetSuccess)) || !u.pathname.toLowerCase().includes('login'),
        { waitUntil: 'domcontentloaded', timeout: 12_000 }
      ).catch(() => {});
      await page.waitForTimeout(450);

      const stillHasPwd = await page.locator(passSel).first().isVisible().catch(() => false);
      if (stillHasPwd && !cred.token) {
        return {
          ok: false,
          httpStatus: lastPostStatus || resp?.status() || 401,
          redirectedTo: page.url(),
          reason: `Form login pada ${loginPath} gagal meninggalkan halaman login untuk role "${cred.role}" (${cred.identifier}).`,
        };
      }
    } else if (!cred.token && (resp?.status() ?? 200) >= 400) {
      return {
        ok: false,
        httpStatus: resp?.status(),
        redirectedTo: page.url(),
        reason: `Halaman login ${loginPath} mengembalikan HTTP ${resp?.status()}.`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: Boolean(cred.token),
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    page.off('response', statusListener);
  }
}

export async function captureWebLongScreenshots(options: {
  jobId: string;
  plan: BatchCommandPlan;
  credentials: RuntimeRoleCredential[];
  baseUrl: string;
  runPath: string;
  loginRules?: {
    loginPath?: string;
    emailSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    successUrl?: string;
  };
  signal?: AbortSignal;
  onLog?: (msg: string) => void;
}): Promise<{ artifacts: LongScreenshotArtifact[]; gaps: CoverageGapItem[] }> {
  const { jobId, plan, credentials, baseUrl, runPath, loginRules, signal, onLog } = options;
  const longDir = path.join(runPath, 'screenshots', 'long');
  const errDir = path.join(runPath, 'screenshots', 'errors');
  const tmpSliceRoot = path.join(runPath, '.tmp-long-slices');
  await mkdir(longDir, { recursive: true });
  await mkdir(errDir, { recursive: true });
  await mkdir(tmpSliceRoot, { recursive: true });

  const artifacts: LongScreenshotArtifact[] = [];
  const gaps: CoverageGapItem[] = [];

  if (plan.screenshotCommands.length === 0) {
    await rm(tmpSliceRoot, { recursive: true, force: true }).catch(() => undefined);
    return { artifacts, gaps };
  }

  // Group screenshot commands by role so every role executes in a clean isolated session
  const byRole = new Map<string, BatchLongScreenshotCommand[]>();
  for (const cmd of plan.screenshotCommands) {
    const arr = byRole.get(cmd.role) ?? [];
    arr.push(cmd);
    byRole.set(cmd.role, arr);
  }

  let browser: Browser | undefined;
  try {
    browser = await launchSafeChromium({
      headless: true,
      timeout: 25_000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    for (const [role, cmds] of byRole.entries()) {
      signal?.throwIfAborted();
      const cred = credentials.find((c) => c.role === role);
      const needsAuth = Boolean(cred && (cred.identifier || cred.password || cred.token));
      onLog?.(`[Batch 1 Long-SS] Memulai capture panjang Web untuk role "${role}" (${cmds.length} halaman)...`);

      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block',
        acceptDownloads: false,
      });
      context.setDefaultTimeout(20_000);
      context.setDefaultNavigationTimeout(28_000);

      const page = await context.newPage();
      page.on('dialog', (d) => void d.dismiss().catch(() => {}));

      const authRes = needsAuth
        ? await authenticateWebContext(context, page, baseUrl, cred, loginRules)
        : { ok: true };

      if (!authRes.ok) {
        const errPngName = `${role}__auth-failed.png`;
        const errPngPath = path.join(errDir, errPngName);
        await page.screenshot({ path: errPngPath, fullPage: false }).catch(() => {});
        const errUrl = artifactUrlFor(jobId, `screenshots/errors/${errPngName}`);
        gaps.push({
          id: `gap-ss-auth-${role}`,
          role,
          pagePath: cred?.loginPath || '/login',
          pageTitle: `Login (${role})`,
          phaseFailed: 'AUTH',
          category: 'auth-failed',
          httpStatus: authRes.httpStatus,
          redirectedTo: authRes.redirectedTo,
          errorScreenshotUrl: errUrl,
          technicalReason: authRes.reason || `Autentikasi gagal untuk role "${role}".`,
        });
        for (const cmd of cmds) {
          artifacts.push({
            id: cmd.id,
            role,
            pageId: cmd.pageId,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            filename: cmd.outputFilename,
            path: path.join(longDir, cmd.outputFilename),
            url: '',
            width: 0,
            height: 0,
            segmentCount: 0,
            status: 'FAILED',
            error: authRes.reason || 'Autentikasi gagal',
          });
        }
        await context.close().catch(() => {});
        continue;
      }

      for (const cmd of cmds) {
        signal?.throwIfAborted();
        const targetUrl = cmd.targetUrl || new URL(cmd.pagePath, baseUrl).toString();
        const outPath = path.join(longDir, cmd.outputFilename);
        const relOut = `screenshots/long/${cmd.outputFilename}`;

        const failedApis: Array<{ method: string; url: string; status: number }> = [];
        const consoleErrors: string[] = [];

        const onResponse = (res: { status: () => number; url: () => string; request: () => { method: () => string; resourceType: () => string } }) => {
          if (res.status() >= 400) {
            const rt = res.request().resourceType();
            if (rt === 'fetch' || rt === 'xhr' || rt === 'document') {
              if (failedApis.length < 8) {
                failedApis.push({ method: res.request().method(), url: res.url(), status: res.status() });
              }
            }
          }
        };
        const onConsole = (msg: { type: () => string; text: () => string }) => {
          if (msg.type() === 'error' && consoleErrors.length < 8) {
            consoleErrors.push(msg.text().slice(0, 300));
          }
        };
        const onPageError = (err: Error) => {
          if (consoleErrors.length < 8) consoleErrors.push(err.message.slice(0, 300));
        };

        page.on('response', onResponse);
        page.on('console', onConsole);
        page.on('pageerror', onPageError);

        try {
          const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
          await page.waitForSelector('main, #app > *, #root > *, body > *', { timeout: 4_000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 2_500 }).catch(() => {});
          await wait(450);

          const status = response?.status() ?? 200;
          const finalUrl = page.url();
          const finalPathname = (() => {
            try { return new URL(finalUrl).pathname.toLowerCase(); } catch { return ''; }
          })();
          const redirectedToLogin =
            needsAuth &&
            !cmd.pagePath.toLowerCase().includes('login') &&
            (finalPathname.includes('/login') || finalPathname.includes('/signin'));

          if (status >= 400 || redirectedToLogin) {
            const errName = `${cmd.id}-err.png`;
            const errPath = path.join(errDir, errName);
            await page.screenshot({ path: errPath, fullPage: false }).catch(() => {});
            const errUrl = artifactUrlFor(jobId, `screenshots/errors/${errName}`);

            const category = redirectedToLogin || status === 401 || status === 403
              ? 'rbac-forbidden'
              : status >= 500
              ? 'backend-5xx'
              : 'navigation-missing';

            const reason = redirectedToLogin
              ? `Halaman ${cmd.pagePath} mengalihkan sesi role "${role}" kembali ke halaman login (${finalPathname}).`
              : `Halaman ${cmd.pagePath} merespons dengan HTTP ${status}.`;

            gaps.push({
              id: `gap-ss-${cmd.id}`,
              role,
              pagePath: cmd.pagePath,
              pageTitle: cmd.pageTitle,
              phaseFailed: 'LONG_SS',
              category,
              httpStatus: status,
              redirectedTo: redirectedToLogin ? finalPathname : undefined,
              failedApiCalls: failedApis,
              consoleOrDeviceErrors: consoleErrors,
              errorScreenshotUrl: errUrl,
              technicalReason: reason,
            });
            artifacts.push({
              id: cmd.id,
              role,
              pageId: cmd.pageId,
              pagePath: cmd.pagePath,
              pageTitle: cmd.pageTitle,
              filename: cmd.outputFilename,
              path: outPath,
              url: '',
              width: 0,
              height: 0,
              segmentCount: 0,
              status: 'FAILED',
              error: reason,
            });
            continue;
          }

          // Inspect scroll geometry: document scroll vs inner container scroll
          const geom = await page.evaluate((preferredSel?: string) => {
            const vpH = window.innerHeight || 900;
            const docH = Math.max(
              document.documentElement?.scrollHeight || 0,
              document.body?.scrollHeight || 0
            );
            const candidates = [
              preferredSel,
              'main',
              '.main-area',
              '.layout-content',
              '.page-content',
              '[role="main"]',
              '.overflow-y-auto',
              '[data-scroll-container]',
            ].filter(Boolean) as string[];

            let innerSel = '';
            let innerScrollH = 0;
            let innerClientH = 0;
            for (const sel of candidates) {
              const el = document.querySelector(sel);
              if (!el) continue;
              if (el.scrollHeight - el.clientHeight > 80 && el.scrollHeight > docH) {
                innerSel = sel;
                innerScrollH = el.scrollHeight;
                innerClientH = el.clientHeight;
                break;
              }
            }
            return { vpH, docH, innerSel, innerScrollH, innerClientH };
          }, cmd.scrollContainerSelector);

          let segmentCount = 1;

          // Case A: Inner container scroll or ultra-tall document > 15,000px -> step scroll + vertical stitch
          if (geom.innerSel || geom.docH > 15_000) {
            const sliceDir = path.join(tmpSliceRoot, cmd.id);
            await mkdir(sliceDir, { recursive: true });
            const segments: PngSegmentInput[] = [];
            let prevBuf: Buffer | null = null;
            const maxSteps = 22;

            // Reset to top cleanly
            await page.evaluate((sel?: string) => {
              if (sel) {
                const el = document.querySelector(sel);
                if (el) el.scrollTop = 0;
              } else {
                window.scrollTo(0, 0);
              }
            }, geom.innerSel || undefined);
            await wait(250);

            for (let stepIdx = 0; stepIdx < maxSteps; stepIdx++) {
              const slicePath = path.join(sliceDir, `seg-${stepIdx}.png`);
              const buf = await page.screenshot({ path: slicePath, fullPage: false, animations: 'disabled' });
              if (!prevBuf) {
                segments.push({ path: slicePath, cropTop: 0, cropBottom: 0 });
                prevBuf = buf;
              } else {
                const diff = computeScrollSliceCropTop(prevBuf, buf, {
                  topChromeRatio: geom.innerSel ? 0.14 : 0.06,
                  bottomChromeRatio: 0.04,
                });
                if (diff.identical) {
                  await rm(slicePath, { force: true }).catch(() => undefined);
                  break;
                }
                const lastSeg = segments[segments.length - 1];
                lastSeg.cropBottom = diff.prevCropBottom;
                segments.push({ path: slicePath, cropTop: diff.cropTop, cropBottom: 0 });
                prevBuf = buf;
              }

              const atBottom = await page.evaluate((sel?: string) => {
                if (sel) {
                  const el = document.querySelector(sel);
                  if (!el) return true;
                  const step = Math.max(240, Math.round(el.clientHeight * 0.72));
                  const before = el.scrollTop;
                  el.scrollTop = before + step;
                  return Math.abs(el.scrollTop - before) < 4 || el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
                }
                const step = Math.max(240, Math.round(window.innerHeight * 0.78));
                const before = window.scrollY;
                window.scrollTo(0, before + step);
                return Math.abs(window.scrollY - before) < 4 || (window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 4;
              }, geom.innerSel || undefined);

              await wait(280);
              if (atBottom && stepIdx >= 0) {
                // Capture final bottom slice once before breaking
                const finalPath = path.join(sliceDir, `seg-last.png`);
                const finalBuf = await page.screenshot({ path: finalPath, fullPage: false, animations: 'disabled' });
                if (prevBuf) {
                  const diff = computeScrollSliceCropTop(prevBuf, finalBuf, {
                    topChromeRatio: geom.innerSel ? 0.14 : 0.06,
                    bottomChromeRatio: 0.04,
                  });
                  if (!diff.identical) {
                    segments[segments.length - 1].cropBottom = diff.prevCropBottom;
                    segments.push({ path: finalPath, cropTop: diff.cropTop, cropBottom: 0 });
                  } else {
                    await rm(finalPath, { force: true }).catch(() => undefined);
                  }
                }
                break;
              }
            }

            const stitched = await stitchPngSegmentsVertically(segments, outPath);
            segmentCount = stitched.segmentCount;
            await rm(sliceDir, { recursive: true, force: true }).catch(() => undefined);
          } else {
            // Case B: Standard document fullPage screenshot (1 long PNG top to bottom)
            await page.evaluate(() => window.scrollTo(0, 0));
            await wait(150);
            await page.screenshot({ path: outPath, fullPage: true, animations: 'disabled', timeout: 20_000 });
          }

          const dims = await readPngDimensions(outPath);
          artifacts.push({
            id: cmd.id,
            role,
            pageId: cmd.pageId,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            filename: cmd.outputFilename,
            path: outPath,
            url: artifactUrlFor(jobId, relOut),
            width: dims.width,
            height: dims.height,
            segmentCount,
            status: 'CAPTURED',
          });
          onLog?.(`[Batch 1 Long-SS] ✓ ${cmd.outputFilename} (${dims.width}x${dims.height}px, ${segmentCount} segmen)`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const errName = `${cmd.id}-crash.png`;
          const errPath = path.join(errDir, errName);
          await page.screenshot({ path: errPath, fullPage: false }).catch(() => {});
          const errInfo = await stat(errPath).catch(() => null);
          const errUrl = errInfo ? artifactUrlFor(jobId, `screenshots/errors/${errName}`) : undefined;

          gaps.push({
            id: `gap-ss-${cmd.id}`,
            role,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            phaseFailed: 'LONG_SS',
            category: /timeout/i.test(msg) ? 'timeout' : 'ui-crash',
            failedApiCalls: failedApis,
            consoleOrDeviceErrors: consoleErrors,
            errorScreenshotUrl: errUrl,
            technicalReason: `Gagal mengambil full-page screenshot pada ${cmd.pagePath}: ${msg}`,
          });
          artifacts.push({
            id: cmd.id,
            role,
            pageId: cmd.pageId,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            filename: cmd.outputFilename,
            path: outPath,
            url: '',
            width: 0,
            height: 0,
            segmentCount: 0,
            status: 'FAILED',
            error: msg,
          });
        } finally {
          page.off('response', onResponse);
          page.off('console', onConsole);
          page.off('pageerror', onPageError);
        }
      }

      await context.close().catch(() => {});
    }
  } finally {
    await browser?.close().catch(() => {});
    await rm(tmpSliceRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  return { artifacts, gaps };
}

export async function captureAndroidLongScreenshots(options: {
  jobId: string;
  serial: string;
  appId: string;
  plan: BatchCommandPlan;
  credentials: RuntimeRoleCredential[];
  runPath: string;
  signal?: AbortSignal;
  onLog?: (msg: string) => void;
}): Promise<{ artifacts: LongScreenshotArtifact[]; gaps: CoverageGapItem[] }> {
  const { jobId, serial, appId, plan, credentials, runPath, signal, onLog } = options;
  const longDir = path.join(runPath, 'screenshots', 'long');
  const errDir = path.join(runPath, 'screenshots', 'errors');
  const tmpSliceRoot = path.join(runPath, '.tmp-android-slices');
  await mkdir(longDir, { recursive: true });
  await mkdir(errDir, { recursive: true });
  await mkdir(tmpSliceRoot, { recursive: true });

  const artifacts: LongScreenshotArtifact[] = [];
  const gaps: CoverageGapItem[] = [];
  const { width, height } = await getScreenResolution(serial);

  const byRole = new Map<string, BatchLongScreenshotCommand[]>();
  for (const cmd of plan.screenshotCommands) {
    const arr = byRole.get(cmd.role) ?? [];
    arr.push(cmd);
    byRole.set(cmd.role, arr);
  }

  try {
    const multipleRoles = byRole.size > 1;
    for (const [role, cmds] of byRole.entries()) {
      signal?.throwIfAborted();
      const cred = credentials.find((c) => c.role === role);
      const roleVideo = plan.videoCommands.find((v) => v.role === role);
      onLog?.(`[Batch 1 Long-SS Android] Memulai capture panjang Mobile role "${role}" (${cmds.length} layar) di ${serial}...`);

      await launchAndroidApp(serial, appId, multipleRoles);
      if (cred && cred.identifier && cred.password) {
        const loginRes = await performAndroidLogin(serial, appId, cred);
        if (!loginRes.ok) {
          const errName = `${role}__android-auth-err.png`;
          const errPath = path.join(errDir, errName);
          const snap = await captureScreenBuffer(serial);
          if (snap.success && snap.buffer) await writeFile(errPath, snap.buffer);
          gaps.push({
            id: `gap-android-ss-auth-${role}`,
            role,
            pagePath: `/${role}/login`,
            pageTitle: `Login Mobile (${role})`,
            phaseFailed: 'AUTH',
            category: 'auth-failed',
            consoleOrDeviceErrors: loginRes.errorNodes,
            errorScreenshotUrl: snap.success ? artifactUrlFor(jobId, `screenshots/errors/${errName}`) : undefined,
            technicalReason: loginRes.reason || `Login Android gagal untuk role "${role}".`,
          });
          for (const cmd of cmds) {
            artifacts.push({
              id: cmd.id,
              role,
              pageId: cmd.pageId,
              pagePath: cmd.pagePath,
              pageTitle: cmd.pageTitle,
              filename: cmd.outputFilename,
              path: path.join(longDir, cmd.outputFilename),
              url: '',
              width: 0,
              height: 0,
              segmentCount: 0,
              status: 'FAILED',
              error: loginRes.reason || 'Login Android gagal',
            });
          }
          continue;
        }
      }

      for (const [idx, cmd] of cmds.entries()) {
        signal?.throwIfAborted();
        const outPath = path.join(longDir, cmd.outputFilename);
        const relOut = `screenshots/long/${cmd.outputFilename}`;

        try {
          // Navigate to tab/screen if not initial screen
          if (idx > 0) {
            const matchingTabStep = roleVideo?.steps.find(
              (s) =>
                s.kind === 'click-feature' &&
                (s.pagePath === cmd.pagePath ||
                  s.label.toLowerCase().includes(cmd.pageTitle.replace(/^\[[^\]]+\]\s*/, '').toLowerCase()))
            );
            if (matchingTabStep?.bounds) {
              await tapCoordinate(serial, matchingTabStep.bounds.x, matchingTabStep.bounds.y);
            } else {
              const titleClean = cmd.pageTitle.replace(/^\[[^\]]+\]\s*/, '').trim().toLowerCase();
              const nodes = await readUiNodes(serial, 1);
              const matchNode = nodes.find((n) => nodeLabel(n).toLowerCase().includes(titleClean));
              if (matchNode) {
                await tapCoordinate(serial, (matchNode.left + matchNode.right) / 2, (matchNode.top + matchNode.bottom) / 2);
              }
            }
            await wait(1200);
          }

          // Check crash/ANR dialog before capture
          const currentNodes = await readUiNodes(serial, 1).catch(() => []);
          const crashNode = currentNodes.find((n) => /(?:has stopped|isn't responding|tidak merespons|berhenti)/i.test(nodeLabel(n)));
          if (crashNode) {
            const logcat = await runAdb(['-s', serial, 'shell', 'logcat', '-d', '-t', '40', '*:E'], 5000).catch(() => ({ stdout: '' }));
            const errName = `${cmd.id}-crash.png`;
            const errPath = path.join(errDir, errName);
            const errSnap = await captureScreenBuffer(serial);
            if (errSnap.success && errSnap.buffer) await writeFile(errPath, errSnap.buffer);
            gaps.push({
              id: `gap-android-ss-${cmd.id}`,
              role,
              pagePath: cmd.pagePath,
              pageTitle: cmd.pageTitle,
              phaseFailed: 'LONG_SS',
              category: 'ui-crash',
              consoleOrDeviceErrors: logcat.stdout ? logcat.stdout.split('\n').slice(-8) : [nodeLabel(crashNode)],
              errorScreenshotUrl: errSnap.success ? artifactUrlFor(jobId, `screenshots/errors/${errName}`) : undefined,
              technicalReason: `Aplikasi Android crash/ANR saat membuka layar ${cmd.pageTitle}: ${nodeLabel(crashNode)}`,
            });
            artifacts.push({
              id: cmd.id,
              role,
              pageId: cmd.pageId,
              pagePath: cmd.pagePath,
              pageTitle: cmd.pageTitle,
              filename: cmd.outputFilename,
              path: outPath,
              url: '',
              width: 0,
              height: 0,
              segmentCount: 0,
              status: 'FAILED',
              error: `Crash/ANR: ${nodeLabel(crashNode)}`,
            });
            continue;
          }

          // Capture scroll segments from top to bottom and stitch vertically into 1 PNG
          const sliceDir = path.join(tmpSliceRoot, cmd.id);
          await mkdir(sliceDir, { recursive: true });
          const segments: PngSegmentInput[] = [];
          let prevBuf: Buffer | null = null;
          let prevHash = '';
          const maxSwipes = 10;

          for (let stepIdx = 0; stepIdx < maxSwipes; stepIdx++) {
            const shot = await captureScreenBuffer(serial);
            if (!shot.success || !shot.buffer) {
              if (stepIdx === 0) throw new Error(shot.error || 'adb screencap gagal');
              break;
            }
            const curHash = createHash('sha256').update(shot.buffer).digest('hex');
            if (curHash === prevHash) break;
            prevHash = curHash;

            const segPath = path.join(sliceDir, `seg-${stepIdx}.png`);
            await writeFile(segPath, shot.buffer);

            if (!prevBuf) {
              segments.push({ path: segPath, cropTop: 0, cropBottom: 0 });
              prevBuf = shot.buffer;
            } else {
              const diff = computeScrollSliceCropTop(prevBuf, shot.buffer);
              if (diff.identical) {
                await rm(segPath, { force: true }).catch(() => undefined);
                break;
              }
              segments[segments.length - 1].cropBottom = diff.prevCropBottom;
              segments.push({ path: segPath, cropTop: diff.cropTop, cropBottom: 0 });
              prevBuf = shot.buffer;
            }

            // Swipe upward to scroll down content
            await swipeVertical(serial, width * 0.5, height * 0.74, height * 0.26, 420);
            await wait(650);
          }

          const stitched = await stitchPngSegmentsVertically(segments, outPath);
          await rm(sliceDir, { recursive: true, force: true }).catch(() => undefined);

          // Scroll back near top so subsequent screen transitions remain predictable
          if (stitched.segmentCount > 1) {
            for (let up = 0; up < Math.min(4, stitched.segmentCount - 1); up++) {
              await swipeVertical(serial, width * 0.5, height * 0.28, height * 0.78, 300);
              await wait(250);
            }
          }

          artifacts.push({
            id: cmd.id,
            role,
            pageId: cmd.pageId,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            filename: cmd.outputFilename,
            path: outPath,
            url: artifactUrlFor(jobId, relOut),
            width: stitched.width,
            height: stitched.height,
            segmentCount: stitched.segmentCount,
            status: 'CAPTURED',
          });
          onLog?.(`[Batch 1 Long-SS Android] ✓ ${cmd.outputFilename} (${stitched.width}x${stitched.height}px, ${stitched.segmentCount} segmen)`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          gaps.push({
            id: `gap-android-ss-${cmd.id}`,
            role,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            phaseFailed: 'LONG_SS',
            category: 'ui-crash',
            technicalReason: `Gagal capture panjang layar Android ${cmd.pageTitle}: ${msg}`,
          });
          artifacts.push({
            id: cmd.id,
            role,
            pageId: cmd.pageId,
            pagePath: cmd.pagePath,
            pageTitle: cmd.pageTitle,
            filename: cmd.outputFilename,
            path: outPath,
            url: '',
            width: 0,
            height: 0,
            segmentCount: 0,
            status: 'FAILED',
            error: msg,
          });
        }
      }
    }
  } finally {
    await rm(tmpSliceRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  return { artifacts, gaps };
}

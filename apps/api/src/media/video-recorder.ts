import { spawn, type ChildProcess } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { launchSafeChromium } from '../playwright-adapter.ts';
import type {
  BatchCommandPlan,
  BatchVideoFeatureStep,
  CoverageGapItem,
  RoleVideoArtifact,
  RoleVideoChapter,
} from '../discovery/types.ts';
import type { RuntimeRoleCredential } from '../auth-role-provisioner.ts';
import { GeminiService } from '../gemini-service.ts';
import { assertValidVideo, concatVideos, normalizeVideo, VIDEO_RECORDING } from '../video-policy.ts';
import { getScreenResolution, resolveAdbBin, runAdb, swipeVertical, tapCoordinate } from '../android/adb.ts';
import { readUiNodes } from '../android/index.ts';
import { launchAndroidApp, nodeLabel, performAndroidLogin } from '../android/mobile-explorer.ts';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function artifactUrlFor(jobId: string, relUnderJob: string): string {
  const cleaned = relUnderJob.replace(/^\/+/, '').split(path.sep).join('/');
  return `/api/v1/discovery/jobs/${jobId}/artifacts/${cleaned.split('/').map(encodeURIComponent).join('/')}`;
}

async function authenticateForVideo(
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
): Promise<{ ok: boolean; reason?: string }> {
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

  const loginUrl = new URL(cred.loginPath || loginRules?.loginPath || '/login', baseUrl).toString();
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await wait(350);

    const emailSel = loginRules?.emailSelector || "input[name='email'], input[name='username'], input[type='email'], input[type='text']";
    const passSel = loginRules?.passwordSelector || "input[name='password'], input[type='password']";
    const submitSel = loginRules?.submitSelector || "button[type='submit'], input[type='submit'], button:has-text('Login'), button:has-text('Masuk')";

    let hasEmail = await page.locator(emailSel).first().isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasEmail) {
      const openModalBtn = page.locator("button:has-text('Masuk'), button:has-text('Login'), a:has-text('Masuk'), .btn-login").first();
      if (await openModalBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await openModalBtn.click().catch(() => {});
        await wait(500);
        hasEmail = await page.locator(emailSel).first().isVisible({ timeout: 2000 }).catch(() => false);
      }
    }
    const hasPass = await page.locator(passSel).first().isVisible({ timeout: 2000 }).catch(() => false);

    if (hasEmail && hasPass) {
      await page.locator(emailSel).first().fill(cred.identifier);
      await wait(180);
      await page.locator(passSel).first().fill(cred.password);
      await wait(180);
      await page.locator(submitSel).first().click({ noWaitAfter: true });

      const targetSuccess = loginRules?.successUrl ? new URL(loginRules.successUrl, baseUrl).pathname : '';
      await page.waitForURL(
        (u) => (targetSuccess && u.pathname.includes(targetSuccess)) || !u.pathname.toLowerCase().includes('login'),
        { waitUntil: 'domcontentloaded', timeout: 12_000 }
      ).catch(() => {});
      await wait(600);

      const stillHasPwd = await page.locator(passSel).first().isVisible().catch(() => false);
      if (stillHasPwd && !cred.token) {
        return { ok: false, reason: `Form login role "${cred.role}" tidak berpindah dari ${loginUrl}.` };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: Boolean(cred.token), reason: err instanceof Error ? err.message : String(err) };
  }
}

async function clickFeatureWithSelfHealing(
  page: Page,
  step: BatchVideoFeatureStep,
  pagePath: string
): Promise<boolean> {
  // 1. Primary CSS selector recorded during Reconnaissance
  if (step.selector) {
    try {
      const loc = page.locator(step.selector).first();
      if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await loc.click({ timeout: 2500 });
        return true;
      }
    } catch {}
  }

  // 2. Fallback by visible label text
  const cleanLabel = step.label.replace(/^Klik [^:]+:\s*/i, '').trim();
  if (cleanLabel) {
    try {
      const byText = page.getByRole('tab', { name: cleanLabel }).or(
        page.getByRole('button', { name: cleanLabel })
      ).or(
        page.getByText(cleanLabel, { exact: false })
      ).first();
      if (await byText.isVisible({ timeout: 1500 }).catch(() => false)) {
        await byText.scrollIntoViewIfNeeded().catch(() => {});
        await byText.click({ timeout: 2500 });
        return true;
      }
    } catch {}
  }

  // 3. Gemini self-healing selector lookup from live visible interactive texts
  if (GeminiService.isConfigured() && cleanLabel) {
    const candidates = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('button,[role="tab"],a,summary'))) {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt && txt.length <= 60) out.push(txt);
        if (out.length >= 25) break;
      }
      return out;
    }).catch(() => [] as string[]);

    const healed = await GeminiService.resolveSelfHealingTarget({
      pagePath,
      reason: `Selector fitur "${step.selector || cleanLabel}" tidak ditemukan saat perekaman video`,
      observedLinks: [],
      interactiveTexts: candidates,
    }).catch(() => null);

    if (healed?.fallbackSelector) {
      try {
        const loc = page.locator(healed.fallbackSelector).first();
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await loc.click({ timeout: 2500 });
          return true;
        }
      } catch {}
    }
  }

  return false;
}

async function performSmoothVideoScroll(page: Page, containerSelector?: string): Promise<void> {
  const scrollSteps = await page.evaluate((sel?: string) => {
    if (sel) {
      const el = document.querySelector(sel);
      if (el) {
        const total = Math.max(0, el.scrollHeight - el.clientHeight);
        return { total, viewport: el.clientHeight || 720, hasContainer: true };
      }
    }
    const total = Math.max(0, (document.documentElement?.scrollHeight || document.body?.scrollHeight || 0) - window.innerHeight);
    return { total, viewport: window.innerHeight || 720, hasContainer: false };
  }, containerSelector);

  if (scrollSteps.total <= 20) return;
  const increment = Math.max(260, Math.round(scrollSteps.viewport * 0.7));
  const numSteps = Math.min(10, Math.ceil(scrollSteps.total / increment));

  for (let i = 1; i <= numSteps; i++) {
    const targetY = Math.min(scrollSteps.total, i * increment);
    await page.evaluate(
      ({ sel, y, hasContainer }) => {
        if (hasContainer && sel) {
          const el = document.querySelector(sel);
          if (el) el.scrollTo({ top: y, behavior: 'auto' });
        } else {
          window.scrollTo({ top: y, behavior: 'auto' });
        }
      },
      { sel: containerSelector, y: targetY, hasContainer: scrollSteps.hasContainer }
    );
    await wait(380);
  }
}

/**
 * Batch 2 Web Video Recorder:
 * Runs strictly AFTER Batch 1 Long Screenshots. Produces 1 continuous WebM per role
 * traversing 100% of discovered pages, clicking every interactive tab/accordion one-by-one,
 * and scrolling vertically across every tall section.
 */
export async function recordWebRoleVideos(options: {
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
}): Promise<{ videos: RoleVideoArtifact[]; gaps: CoverageGapItem[] }> {
  const { jobId, plan, credentials, baseUrl, runPath, loginRules, signal, onLog } = options;
  const videosDir = path.join(runPath, 'videos');
  const rawTmpRoot = path.join(runPath, '.tmp-raw-videos');
  await mkdir(videosDir, { recursive: true });
  await mkdir(rawTmpRoot, { recursive: true });

  const videos: RoleVideoArtifact[] = [];
  const gaps: CoverageGapItem[] = [];

  if (plan.videoCommands.length === 0) {
    await rm(rawTmpRoot, { recursive: true, force: true }).catch(() => undefined);
    return { videos, gaps };
  }

  let browser: Browser | undefined;
  try {
    browser = await launchSafeChromium({
      headless: true,
      timeout: 25_000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    for (const roleCmd of plan.videoCommands) {
      signal?.throwIfAborted();
      const role = roleCmd.role;
      const cred = credentials.find((c) => c.role === role);
      const roleRawDir = path.join(rawTmpRoot, role);
      await mkdir(roleRawDir, { recursive: true });

      const outPath = path.join(videosDir, roleCmd.outputFilename);
      const relOut = `videos/${roleCmd.outputFilename}`;
      const chapters: RoleVideoChapter[] = [];
      let context: BrowserContext | undefined;
      let page: Page | undefined;

      onLog?.(`[Batch 2 Video Web] Memulai perekaman penuh role "${role}" (${roleCmd.steps.length} aksi)...`);
      const startedAt = Date.now();

      try {
        context = await browser.newContext({
          viewport: VIDEO_RECORDING.viewport,
          recordVideo: { dir: roleRawDir, ...VIDEO_RECORDING.recordVideo },
          serviceWorkers: 'block',
          acceptDownloads: false,
        });
        context.setDefaultTimeout(15_000);
        context.setDefaultNavigationTimeout(25_000);
        page = await context.newPage();
        page.on('dialog', (d) => void d.dismiss().catch(() => {}));

        const needsAuth = Boolean(cred && (cred.identifier || cred.password || cred.token));
        const authRes = needsAuth
          ? await authenticateForVideo(context, page, baseUrl, cred, loginRules)
          : { ok: true };

        if (!authRes.ok) {
          gaps.push({
            id: `gap-vid-auth-${role}`,
            role,
            pagePath: cred?.loginPath || '/login',
            pageTitle: `Login Video (${role})`,
            phaseFailed: 'VIDEO',
            category: 'auth-failed',
            technicalReason: authRes.reason || `Autentikasi gagal saat fase perekaman video role "${role}".`,
          });
        } else {
          let currentPagePath = '/';
          let currentPageBlocked = false;

          for (const step of roleCmd.steps) {
            signal?.throwIfAborted();
            if (step.kind === 'navigate' && step.pagePath) {
              currentPagePath = step.pagePath;
              currentPageBlocked = false;
              const startSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
              const targetUrl = new URL(step.pagePath, baseUrl).toString();
              const resp = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 22_000 }).catch(() => null);
              await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {});
              await wait(step.pauseMs ?? 700);

              const status = resp?.status() ?? (resp ? 200 : 500);
              const finalPath = (() => {
                try { return new URL(page!.url()).pathname.toLowerCase(); } catch { return ''; }
              })();
              const redirectedLogin = needsAuth && !step.pagePath.toLowerCase().includes('login') && finalPath.includes('/login');

              if (status >= 400 || redirectedLogin) {
                currentPageBlocked = true;
                gaps.push({
                  id: `gap-vid-${role}-${chapters.length + 1}`,
                  role,
                  pagePath: step.pagePath,
                  pageTitle: step.label,
                  phaseFailed: 'VIDEO',
                  category: redirectedLogin || status === 401 || status === 403 ? 'rbac-forbidden' : 'backend-5xx',
                  httpStatus: status,
                  redirectedTo: redirectedLogin ? finalPath : undefined,
                  technicalReason: redirectedLogin
                    ? `Saat perekaman video, halaman ${step.pagePath} mengarahkan sesi role "${role}" kembali ke ${finalPath}.`
                    : `Halaman ${step.pagePath} merespons HTTP ${status} saat perekaman video.`,
                });
                continue;
              }

              chapters.push({ startSec, page: step.pagePath });
            } else if (step.kind === 'click-feature') {
              if (currentPageBlocked) continue;
              const startSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
              const clicked = await clickFeatureWithSelfHealing(page, step, currentPagePath);
              if (clicked) {
                chapters.push({ startSec, page: currentPagePath, feature: step.label });
                await wait(step.pauseMs ?? 950);
              }
            } else if (step.kind === 'scroll-full') {
              if (currentPageBlocked) continue;
              await performSmoothVideoScroll(page, step.scrollContainerSelector);
              await wait(step.pauseMs ?? 550);
            } else if (step.kind === 'wait') {
              await wait(step.pauseMs ?? 500);
            }
          }
          // Hold 600ms on final screen so ending isn't abruptly cut
          await wait(600);
        }

        const videoHandle = page.video();
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        context = undefined;
        page = undefined;

        const recordedPath = videoHandle ? await videoHandle.path().catch(() => '') : '';
        if (!recordedPath) {
          throw new Error(`Playwright tidak menghasilkan file video mentah untuk role "${role}".`);
        }

        try {
          await normalizeVideo(recordedPath, outPath);
        } catch (normErr) {
          onLog?.(`[Batch 2 Video Web] Peringatan normalisasi VP9 (${normErr instanceof Error ? normErr.message : String(normErr)}); menyimpan rekaman WebM asli.`);
          await copyFile(recordedPath, outPath);
        }

        const valid = await assertValidVideo(outPath, 8192);
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

        videos.push({
          role,
          filename: roleCmd.outputFilename,
          path: outPath,
          url: artifactUrlFor(jobId, relOut),
          durationSec,
          sizeBytes: valid.sizeBytes,
          chapters,
          status: 'RECORDED',
        });
        onLog?.(`[Batch 2 Video Web] ✓ ${roleCmd.outputFilename} (${durationSec}s, ${Math.round(valid.sizeBytes / 1024)} KB, ${chapters.length} chapter)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await page?.close().catch(() => {});
        await context?.close().catch(() => {});
        gaps.push({
          id: `gap-vid-err-${role}`,
          role,
          pagePath: '/',
          pageTitle: `Video Role (${role})`,
          phaseFailed: 'VIDEO',
          category: 'video-missing',
          technicalReason: `Video role "${role}" gagal direkam atau rusak: ${msg}`,
        });
        videos.push({
          role,
          filename: roleCmd.outputFilename,
          path: outPath,
          url: '',
          durationSec: 0,
          sizeBytes: 0,
          chapters,
          status: 'FAILED',
          error: msg,
        });
      } finally {
        await rm(roleRawDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  } finally {
    await browser?.close().catch(() => {});
    await rm(rawTmpRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  return { videos, gaps };
}

/**
 * Batch 2 Android Video Recorder:
 * Uses rolling adb `screenrecord` segments (< 165s each) stitched via ffmpeg concatVideos
 * + moov faststart so multi-role journeys > 180s never truncate silently.
 */
export async function recordAndroidRoleVideos(options: {
  jobId: string;
  serial: string;
  appId: string;
  plan: BatchCommandPlan;
  credentials: RuntimeRoleCredential[];
  runPath: string;
  signal?: AbortSignal;
  onLog?: (msg: string) => void;
}): Promise<{ videos: RoleVideoArtifact[]; gaps: CoverageGapItem[] }> {
  const { jobId, serial, appId, plan, credentials, runPath, signal, onLog } = options;
  const videosDir = path.join(runPath, 'videos');
  const tmpSegRoot = path.join(runPath, '.tmp-android-videos');
  await mkdir(videosDir, { recursive: true });
  await mkdir(tmpSegRoot, { recursive: true });

  const videos: RoleVideoArtifact[] = [];
  const gaps: CoverageGapItem[] = [];
  const { width, height } = await getScreenResolution(serial);
  const adbBin = resolveAdbBin();

  const stopDeviceScreenrecord = async (proc: ChildProcess | null) => {
    const pidRes = await runAdb(['-s', serial, 'shell', 'pidof', 'screenrecord'], 3000).catch(() => ({ stdout: '' }));
    const pids = pidRes.stdout.trim().split(/\s+/).filter(Boolean);
    if (pids.length > 0) {
      for (const pid of pids) {
        await runAdb(['-s', serial, 'shell', 'kill', '-2', pid], 3000).catch(() => {});
      }
    } else {
      await runAdb(['-s', serial, 'shell', 'pkill', '-SIGINT', 'screenrecord'], 3000).catch(() => {});
    }
    await wait(2800);
    if (proc && !proc.killed) {
      try { proc.kill('SIGINT'); } catch {}
    }
  };

  try {
    const multipleRoles = plan.videoCommands.length > 1;
    for (const roleCmd of plan.videoCommands) {
      signal?.throwIfAborted();
      const role = roleCmd.role;
      const cred = credentials.find((c) => c.role === role);
      const outPath = path.join(videosDir, roleCmd.outputFilename);
      const relOut = `videos/${roleCmd.outputFilename}`;
      const localSegDir = path.join(tmpSegRoot, role);
      await mkdir(localSegDir, { recursive: true });

      const chapters: RoleVideoChapter[] = [];
      const remoteSegs: string[] = [];
      let segIndex = 0;
      let segStartedAt = Date.now();
      let recordProc: ChildProcess | null = null;

      const startSegment = async () => {
        const remotePath = `/sdcard/qc_vid_${role}_${segIndex}.mp4`;
        segIndex++;
        remoteSegs.push(remotePath);
        segStartedAt = Date.now();
        recordProc = spawn(
          adbBin,
          ['-s', serial, 'shell', 'screenrecord', '--bit-rate', '4000000', '--time-limit', '165', remotePath],
          { windowsHide: true, stdio: 'ignore' }
        );
        await wait(600);
      };

      onLog?.(`[Batch 2 Video Android] Memulai perekaman penuh role "${role}" (${roleCmd.steps.length} aksi) di ${serial}...`);
      const roleStartedAt = Date.now();

      try {
        await launchAndroidApp(serial, appId, multipleRoles);
        await startSegment();

        if (cred && cred.identifier && cred.password) {
          const loginRes = await performAndroidLogin(serial, appId, cred);
          if (!loginRes.ok) {
            gaps.push({
              id: `gap-android-vid-auth-${role}`,
              role,
              pagePath: `/${role}/login`,
              pageTitle: `Login Mobile Video (${role})`,
              phaseFailed: 'VIDEO',
              category: 'auth-failed',
              consoleOrDeviceErrors: loginRes.errorNodes,
              technicalReason: loginRes.reason || `Gagal login Android saat fase video role "${role}".`,
            });
          }
        }

        let currentPage = `/${role}/home`;
        for (const step of roleCmd.steps) {
          signal?.throwIfAborted();
          // Rotate screenrecord segment before hitting Android 180s hard cap
          if (Date.now() - segStartedAt > 150_000) {
            await stopDeviceScreenrecord(recordProc);
            recordProc = null;
            await startSegment();
          }

          const startSec = Math.max(0, Math.round((Date.now() - roleStartedAt) / 1000));
          if (step.kind === 'navigate') {
            currentPage = step.pagePath || currentPage;
            chapters.push({ startSec, page: currentPage });
            await wait(step.pauseMs ?? 700);
          } else if (step.kind === 'click-feature') {
            let tapped = false;
            const cleanLabel = step.label.replace(/^Klik [^:]+:\s*/i, '').trim().toLowerCase();
            if (cleanLabel) {
              const nodes = await readUiNodes(serial, 1).catch(() => []);
              const matched = nodes.find((n) => nodeLabel(n).toLowerCase() === cleanLabel)
                || nodes.find((n) => nodeLabel(n).toLowerCase().includes(cleanLabel));
              if (matched) {
                await tapCoordinate(serial, (matched.left + matched.right) / 2, (matched.top + matched.bottom) / 2);
                tapped = true;
              }
            }
            if (!tapped && step.bounds) {
              await tapCoordinate(serial, step.bounds.x, step.bounds.y);
              tapped = true;
            }
            if (tapped) {
              chapters.push({ startSec, page: currentPage, feature: step.label });
              await wait(step.pauseMs ?? 1000);
            }
          } else if (step.kind === 'scroll-full') {
            await swipeVertical(serial, width * 0.5, height * 0.74, height * 0.28, 420);
            await wait(450);
            await swipeVertical(serial, width * 0.5, height * 0.74, height * 0.28, 420);
            await wait(step.pauseMs ?? 600);
          } else {
            await wait(step.pauseMs ?? 500);
          }
        }

        await wait(800);
        await stopDeviceScreenrecord(recordProc);
        recordProc = null;

        const localSegs: string[] = [];
        for (const [i, remote] of remoteSegs.entries()) {
          const localSeg = path.join(localSegDir, `seg-${i}.mp4`);
          const pullRes = await runAdb(['-s', serial, 'pull', remote, localSeg], 25_000);
          await runAdb(['-s', serial, 'shell', 'rm', '-f', remote], 3000).catch(() => {});
          if (pullRes.exitCode === 0) localSegs.push(localSeg);
        }

        await concatVideos(localSegs, outPath, true);
        const valid = await assertValidVideo(outPath, 8192);
        const durationSec = Math.max(1, Math.round((Date.now() - roleStartedAt) / 1000));

        videos.push({
          role,
          filename: roleCmd.outputFilename,
          path: outPath,
          url: artifactUrlFor(jobId, relOut),
          durationSec,
          sizeBytes: valid.sizeBytes,
          chapters,
          status: 'RECORDED',
        });
        onLog?.(`[Batch 2 Video Android] ✓ ${roleCmd.outputFilename} (${durationSec}s, ${Math.round(valid.sizeBytes / 1024)} KB, ${chapters.length} chapter)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (recordProc) {
          await stopDeviceScreenrecord(recordProc).catch(() => {});
        }
        gaps.push({
          id: `gap-android-vid-err-${role}`,
          role,
          pagePath: `/${role}`,
          pageTitle: `Video Mobile (${role})`,
          phaseFailed: 'VIDEO',
          category: 'video-missing',
          technicalReason: `Video Android role "${role}" gagal direkam atau rusak: ${msg}`,
        });
        videos.push({
          role,
          filename: roleCmd.outputFilename,
          path: outPath,
          url: '',
          durationSec: 0,
          sizeBytes: 0,
          chapters,
          status: 'FAILED',
          error: msg,
        });
      } finally {
        await rm(localSegDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  } finally {
    await rm(tmpSegRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  return { videos, gaps };
}

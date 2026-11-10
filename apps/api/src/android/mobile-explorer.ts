import { createHash } from 'node:crypto';
import type { InteractiveFeatureItem, InventoryPage } from '../discovery/source-scanner.ts';
import type { CoverageGapItem } from '../discovery/types.ts';
import type { RuntimeRoleCredential } from '../auth-role-provisioner.ts';
import { GeminiService } from '../gemini-service.ts';
import { captureScreenBuffer, getScreenResolution, pressBackAdb, runAdb, swipeVertical, tapCoordinate } from './adb.ts';
import { readUiNodes, runCli, type UiNode } from './index.ts';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function launchAndroidApp(serial: string, appId: string, resetState = false): Promise<void> {
  if (resetState) {
    await runAdb(['-s', serial, 'shell', 'pm', 'clear', appId], 8000).catch(() => undefined);
    await wait(600);
  }
  await runAdb(['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 3000).catch(() => undefined);
  await runAdb(['-s', serial, 'shell', 'wm', 'dismiss-keyguard'], 3000).catch(() => undefined);
  // Launch default launcher activity cleanly without assuming MainActivity class name
  const res = await runAdb(['-s', serial, 'shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1'], 8000);
  if (res.exitCode !== 0) {
    await runAdb(['-s', serial, 'shell', 'am', 'start', '-n', `${appId}/.MainActivity`], 6000).catch(() => undefined);
  }
  await wait(2200);
}

export function nodeLabel(node: UiNode): string {
  return (node.text || node.contentDesc || node.hint || '').trim();
}

export function isLoginScreen(nodes: UiNode[]): boolean {
  const inputs = nodes.filter((n) => /edittext/i.test(n.className || ''));
  const hasLoginCue = nodes.some((n) => /\b(login|masuk|sign\s*in|password|sandi|username|email)\b/i.test(nodeLabel(n)));
  return inputs.length >= 1 && hasLoginCue;
}

export async function performAndroidLogin(
  serial: string,
  appId: string,
  cred: RuntimeRoleCredential
): Promise<{ ok: boolean; reason?: string; errorNodes?: string[] }> {
  let nodes = await readUiNodes(serial, 2);
  if (!isLoginScreen(nodes)) {
    return { ok: true, reason: 'Layar awal bukan form login (sudah terautentikasi atau halaman publik).' };
  }

  const editNodes = nodes
    .filter((n) => /edittext/i.test(n.className || ''))
    .sort((a, b) => a.top - b.top);

  if (editNodes.length === 0) {
    return { ok: false, reason: 'Field EditText login tidak ditemukan di UI tree.' };
  }

  // Fill identifier into first EditText
  const idField = editNodes[0];
  await tapCoordinate(serial, (idField.left + idField.right) / 2, (idField.top + idField.bottom) / 2);
  await wait(350);
  await runCli('adb', ['-s', serial, 'shell', 'input', 'text', cred.identifier.replace(/ /g, '%s')], 6000);
  await wait(300);

  // If 2nd EditText exists, fill password; else submit / tab
  const pwdField = editNodes[1];
  if (pwdField) {
    await tapCoordinate(serial, (pwdField.left + pwdField.right) / 2, (pwdField.top + pwdField.bottom) / 2);
    await wait(350);
    await runCli('adb', ['-s', serial, 'shell', 'input', 'text', cred.password.replace(/ /g, '%s')], 6000);
    await wait(300);
  }

  // Dismiss soft keyboard cleanly
  await runAdb(['-s', serial, 'shell', 'input', 'keyevent', '111'], 2000).catch(() => undefined);
  await wait(250);

  // Re-dump to locate submit button accurately after keyboard dismissal
  nodes = await readUiNodes(serial, 1);
  const submitBtn = nodes.find((n) =>
    n.clickable &&
    !/edittext/i.test(n.className || '') &&
    /\b(login|masuk|sign\s*in|submit|kirim|lanjut)\b/i.test(nodeLabel(n))
  ) || nodes.find((n) => /button/i.test(n.className || '') && n.clickable);

  if (submitBtn) {
    await tapCoordinate(serial, (submitBtn.left + submitBtn.right) / 2, (submitBtn.top + submitBtn.bottom) / 2);
  } else {
    await runAdb(['-s', serial, 'shell', 'input', 'keyevent', '66'], 3000);
  }

  await wait(2600);
  const postNodes = await readUiNodes(serial, 2);
  const visibleTexts = postNodes.map(nodeLabel).filter(Boolean);
  const stillLogin = isLoginScreen(postNodes);
  const authErrorText = visibleTexts.find((t) =>
    /(?:gagal|salah|invalid|unauthorized|incorrect|tidak valid|error|wrong)/i.test(t)
  );

  if (stillLogin) {
    return {
      ok: false,
      reason: authErrorText
        ? `Login ditolak aplikasi: "${authErrorText}"`
        : 'Login tidak berlanjut meninggalkan layar formulir masuk.',
      errorNodes: visibleTexts.slice(0, 6),
    };
  }

  return { ok: true };
}

function detectNavigationTabs(nodes: UiNode[], width: number, height: number): InteractiveFeatureItem[] {
  const found: InteractiveFeatureItem[] = [];
  const seen = new Set<string>();

  // Bottom bar items (top >= 78% height, excluding system Android bar bottom <= 98%)
  for (const n of nodes) {
    const label = nodeLabel(n);
    if (!label || label.length > 40) continue;
    const cx = Math.round((n.left + n.right) / 2);
    const cy = Math.round((n.top + n.bottom) / 2);
    const inBottomNav = n.top >= height * 0.78 && n.bottom <= height * 0.96 && cx >= width * 0.03 && cx <= width * 0.97;
    const inTopTabs = n.top >= height * 0.08 && n.top <= height * 0.24 && (n.bottom - n.top) <= height * 0.12 && n.clickable;
    if ((inBottomNav || inTopTabs) && (n.clickable || /\bTab\b/i.test(n.className || ''))) {
      const key = `${label.toLowerCase()}@${Math.round(cx / 30)}@${Math.round(cy / 30)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        kind: 'tab',
        label: label.replace(/\n+/g, ' ').trim(),
        bounds: { x: cx, y: cy },
      });
    }
  }

  // Fallback clickable widgets positioned along bottom nav bar even when container handles click
  if (found.length === 0) {
    for (const n of nodes) {
      const label = nodeLabel(n);
      if (!label || label.length > 28) continue;
      const cx = Math.round((n.left + n.right) / 2);
      const cy = Math.round((n.top + n.bottom) / 2);
      if (n.top >= height * 0.84 && n.bottom <= height * 0.96) {
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ kind: 'tab', label, bounds: { x: cx, y: cy } });
      }
    }
  }

  return found.slice(0, 12);
}

function detectInnerInteractiveTriggers(nodes: UiNode[], width: number, height: number, existingTabs: Set<string>): InteractiveFeatureItem[] {
  const items: InteractiveFeatureItem[] = [];
  const seen = new Set<string>(existingTabs);

  for (const n of nodes) {
    const label = nodeLabel(n);
    if (!label || label.length < 2 || label.length > 60) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    if (n.top < height * 0.08 || n.top > height * 0.80) continue;
    if (/^\d{1,2}:\d{2}$/.test(label)) continue; // status clock

    const isClickable = n.clickable || /button|tab|chip|switch|checkbox|radiobutton/i.test(n.className || '');
    if (!isClickable) continue;
    const cx = Math.round((n.left + n.right) / 2);
    const cy = Math.round((n.top + n.bottom) / 2);
    if (cx <= 5 || cx >= width - 5) continue;
    seen.add(key);

    const kind: InteractiveFeatureItem['kind'] =
      /tab/i.test(n.className || '') ? 'tab' :
      /filter|sort|cari|search/i.test(label) ? 'filter' :
      /menu|drawer/i.test(label) ? 'drawer' :
      'accordion';
    items.push({ kind, label: label.replace(/\n+/g, ' ').trim(), bounds: { x: cx, y: cy } });
  }
  return items.slice(0, 20);
}

async function detectScreenScrollability(serial: string, width: number, height: number): Promise<{ isScrollable: boolean; estimatedHeight: number }> {
  const before = await captureScreenBuffer(serial);
  if (!before.success || !before.buffer) return { isScrollable: false, estimatedHeight: height };
  const hashBefore = createHash('sha256').update(before.buffer).digest('hex');

  await swipeVertical(serial, width * 0.5, height * 0.72, height * 0.32, 350);
  await wait(450);
  const after = await captureScreenBuffer(serial);
  const hashAfter = after.success && after.buffer ? createHash('sha256').update(after.buffer).digest('hex') : hashBefore;

  const moved = hashBefore !== hashAfter;
  if (moved) {
    // Scroll back up to restore clean initial position
    await swipeVertical(serial, width * 0.5, height * 0.32, height * 0.78, 350);
    await wait(400);
  }
  return {
    isScrollable: moved,
    estimatedHeight: moved ? Math.round(height * 1.8) : height,
  };
}

export async function exploreAndroidScreensForRecon(options: {
  serial: string;
  appId: string;
  credentials: RuntimeRoleCredential[];
  staticPages?: InventoryPage[];
  onLog?: (msg: string) => void;
}): Promise<{
  pages: InventoryPage[];
  gaps: CoverageGapItem[];
}> {
  const { serial, appId, credentials, onLog } = options;
  const pages: InventoryPage[] = [];
  const gaps: CoverageGapItem[] = [];
  const { width, height } = await getScreenResolution(serial);

  const rolesToExplore = credentials.length > 0
    ? credentials
    : [{
        role: 'guest',
        name: 'Guest Explorer',
        identifier: '',
        identifierField: 'email',
        password: '',
        loginPath: '/login',
        source: 'manual' as const,
        verified: true,
      }];

  for (const cred of rolesToExplore) {
    const role = cred.role || 'user';
    onLog?.(`[Android Recon] Memulai eksplorasi UI role "${role}" di emulator ${serial} (tanpa simpan SS/video final)...`);
    await launchAndroidApp(serial, appId, rolesToExplore.length > 1);

    if (cred.identifier && cred.password) {
      const loginRes = await performAndroidLogin(serial, appId, cred);
      if (!loginRes.ok) {
        gaps.push({
          id: `gap-android-auth-${role}`,
          role,
          pagePath: `/${role}/login`,
          pageTitle: `Login Mobile (${role})`,
          phaseFailed: 'AUTH',
          category: 'auth-failed',
          consoleOrDeviceErrors: loginRes.errorNodes,
          technicalReason: loginRes.reason || `Gagal login ke aplikasi mobile sebagai role ${role}.`,
        });
        continue;
      }
    }

    const rootNodes = await readUiNodes(serial, 2);
    const navTabs = detectNavigationTabs(rootNodes, width, height);
    const tabSet = new Set(navTabs.map((t) => t.label.toLowerCase()));
    const rootInner = detectInnerInteractiveTriggers(rootNodes, width, height, tabSet);
    const rootScroll = await detectScreenScrollability(serial, width, height);

    const roleHomeTitle = navTabs[0]?.label || `Home (${role})`;
    pages.push({
      id: createHash('sha256').update(`${role}:home`).digest('hex').slice(0, 12),
      path: navTabs[0] ? `/${role}/${navTabs[0].label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : `/${role}/home`,
      title: `[${role}] ${roleHomeTitle}`,
      state: 'observed',
      role,
      authentication: cred.identifier ? 'auth-required' : 'public',
      viewportHeight: height,
      scrollHeight: rootScroll.estimatedHeight,
      isScrollable: rootScroll.isScrollable,
      interactiveFeatures: [...navTabs.map((t) => ({ ...t })), ...rootInner],
      elements: [...navTabs, ...rootInner].map((item) => ({
        type: item.kind,
        name: item.label,
        selector: item.bounds ? `point:${item.bounds.x},${item.bounds.y}` : `text:${item.label}`,
      })),
      source: `android-live:${role}`,
    });

    // Explore each remaining tab without keeping screenshots
    for (let idx = 1; idx < navTabs.length; idx++) {
      const tab = navTabs[idx];
      if (!tab.bounds) continue;
      onLog?.(`[Android Recon] Role "${role}" memeriksa tab/layar: ${tab.label}`);
      await tapCoordinate(serial, tab.bounds.x, tab.bounds.y);
      await wait(1300);

      let tabNodes = await readUiNodes(serial, 2);
      // If accidentally opened a modal/subview blocking tabs, recover once
      if (tabNodes.length === 0) {
        await pressBackAdb(serial);
        await wait(800);
        tabNodes = await readUiNodes(serial, 1);
      }

      const innerFeatures = detectInnerInteractiveTriggers(tabNodes, width, height, tabSet);
      const scrollInfo = await detectScreenScrollability(serial, width, height);
      const slug = tab.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `tab-${idx}`;

      pages.push({
        id: createHash('sha256').update(`${role}:${slug}`).digest('hex').slice(0, 12),
        path: `/${role}/${slug}`,
        title: `[${role}] ${tab.label}`,
        state: 'observed',
        role,
        authentication: cred.identifier ? 'auth-required' : 'public',
        viewportHeight: height,
        scrollHeight: scrollInfo.estimatedHeight,
        isScrollable: scrollInfo.isScrollable,
        interactiveFeatures: innerFeatures,
        elements: [
          { type: 'tab', name: tab.label, selector: `point:${tab.bounds.x},${tab.bounds.y}` },
          ...innerFeatures.map((item) => ({
            type: item.kind,
            name: item.label,
            selector: item.bounds ? `point:${item.bounds.x},${item.bounds.y}` : `text:${item.label}`,
          })),
        ],
        source: `android-live:${role}`,
      });
    }
  }

  // Enrich screen labels via Gemini if configured and labels look generic
  if (GeminiService.isConfigured() && pages.length > 0) {
    const labelReq = pages.map((p) => ({
      id: p.id,
      rawPathOrWidget: p.title,
      sampleTexts: (p.interactiveFeatures || []).slice(0, 5).map((f) => f.label),
    }));
    const labeled = await GeminiService.labelScreensAndTabs(labelReq).catch(() => ({}));
    for (const page of pages) {
      const nice = labeled?.[page.id];
      if (nice && typeof nice === 'string' && nice.trim()) {
        page.title = nice.trim();
      }
    }
  }

  // Compare with static Dart/Kotlin routes if available; surface non-navigable screens cleanly as candidate metadata
  if (options.staticPages && options.staticPages.length > 0) {
    const discoveredPaths = new Set(pages.map((p) => p.path.toLowerCase()));
    for (const sp of options.staticPages) {
      const normalized = sp.path.toLowerCase();
      if (![...discoveredPaths].some((dp) => dp.endsWith(normalized) || dp.includes(normalized.replace(/^\//, '')))) {
        // Record unreached static candidate screen so Recon displays full static vs live screen map
        pages.push({
          ...sp,
          state: 'candidate',
          role: rolesToExplore[0]?.role || 'user',
          interactiveFeatures: sp.interactiveFeatures || [],
        });
      }
    }
  }

  return { pages, gaps };
}

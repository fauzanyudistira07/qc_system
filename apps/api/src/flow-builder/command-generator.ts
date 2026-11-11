import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import type {
  BatchCommandPlan,
  BatchLongScreenshotCommand,
  BatchVideoFeatureStep,
  BatchVideoRoleCommand,
  CoverageGapItem,
  Inventory,
} from '../discovery/types.ts';
import type { InventoryPage } from '../discovery/source-scanner.ts';
import type { RuntimeRoleCredential } from '../auth-role-provisioner.ts';
import { GeminiService } from '../gemini-service.ts';

function slugifyPath(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned || fallback;
}

function hasUnresolvedDynamicParam(pagePath: string): boolean {
  return /(?::[a-zA-Z_]\w*|\[[^\]]+\]|\{[^}]+\})/.test(pagePath);
}

function resolveDynamicPathFromLinks(rawPath: string, observedLinks: string[]): string | undefined {
  const escaped = rawPath
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:[a-zA-Z_]\w*/g, '([A-Za-z0-9_-]+)')
    .replace(/\\\[[^\]]+\\\]/g, '([A-Za-z0-9_-]+)')
    .replace(/\\\{[^}]+\\\}/g, '([A-Za-z0-9_-]+)');
  const matcher = new RegExp(`^${escaped}$`, 'i');
  for (const link of observedLinks) {
    try {
      const pathname = link.startsWith('http') ? new URL(link).pathname : link.split('?')[0];
      if (matcher.test(pathname) && !hasUnresolvedDynamicParam(pathname)) {
        return pathname;
      }
    } catch {}
  }
  return undefined;
}

export async function generatePostAccCommandPlan(options: {
  inventory: Inventory;
  platform: 'web' | 'android';
  baseUrl: string;
  appId?: string;
  credentials: RuntimeRoleCredential[];
  runPath: string;
}): Promise<{
  plan: BatchCommandPlan;
  unresolvedGaps: CoverageGapItem[];
}> {
  const { inventory, platform, baseUrl, appId, credentials, runPath } = options;
  const commandsDir = path.join(runPath, 'commands');
  const scriptDir = path.join(commandsDir, platform === 'android' ? 'maestro' : 'playwright');
  await mkdir(scriptDir, { recursive: true });

  const allObservedLinks = inventory.pages.flatMap((p) => [
    p.resolvedConcretePath || '',
    p.path,
    ...(p.links || []),
  ]).filter(Boolean);

  const screenshotCommands: BatchLongScreenshotCommand[] = [];
  const videoCommands: BatchVideoRoleCommand[] = [];
  const unresolvedGaps: CoverageGapItem[] = [];

  // Group pages by role; keep public role distinct
  const byRole = new Map<string, InventoryPage[]>();
  for (const page of inventory.pages) {
    if (/\/api(?:\/|$)/i.test(page.path)) continue;
    if (page.state === 'blocked' || page.state === 'error') {
      // Carry forward reconnaissance error/block into final CoverageGaps
      unresolvedGaps.push({
        id: `gap-recon-${page.id}`,
        role: page.role || 'public',
        pagePath: page.path,
        pageTitle: page.title || page.path,
        phaseFailed: 'RECON',
        category: page.status === 401 || page.status === 403 ? 'rbac-forbidden' : (page.status && page.status >= 500 ? 'backend-5xx' : 'navigation-missing'),
        httpStatus: page.status,
        redirectedTo: page.url,
        failedApiCalls: (page.network || []).filter((n) => n.status >= 400).slice(0, 5),
        consoleOrDeviceErrors: (page.errors || []).slice(0, 5),
        technicalReason: (page.errors && page.errors[0]) || `Halaman gagal dibuka saat fase Reconnaissance (status ${page.status ?? 'error'}).`,
      });
      continue;
    }

    const primaryAuthCred = credentials.find((c) => c.token) || credentials.find((c) => c.source === 'manual') || credentials[0];
    const isPublic = page.role === 'public' || (!page.role && (page.path.startsWith('/landing-page') || page.path === '/' || page.path.startsWith('/syarat') || page.path.startsWith('/kebijakan') || page.path === '/helptracker' || page.path.includes('login') || page.path.includes('password')));
    const role = isPublic ? 'public' : (page.role && page.role !== 'public' ? page.role : (primaryAuthCred?.role || 'travel_agent'));
    const arr = byRole.get(role) ?? [];
    arr.push(page);
    byRole.set(role, arr);
  }

  // Ensure every provisioned role gets at least one entry in videoCommands
  for (const cred of credentials) {
    if (!byRole.has(cred.role)) byRole.set(cred.role, []);
  }

  const seenSsKey = new Set<string>();

  for (const [role, rawPages] of byRole.entries()) {
    const pages = rawPages.slice();
    const roleCred = credentials.find((c) => c.role === role);
    const videoSteps: BatchVideoFeatureStep[] = [];

    for (const [idx, page] of pages.entries()) {
      let concretePath = page.resolvedConcretePath || page.path;

      if (hasUnresolvedDynamicParam(concretePath)) {
        const fromLinks = resolveDynamicPathFromLinks(concretePath, allObservedLinks);
        if (fromLinks) {
          concretePath = fromLinks;
        } else {
          // Fallback deterministik instan: ganti :id atau {id} dengan 1 agar rute dinamis tetap tertangkap
          concretePath = concretePath.replace(/:[a-zA-Z_]\w*/g, '1').replace(/\{[^}]+\}/g, '1');
        }
      }

      if (hasUnresolvedDynamicParam(concretePath)) {
        unresolvedGaps.push({
          id: `gap-param-${role}-${page.id}`,
          role,
          pagePath: page.path,
          pageTitle: page.title || page.path,
          phaseFailed: 'RECON',
          category: 'dynamic-param-unresolved',
          technicalReason: `Rute dinamis "${page.path}" tidak memiliki sampel ID nyata dari halaman daftar maupun database.`,
        });
        continue;
      }

      const slug = slugifyPath(concretePath, `page-${idx + 1}`);
      const ssKey = `${role}::${slug}`;
      if (!seenSsKey.has(ssKey)) {
        seenSsKey.add(ssKey);
        screenshotCommands.push({
          id: `ss-${role}-${idx + 1}`,
          role,
          pageId: page.id,
          pagePath: concretePath,
          pageTitle: page.title || concretePath,
          targetUrl: platform === 'web' ? new URL(concretePath, baseUrl).toString() : undefined,
          scrollContainerSelector: page.scrollContainerSelector,
          outputFilename: `${role}__${slug}__full.png`,
        });
      }

      videoSteps.push({
        kind: 'navigate',
        label: `Buka halaman: ${page.title || concretePath}`,
        pagePath: concretePath,
        scrollContainerSelector: page.scrollContainerSelector,
        pauseMs: 800,
      });

      for (const feat of page.interactiveFeatures || []) {
        videoSteps.push({
          kind: 'click-feature',
          label: `Klik ${feat.kind}: ${feat.label}`,
          pagePath: concretePath,
          selector: feat.selector,
          bounds: feat.bounds,
          pauseMs: 950,
        });
      }

      videoSteps.push({
        kind: 'scroll-full',
        label: `Scroll penuh halaman: ${concretePath}`,
        pagePath: concretePath,
        scrollContainerSelector: page.scrollContainerSelector,
        pauseMs: 650,
      });
    }

    const videoFilename = platform === 'android' ? `video__${role}.mp4` : `video__${role}.webm`;
    videoCommands.push({
      role,
      outputFilename: videoFilename,
      loginPath: roleCred?.loginPath || '/login',
      steps: videoSteps,
    });

    // Write transparent runnable Playwright / Maestro scripts for auditability
    if (platform === 'android') {
      const maestroSteps: object[] = [];
      for (const s of videoSteps) {
        if (s.kind === 'click-feature' && s.bounds) {
          maestroSteps.push({ tapOn: { point: `${s.bounds.x},${s.bounds.y}`, optional: true } });
          maestroSteps.push({ waitForAnimationToEnd: { timeout: s.pauseMs ?? 900 } });
        } else if (s.kind === 'scroll-full') {
          maestroSteps.push({ swipe: { start: '50%,75%', end: '50%,25%', duration: 400 } });
        }
      }
      const yamlDoc = `appId: ${appId || 'com.example.app'}\nname: "Phase-1 Role Journey: ${role}"\n---\n${stringify(maestroSteps, { indentSeq: false })}`;
      await writeFile(path.join(scriptDir, `${role}.yaml`), yamlDoc, 'utf8');
    } else {
      const specLines = [
        `// Auto-generated Phase-1 full-role script for role: ${role}`,
        `import { test } from '@playwright/test';`,
        `test('Phase-1 Full Coverage: ${role}', async ({ page }) => {`,
        ...videoSteps.map((s) => {
          if (s.kind === 'navigate') return `  await page.goto(${JSON.stringify(new URL(s.pagePath || '/', baseUrl).toString())});`;
          if (s.kind === 'click-feature' && s.selector) return `  await page.locator(${JSON.stringify(s.selector)}).first().click().catch(() => {}); await page.waitForTimeout(${s.pauseMs ?? 900});`;
          if (s.kind === 'scroll-full') return `  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(${s.pauseMs ?? 600});`;
          return `  await page.waitForTimeout(${s.pauseMs ?? 500});`;
        }),
        `});`,
      ];
      await writeFile(path.join(scriptDir, `${role}.spec.ts`), specLines.join('\n'), 'utf8');
    }
  }

  const ssPlanPath = path.join(commandsDir, 'batch-ss-plan.json');
  const videoPlanPath = path.join(commandsDir, 'batch-video-plan.json');

  await writeFile(ssPlanPath, JSON.stringify({ generatedAt: new Date().toISOString(), platform, commands: screenshotCommands }, null, 2), 'utf8');
  await writeFile(videoPlanPath, JSON.stringify({ generatedAt: new Date().toISOString(), platform, commands: videoCommands }, null, 2), 'utf8');

  return {
    plan: {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      platform,
      longScreenshotPlanPath: path.relative(runPath, ssPlanPath).replace(/\\/g, '/'),
      videoPlanPath: path.relative(runPath, videoPlanPath).replace(/\\/g, '/'),
      screenshotCommands,
      videoCommands,
    },
    unresolvedGaps,
  };
}

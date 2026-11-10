import { stringify } from 'yaml';
import type { FlowStep } from '@qc/flow-schema';
import type { Inventory, DiscoveryConfig, GeneratedFlow } from '../discovery/types.ts';
import { detectCapabilities } from '../discovery/capability-model.ts';

function buildRawMaestroYaml(appId: string, name: string, commands: object[]): string {
  const header = `appId: ${appId}\nname: "${name}"\n---\n`;
  return header + stringify(commands, { indentSeq: false });
}

function buildGenericAndroidFlows(inventory: Inventory, config: DiscoveryConfig): GeneratedFlow[] {
  const appId = config.appId || 'com.example.app';
  const roles = [...new Set(inventory.pages.map((p) => p.role).filter(Boolean) as string[])];
  const primaryAccount = config.accounts?.[0];

  const flows: GeneratedFlow[] = [];

  if (primaryAccount?.email) {
    flows.push({
      id: 'android-auth-check',
      name: `Autentikasi (${primaryAccount.role || 'user'})`,
      platform: 'android',
      status: 'READY',
      source: buildRawMaestroYaml(appId, `Autentikasi (${primaryAccount.role || 'user'})`, [
        { tapOn: { text: "Don't allow", optional: true } },
        { waitForAnimationToEnd: { timeout: 1200 } },
        { tapOn: { text: 'Email', optional: true } },
        { inputText: primaryAccount.email },
        { tapOn: { text: 'Password', optional: true } },
        { inputText: primaryAccount.password || '' },
        { tapOn: { text: 'Login', optional: true } },
        { waitForAnimationToEnd: { timeout: 3000 } },
      ]),
    });
  }

  const groupByRole = new Map<string, typeof inventory.pages>();
  for (const page of inventory.pages) {
    const role = page.role || 'default';
    const arr = groupByRole.get(role) ?? [];
    arr.push(page);
    groupByRole.set(role, arr);
  }

  for (const [role, pages] of groupByRole.entries()) {
    const commands: object[] = [{ waitForAnimationToEnd: { timeout: 1000 } }];
    for (const page of pages) {
      const firstFeature = page.interactiveFeatures?.[0];
      if (firstFeature?.bounds) {
        commands.push({ tapOn: { point: `${firstFeature.bounds.x},${firstFeature.bounds.y}`, optional: true } });
        commands.push({ waitForAnimationToEnd: { timeout: 1000 } });
      }
      if (page.isScrollable) {
        commands.push({ swipe: { start: '50%,75%', end: '50%,25%', duration: 400 } });
      }
      const slug = page.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'screen';
      commands.push({ takeScreenshot: `${role}__${slug}__full` });
    }
    flows.push({
      id: `android-role-${role}`,
      name: `Eksplorasi Penuh Role ${role} (${pages.length} layar)`,
      platform: 'android',
      status: 'READY',
      source: buildRawMaestroYaml(appId, `Eksplorasi Role ${role}`, commands),
    });
  }

  if (flows.length === 0 && roles.length === 0) {
    flows.push({
      id: 'android-launch-smoke',
      name: 'Launch & Smoke Capture Mobile',
      platform: 'android',
      status: 'READY',
      source: buildRawMaestroYaml(appId, 'Launch & Smoke Capture Mobile', [
        { waitForAnimationToEnd: { timeout: 1500 } },
        { takeScreenshot: 'mobile-launch-full' },
      ]),
    });
  }

  return flows;
}

export function buildFlows(inventory: Inventory, config: DiscoveryConfig): GeneratedFlow[] {
  if (config.platform === 'android') {
    return buildGenericAndroidFlows(inventory, config);
  }

  const flows: GeneratedFlow[] = [];
  const staticRoutes = inventory.pages.map((p) => p.path).filter((r) => !/\/api(?:\/|$)/i.test(r));
  const loginPath = config.rules?.loginPath || staticRoutes.find((r) => /\/(?:login|signin|auth\/login)/i.test(r)) || '/login';
  const successUrl = config.rules?.successUrl || '/dashboard';
  const emailSelector = config.rules?.emailSelector || "input[name='email'], input[name='username'], #email, input[type='email'], input[type='text']";
  const passwordSelector = config.rules?.passwordSelector || "input[type='password'], #password";
  const submitSelector = config.rules?.submitSelector || "button[type='submit'], input[type='submit']";

  const capabilityProfile = inventory.capabilities ?? detectCapabilities(inventory);
  const hasAuthNeed = staticRoutes.some((r) => /login|auth|dashboard|admin|user|portal/i.test(r)) ||
    Boolean(config.accounts && config.accounts.length > 0);

  const defaultAccount = config.accounts?.[0];
  const defaultVars: Record<string, string> = defaultAccount?.email
    ? { QC_EMAIL: defaultAccount.email, QC_PASSWORD: defaultAccount.password || '' }
    : {};

  const toSource = (name: string, steps: FlowStep[]) => stringify({
    schemaVersion: '1.0',
    name,
    target: { platform: 'web', baseUrl: config.baseUrl },
    variables: defaultVars,
    execution: { timeoutMs: 45000, retries: 0, screenshot: 'always', trace: 'retain-on-failure', video: 'on' },
    steps,
  });

  const loginSteps = (): FlowStep[] => (hasAuthNeed && defaultAccount?.email) ? [
    { id: 'login-page', action: 'open', url: loginPath },
    { id: 'login-email', action: 'input', target: { selector: emailSelector }, value: '${QC_EMAIL}' },
    { id: 'login-password', action: 'input', target: { selector: passwordSelector }, value: '${QC_PASSWORD}' },
    { id: 'login-submit', action: 'click', target: { selector: submitSelector } },
    { id: 'login-success', action: 'assertUrl', value: successUrl },
  ] : [];

  // Group observed & candidate pages by role generically
  const roleGroups = new Map<string, typeof inventory.pages>();
  for (const page of inventory.pages) {
    if (/\/api(?:\/|$)/i.test(page.path)) continue;
    const role = page.role || (page.authentication === 'auth-required' ? 'authenticated' : 'public');
    const list = roleGroups.get(role) ?? [];
    list.push(page);
    roleGroups.set(role, list);
  }

  for (const [role, pages] of roleGroups.entries()) {
    const steps: FlowStep[] = role !== 'public' ? [...loginSteps()] : [];
    for (const [idx, page] of pages.slice(0, 40).entries()) {
      const targetPath = (page.resolvedConcretePath || page.path).replace(/:[a-zA-Z_]\w*/g, '1').replace(/\{[^}]+\}/g, '1');
      const slug = targetPath.replace(/[^a-z0-9]/gi, '-').replace(/^-+|-+$/g, '') || `page-${idx}`;
      steps.push({ id: `${role}-${idx}-open`, action: 'open', url: targetPath });
      steps.push({ id: `${role}-${idx}-body`, action: 'assertVisible', target: { selector: 'body' } });
      for (const [fIdx, feat] of (page.interactiveFeatures || []).slice(0, 10).entries()) {
        if (feat.selector) {
          steps.push({ id: `${role}-${idx}-feat-${fIdx}`, action: 'click', target: { selector: feat.selector } });
        }
      }
      steps.push({ id: `${role}-${idx}-snap`, action: 'screenshot', name: `${role}__${slug}__full` });
    }
    if (steps.length > 0) {
      flows.push({
        id: `web-role-${role}`,
        name: `Audit Cakupan Halaman Role ${role} (${pages.length} halaman)`,
        source: toSource(`Audit Role ${role}`, steps),
        platform: 'web',
        status: 'READY',
      });
    }
  }

  // Fallback capability map flows (read-only phase 1, zero destructive submissions)
  if (flows.length === 0) {
    for (const capability of capabilityProfile.capabilities.slice(0, 6)) {
      const routes = [...new Set(capability.evidence.routes)]
        .filter((route) => route.startsWith('/') && !route.includes('{') && !/\/api(?:\/|$)/i.test(route) && route !== loginPath)
        .slice(0, 6);
      if (!routes.length) continue;
      const slug = capability.id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
      const steps: FlowStep[] = routes.flatMap((route, index) => [
        { id: `${slug}-${index}-open`, action: 'open', url: route },
        { id: `${slug}-${index}-body`, action: 'assertVisible', target: { selector: 'body' } },
        { id: `${slug}-${index}-snap`, action: 'screenshot', name: `public__${slug}-${index}__full` },
      ]);
      flows.push({
        id: `web-capability-${slug}`,
        name: `Capability · ${capability.label}`,
        source: toSource(`Capability · ${capability.label}`, steps),
        platform: 'web',
        status: capability.status === 'detected' ? 'READY' : 'REVIEW_REQUIRED',
      });
    }
  }

  return flows;
}

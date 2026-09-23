import type { NormalizedFlow } from '@qc/flow-schema';

type Target = { strategy: string; value: string; role?: string; name?: string; exact?: boolean };

function js(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function compilePlaywrightFlow(flow: NormalizedFlow): string {
  const serializedFlow = js(flow);
  return `import { chromium, firefox, webkit, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

type Target = { strategy: string; value: string; role?: string; name?: string; exact?: boolean };
const flow: any = ${serializedFlow};
const baseUrl = process.env.QC_BASE_URL ?? flow.target.baseUrl ?? 'http://127.0.0.1:8000';

function replaceVariables(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/\\$\\{([^}]+)\\}/g, (_, key: string) => String(flow.variables[key] ?? process.env[key] ?? \`MISSING:\${key}\`));
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
    case 'id': return page.locator(raw.value.startsWith('#') ? raw.value : \`#\${raw.value}\`);
    case 'css': return page.locator(raw.value);
    default: throw new Error(\`Locator strategy \${raw.strategy} tidak didukung oleh generator Playwright\`);
  }
}

function absoluteUrl(url: string) {
  return new URL(url, baseUrl).toString();
}

async function main() {
  const browserType = flow.target.browser === 'firefox' ? firefox : flow.target.browser === 'webkit' ? webkit : chromium;
  const browser = await browserType.launch({ headless: process.env.QC_HEADLESS !== 'false' });
  const context = await browser.newContext({ viewport: flow.target.viewport });
  const page = await context.newPage();
  const artifactDir = path.resolve(process.env.QC_ARTIFACT_DIR ?? '.qc-artifacts/generated/playwright');

  try {
    for (const step of flow.steps) {
      const value = replaceVariables(step.value);
      const target = resolveLocator(page, step.target as Target | undefined);
      switch (step.action) {
        case 'open': await page.goto(absoluteUrl(String(replaceVariables(step.url))), { waitUntil: 'domcontentloaded', timeout: step.timeoutMs }); break;
        case 'click': await target.click({ timeout: step.timeoutMs }); break;
        case 'input': await target.fill(String(value ?? ''), { timeout: step.timeoutMs }); break;
        case 'clear': await target.fill('', { timeout: step.timeoutMs }); break;
        case 'back': await page.goBack({ waitUntil: 'domcontentloaded', timeout: step.timeoutMs }); break;
        case 'reload': await page.reload({ waitUntil: 'domcontentloaded', timeout: step.timeoutMs }); break;
        case 'scroll': await page.mouse.wheel(0, Number(value ?? 600)); break;
        case 'waitFor': step.durationMs ? await page.waitForTimeout(step.durationMs) : await target.waitFor({ state: 'visible', timeout: step.timeoutMs }); break;
        case 'assertVisible': await target.waitFor({ state: 'visible', timeout: step.timeoutMs }); break;
        case 'assertNotVisible': await target.waitFor({ state: 'hidden', timeout: step.timeoutMs }); break;
        case 'assertText': {
          const expected = String(value ?? '');
          const actual = await target.innerText({ timeout: step.timeoutMs });
          if (!actual.includes(expected)) throw new Error(\`Expected text "\${expected}", actual "\${actual}"\`);
          break;
        }
        case 'assertUrl': {
          const expected = String(value ?? step.url ?? '');
          if (!page.url().includes(expected)) throw new Error(\`Expected URL "\${expected}", actual "\${page.url()}"\`);
          break;
        }
        case 'screenshot': await mkdir(artifactDir, { recursive: true }); await page.screenshot({ path: path.join(artifactDir, String(step.name ?? step.id) + '.png'), fullPage: true }); break;
        case 'launchApp': throw new Error('launchApp hanya tersedia untuk Maestro adapter');
      }
      console.log(\`PASS \${step.id}: \${step.action}\`);
    }
    console.log(\`PASS flow: \${flow.name}\`);
  } catch (error) {
    await mkdir(artifactDir, { recursive: true });
    await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => undefined);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
`;
}

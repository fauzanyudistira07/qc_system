import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });

  await page.goto('http://localhost:4180', { waitUntil: 'networkidle' });

  // Log in
  const emailInput = page.locator('input[type="email"], input[placeholder*="domain"], input[placeholder*="admin"]');
  if (await emailInput.count() > 0) {
    await emailInput.first().fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk ke Control Center"), button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  const outDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';

  // Navigate to Media
  await page.locator('button.nav-item:has-text("Media"), .nav-item:has-text("Media")').first().click();
  await page.waitForTimeout(2500);

  const select = page.locator('select.qc-group-dropdown');
  const options = await select.locator('option').allInnerTexts();
  const f10 = options.find(o => o.startsWith('10.'));
  console.log('Targeting f10:', f10);
  if (f10) {
    await select.selectOption({ label: f10 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'verified_flow_10_media.png') });
    console.log('Saved verified_flow_10_media.png!');
  }

  await browser.close();
}

main().catch(console.error);

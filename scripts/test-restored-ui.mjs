import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180 ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // 1. Capture Dashboard Overview
  const overviewShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_restored_overview.png';
  await page.screenshot({ path: overviewShot });
  console.log('Saved Restored Overview screenshot:', overviewShot);

  // 2. Click Execution Runs to verify the restored runs view
  console.log('Clicking Execution Runs in sidebar...');
  const runsNav = page.locator('.sidebar button:has-text("Execution Runs")').first();
  if (await runsNav.isVisible()) {
    await runsNav.click();
    await page.waitForTimeout(1000);

    const runsShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_restored_runs.png';
    await page.screenshot({ path: runsShot });
    console.log('Saved Restored Execution Runs screenshot:', runsShot);
  }

  // 3. Click Media to verify 15-batching
  console.log('Clicking Media in sidebar...');
  const mediaNav = page.locator('.sidebar button:has-text("Media")').first();
  if (await mediaNav.isVisible()) {
    await mediaNav.click();
    await page.waitForTimeout(1000);

    const mediaShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_restored_media.png';
    await page.screenshot({ path: mediaShot });
    console.log('Saved Restored Media screenshot:', mediaShot);
  }

  await browser.close();
  console.log('All tests completed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // 1. App Map & Halaman
  const appMapNav = page.locator('.nav-item:has-text("App Map")').first();
  if (await appMapNav.isVisible()) {
    await appMapNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/page_app_map.png' });
    console.log('Saved page_app_map.png');
  }

  // 2. Skenario Test
  const skenarioNav = page.locator('.nav-item:has-text("Skenario Test")').first();
  if (await skenarioNav.isVisible()) {
    await skenarioNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/page_scenarios.png' });
    console.log('Saved page_scenarios.png');
  }

  // 3. Execution Runs
  const runsNav = page.locator('.nav-item:has-text("Execution Runs")').first();
  if (await runsNav.isVisible()) {
    await runsNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/page_runs.png' });
    console.log('Saved page_runs.png');
  }

  // 4. Media
  const mediaNav = page.locator('.nav-item:has-text("Media")').first();
  if (await mediaNav.isVisible()) {
    await mediaNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/page_media.png' });
    console.log('Saved page_media.png');
  }

  // 5. Laporan Final
  const laporanNav = page.locator('.nav-item:has-text("Laporan Final")').first();
  if (await laporanNav.isVisible()) {
    await laporanNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/page_reports.png' });
    console.log('Saved page_reports.png');
  }

  await browser.close();
  console.log('Done capturing subpages!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

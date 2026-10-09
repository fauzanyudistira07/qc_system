import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180/ ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin@qcmaestro.com...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button[type="submit"], button:has-text("Masuk ke Control Center")').first().click();
    await page.waitForTimeout(2500);
  }

  // Navigate to Reports tab
  console.log('Navigating to Final Report...');
  const reportNav = page.locator('button.nav-item:has-text("Final Report"), button.nav-item:has-text("Laporan"), button:has-text("Report")').first();
  await reportNav.waitFor({ state: 'visible', timeout: 10000 });
  await reportNav.click();
  await page.waitForTimeout(1500);

  // Scroll down to Executive Summary & KPI cards
  await page.evaluate(() => {
    const el = document.querySelector('.main-content');
    if (el) el.scrollTo({ top: 2200, behavior: 'instant' });
  });
  await page.waitForTimeout(1200);

  // Capture KPI cards area
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/report_kpi_score_deduction.png' });
  console.log('Saved report_kpi_score_deduction.png');

  // Scroll further down to Defect Ledger
  await page.evaluate(() => {
    const el = document.querySelector('.main-content');
    if (el) el.scrollTo({ top: 3100, behavior: 'instant' });
  });
  await page.waitForTimeout(1200);

  // Capture Defect Ledger area
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/report_defect_ledger_attribution.png' });
  console.log('Saved report_defect_ledger_attribution.png');

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);

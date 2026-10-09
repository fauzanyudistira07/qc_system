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

  // Go to Laporan Final
  const laporanNav = page.locator('.nav-item:has-text("Laporan Final")').first();
  if (await laporanNav.isVisible()) {
    await laporanNav.click();
    await page.waitForTimeout(1500);

    // Scroll to Executive Summary
    const execSummary = page.locator('.panel:has-text("Executive Summary")').first();
    if (await execSummary.isVisible()) {
      await execSummary.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/fix_report_executive_summary.png' });
      console.log('Saved fix_report_executive_summary.png');
    }

    // Scroll to Catatan Bug & Error Log
    const bugPanel = page.locator('.panel:has-text("Catatan Bug & Error Log")').first();
    if (await bugPanel.isVisible()) {
      await bugPanel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/fix_report_bug_log.png' });
      console.log('Saved fix_report_bug_log.png');
    }
  }

  await browser.close();
  console.log('Done capturing report detail!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

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

  // 1. Capture initial overview state (Jamaahku active)
  const shot1 = 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/qc_summary_upgraded_jamaahku.png';
  await page.screenshot({ path: shot1 });
  console.log('Saved shot 1:', shot1);

  // 2. Click trigger -> click Taskia Digital -> click Pengecekan #5
  console.log('Opening project switcher...');
  const trigger = page.locator('.sidebar-project-trigger-card').first();
  await trigger.click();
  await page.waitForTimeout(600);

  const taskiaHeader = page.locator('.sidebar-project-item-header:has-text("Taskia Digital")').first();
  if (await taskiaHeader.isVisible()) {
    await taskiaHeader.click();
    await page.waitForTimeout(600);

    const run5 = page.locator('.sidebar-run-entry:has-text("Pengecekan #5")').first();
    if (await run5.isVisible()) {
      await run5.click();
      await page.waitForTimeout(1200);

      // Close the project switcher by clicking trigger again
      await trigger.click();
      await page.waitForTimeout(600);

      const shot2 = 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/qc_summary_upgraded_taskia.png';
      await page.screenshot({ path: shot2 });
      console.log('Saved shot 2:', shot2);
    }
  }

  await browser.close();
  console.log('Done capturing upgraded summary!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

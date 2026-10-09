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

  // Click "+ New QC Run" button
  const newBtn = page.locator('.new-job-btn, button:has-text("New QC Run")').first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/page_new_run.png' });
    console.log('Saved page_new_run.png');
  }

  await browser.close();
  console.log('Done capturing new run wizard!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

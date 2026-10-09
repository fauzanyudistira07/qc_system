import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1800);
  }

  const newBtn = page.locator('.new-job-btn').first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(800);
  }

  await page.evaluate(() => {
    const el = document.querySelector('.main-content') || document.querySelector('.workspace-view');
    if (el) el.scrollTop = 700;
    else window.scrollTo(0, 700);
  });
  await page.waitForTimeout(400);

  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/new_qc_run_scrolled.png' });
  console.log('Scrolled screenshot captured!');
  await browser.close();
}

main().catch(console.error);

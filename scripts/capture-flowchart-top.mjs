import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  await page.locator('.nav-item:has-text("Live Terminal")').first().click();
  await page.waitForTimeout(1500);

  // Scroll so that the flowchart card header and Start node are visible
  await page.evaluate(() => {
    const el = document.querySelector('.bf-flowchart-card');
    if (el) {
      const ws = document.querySelector('.workspace-view');
      if (ws) ws.scrollTop = el.offsetTop - 80;
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/live_terminal_flowchart_header_top.png'
  });
  console.log('Saved live_terminal_flowchart_header_top.png');

  await browser.close();
}

main().catch(console.error);

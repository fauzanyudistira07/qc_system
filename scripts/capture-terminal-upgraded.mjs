import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180 ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Login if needed
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // Navigate to Live Terminal
  const termNav = page.locator('.nav-item:has-text("Live Terminal")').first();
  if (await termNav.isVisible()) {
    await termNav.click();
    await page.waitForTimeout(1500);
  }

  // Click "Urutan Langkah"
  const stepsBtn = page.locator('.bf-mode-btn:has-text("Urutan Langkah")').first();
  if (await stepsBtn.isVisible()) {
    await stepsBtn.click();
    await page.waitForTimeout(500);
  }

  // Scroll to steps card and capture the bottom
  const stepsCard = page.locator('.bf-steps-explanation-card').first();
  if (await stepsCard.isVisible()) {
    await stepsCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/business_flow_steps_without_two_boxes.png'
    });
    console.log('Saved business_flow_steps_without_two_boxes.png');
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

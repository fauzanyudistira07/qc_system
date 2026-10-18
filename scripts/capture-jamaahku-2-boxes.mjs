import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180 ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check login
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // Open modal command center
  console.log('Opening project picker modal...');
  const triggerBtn = page.locator('.sidebar-project-trigger-card').first();
  await triggerBtn.click();
  await page.waitForTimeout(800);

  // Click Jamaahku Travel Agent in the left sidebar of modal
  console.log('Selecting Jamaahku Travel Agent...');
  const jamaahkuItem = page.locator('.project-nav-item:has-text("Jamaahku Travel Agent")').first();
  if (await jamaahkuItem.isVisible()) {
    await jamaahkuItem.click();
    await page.waitForTimeout(800);
  }

  const screenshotPath = '/home/fauzan/.gemini/antigravity-ide/brain/3713e5a9-32a1-4100-a71c-162c3ba2ec42/jamaahku_2_boxes_modal.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});

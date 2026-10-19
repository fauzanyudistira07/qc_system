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
  await page.waitForTimeout(1000);

  // Click AL- Hikmah Digital in the left sidebar of modal
  console.log('Selecting AL- Hikmah Digital...');
  const alHikmahItem = page.locator('.project-nav-item:has-text("AL- Hikmah Digital")').first();
  if (await alHikmahItem.isVisible()) {
    await alHikmahItem.click();
    await page.waitForTimeout(1200);
  }

  const artifactDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';
  const screenshotPath = path.join(artifactDir, 'alhikmah_2_boxes_modal.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved modal screenshot to:', screenshotPath);

  // Also click on the new AI box to open it
  console.log('Selecting new AI run box...');
  const newRunCard = page.locator('.run-card:has-text("AI-Assisted")').first();
  if (await newRunCard.isVisible()) {
    await newRunCard.click();
    await page.waitForTimeout(2000);
    const dashboardShot = path.join(artifactDir, 'alhikmah_ai_suite_dashboard.png');
    await page.screenshot({ path: dashboardShot });
    console.log('Saved dashboard screenshot to:', dashboardShot);
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});

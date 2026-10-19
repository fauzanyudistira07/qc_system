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
  await page.waitForTimeout(800);

  // Check login
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1500);
  }

  // Open modal command center
  console.log('Opening project picker modal...');
  const triggerBtn = page.locator('.sidebar-project-trigger-card').first();
  await triggerBtn.click();
  await page.waitForTimeout(800);

  // Click AL- Hikmah Digital in the left sidebar of modal
  console.log('Selecting AL- Hikmah Digital...');
  const alHikmahItem = page.locator('.project-nav-item:has-text("AL- Hikmah Digital")').first();
  if (await alHikmahItem.isVisible()) {
    await alHikmahItem.click();
    await page.waitForTimeout(800);
  }

  const artifactDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';
  const modalRunningShot = path.join(artifactDir, 'alhikmah_modal_running.png');
  await page.screenshot({ path: modalRunningShot });
  console.log('Saved modal running screenshot to:', modalRunningShot);

  // Click on the RUNNING card to view it on dashboard
  const runningCard = page.locator('.run-card:has-text("AI-Assisted")').first();
  if (await runningCard.isVisible()) {
    await runningCard.click();
    await page.waitForTimeout(1500);
    const dashboardRunningShot = path.join(artifactDir, 'alhikmah_dashboard_running.png');
    await page.screenshot({ path: dashboardRunningShot });
    console.log('Saved dashboard running screenshot to:', dashboardRunningShot);
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});

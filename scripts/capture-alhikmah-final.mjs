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

  // Login as admin
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1500);
  }

  const artifactDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';

  // 1. Open Project Switcher modal
  console.log('Opening project picker modal...');
  const triggerBtn = page.locator('.sidebar-project-trigger-card').first();
  await triggerBtn.click();
  await page.waitForTimeout(800);

  // 2. Click AL- Hikmah Digital in left list of modal
  console.log('Selecting AL- Hikmah Digital in modal...');
  const alHikmahItem = page.locator('.project-nav-item:has-text("AL- Hikmah Digital")').first();
  if (await alHikmahItem.isVisible()) {
    await alHikmahItem.click();
    await page.waitForTimeout(1000);
  }

  // 3. Capture 2-box comparison modal
  const modalShot = path.join(artifactDir, 'alhikmah_2_boxes_modal.png');
  await page.screenshot({ path: modalShot });
  console.log('✓ Saved 2-box modal screenshot to:', modalShot);

  // 4. Click Buka Room on AI-Assisted card
  console.log('Clicking Buka Room on AI-Assisted card...');
  const aiSuiteCard = page.locator('.run-card:has-text("AI-Assisted Retest Suite")').first();
  if (await aiSuiteCard.isVisible()) {
    await aiSuiteCard.click();
    await page.waitForTimeout(1500);
  }

  // 5. Capture Dashboard
  const dashboardShot = path.join(artifactDir, 'alhikmah_ai_suite_dashboard.png');
  await page.screenshot({ path: dashboardShot });
  console.log('✓ Saved Al-Hikmah AI Suite dashboard to:', dashboardShot);

  // 6. Open Live Terminal view
  console.log('Opening Live Terminal view...');
  const terminalNavBtn = page.locator('button.nav-item:has-text("Live Terminal")').first();
  if (await terminalNavBtn.isVisible()) {
    await terminalNavBtn.click();
    await page.waitForTimeout(1200);
    const terminalShot = path.join(artifactDir, 'alhikmah_live_terminal.png');
    await page.screenshot({ path: terminalShot });
    console.log('✓ Saved Live Terminal screenshot to:', terminalShot);
  }

  await browser.close();
  console.log('Done capturing all screenshots!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

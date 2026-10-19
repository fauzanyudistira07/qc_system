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
    console.log('Logging in...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1500);
  }

  // Set localStorage and sessionStorage to Al-Hikmah directly
  await page.evaluate(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
    sessionStorage.removeItem('qc_maestro_active_job_cache');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const artifactDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';

  // 1. Capture Dashboard of Al-Hikmah Digital AI Suite
  const dashboardShot = path.join(artifactDir, 'alhikmah_ai_suite_dashboard.png');
  await page.screenshot({ path: dashboardShot });
  console.log('✓ Saved Al-Hikmah AI Suite dashboard to:', dashboardShot);

  // 2. Open Live Terminal view
  const terminalNavBtn = page.locator('button.nav-item:has-text("Live Terminal")').first();
  if (await terminalNavBtn.isVisible()) {
    await terminalNavBtn.click();
    await page.waitForTimeout(1200);
    const terminalShot = path.join(artifactDir, 'alhikmah_live_terminal.png');
    await page.screenshot({ path: terminalShot });
    console.log('✓ Saved Live Terminal screenshot to:', terminalShot);
  }

  // 3. Open Project Switcher modal
  const triggerBtn = page.locator('.sidebar-project-trigger-card').first();
  await triggerBtn.click();
  await page.waitForTimeout(1000);

  const alHikmahItem = page.locator('.project-nav-item:has-text("AL- Hikmah Digital")').first();
  if (await alHikmahItem.isVisible()) {
    await alHikmahItem.click();
    await page.waitForTimeout(1000);
  }

  const modalShot = path.join(artifactDir, 'alhikmah_2_boxes_modal.png');
  await page.screenshot({ path: modalShot });
  console.log('✓ Saved 2-box modal screenshot to:', modalShot);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

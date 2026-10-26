import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });

  const page = await context.newPage();

  // Set active job in localStorage before navigating
  await page.addInitScript(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });

  console.log('Navigating to http://localhost:4180...');
  await page.goto('http://localhost:4180', { waitUntil: 'networkidle' });

  // 1. Log in if needed
  const emailInput = page.locator('input[type="email"], input[placeholder*="domain"], input[placeholder*="admin"]');
  if (await emailInput.count() > 0) {
    console.log('Logging in as admin...');
    await emailInput.first().fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk ke Control Center"), button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  // 2. Ensure job fd7d9a1e is active
  await page.evaluate(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const outDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';

  // 3. Navigate to Execution Runs
  console.log('Navigating to Execution Runs...');
  const execNav = page.locator('button.nav-item:has-text("Execution Runs"), .nav-item:has-text("Execution Runs")');
  if (await execNav.count() > 0) {
    await execNav.first().click();
    await page.waitForTimeout(2000);
  }

  // Scroll to show flows 10-15
  const flow11 = page.locator('text=11. Quick Actions, text=Kalender Kegiatan');
  if (await flow11.count() > 0) {
    await flow11.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  const tableScreenshotPath = path.join(outDir, 'verified_execution_table_alhikmah.png');
  await page.screenshot({ path: tableScreenshotPath });
  console.log('Saved table screenshot to:', tableScreenshotPath);

  // 4. Navigate to Media & Bukti Visual
  console.log('Navigating to Media & Bukti Visual...');
  const mediaNav = page.locator('button.nav-item:has-text("Media"), .nav-item:has-text("Media")');
  if (await mediaNav.count() > 0) {
    await mediaNav.first().click();
    await page.waitForTimeout(2500);
  } else {
    const drawerBtn = page.locator('button:has-text("Daftar Bukti"), button:has-text("Lihat Bukti")');
    if (await drawerBtn.count() > 0) {
      await drawerBtn.first().click();
      await page.waitForTimeout(2500);
    }
  }

  const drawerScreenshotPath = path.join(outDir, 'verified_media_drawer_alhikmah.png');
  await page.screenshot({ path: drawerScreenshotPath });
  console.log('Saved media screenshot to:', drawerScreenshotPath);

  await browser.close();
  console.log('Verification completed successfully!');
}

main().catch(err => {
  console.error('Error during UI verification:', err);
  process.exit(1);
});

import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 }
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });

  await page.goto('http://localhost:4180', { waitUntil: 'networkidle' });

  // Log in if needed
  const emailInput = page.locator('input[type="email"], input[placeholder*="domain"], input[placeholder*="admin"]');
  if (await emailInput.count() > 0) {
    await emailInput.first().fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk ke Control Center"), button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  // Navigate to Laporan Final (currentView === 'report')
  console.log('Navigating to Laporan Final...');
  await page.locator('button.nav-item:has-text("Laporan Final"), .nav-item:has-text("Laporan Final")').first().click();
  await page.waitForTimeout(2000);

  // Scroll down to the table in Section 3
  const flow11Text = page.locator('text=11. Quick Actions: Kalender');
  if (await flow11Text.count() > 0) {
    await flow11Text.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  const outDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';
  const reportTablePath = path.join(outDir, 'verified_laporan_final_table.png');
  await page.screenshot({ path: reportTablePath });
  console.log('Saved Laporan Final table screenshot to:', reportTablePath);

  await browser.close();
}

main().catch(console.error);

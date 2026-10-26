import { chromium } from 'playwright';
import path from 'node:path';

const artifactDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';
const targetJobId = 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  
  await context.addInitScript((jobId) => {
    localStorage.setItem('qc_maestro_active_job_id', jobId);
  }, targetJobId);

  const page = await context.newPage();
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check login
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // Go to Media view
  const evidenceNav = page.locator('button.nav-item:has-text("Media"), button.nav-item:has-text("Evidence"), button.nav-item:has-text("Bukti")').first();
  if (await evidenceNav.isVisible()) {
    await evidenceNav.click();
    await page.waitForTimeout(1500);
  }

  // Filter to Teknisi
  const searchInput = page.locator('input[placeholder*="Cari checkpoint" i]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('Teknisi');
    await page.waitForTimeout(1000);
  }

  // Click on the photo item "Dashboard Staff Teknisi (Ahmad Rian - STF001)"
  const photoCard = page.locator('button.qc-playlist-item:has-text("Dashboard Staff Teknisi")').first();
  if (await photoCard.isVisible()) {
    console.log('Clicking Dashboard Staff Teknisi photo card...');
    await photoCard.click();
    await page.waitForTimeout(1500);
  }

  // Capture the photo active in viewer
  await page.screenshot({ path: path.join(artifactDir, 'fixed_media_viewer_teknisi_photo_active.png'), fullPage: false });
  console.log('  ✓ Saved fixed_media_viewer_teknisi_photo_active.png');

  // Now also capture the Execution Runs table in Final Report!
  // In user Image 1, it's the "Laporan Final" or "Final Report" tab!
  const reportNav = page.locator('button.nav-item:has-text("Laporan Final"), button.nav-item:has-text("Final Report"), button.nav-item:has-text("Report")').first();
  if (await reportNav.isVisible()) {
    console.log('Navigating to Laporan Final...');
    await reportNav.click();
    await page.waitForTimeout(1500);

    // Scroll to the Execution Runs table
    const tableEl = page.locator('.fr-compact-table').first();
    if (await tableEl.isVisible()) {
      await tableEl.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(artifactDir, 'fixed_final_report_execution_table.png'), fullPage: false });
      console.log('  ✓ Saved fixed_final_report_execution_table.png');
    }
  }

  await browser.close();
}

main().catch(console.error);

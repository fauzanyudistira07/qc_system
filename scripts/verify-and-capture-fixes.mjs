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
  
  // Set localStorage before loading
  await context.addInitScript((jobId) => {
    localStorage.setItem('qc_maestro_active_job_id', jobId);
    localStorage.setItem('qc_maestro_current_view', 'runs');
  }, targetJobId);

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

  // Ensure target job is selected
  await page.evaluate((jobId) => {
    localStorage.setItem('qc_maestro_active_job_id', jobId);
  }, targetJobId);

  // Click on "Execution Runs" / "runs" nav item
  console.log('Navigating to Runs view...');
  const runsNav = page.locator('button.nav-item:has-text("Execution Runs"), button.nav-item:has-text("Runs")').first();
  if (await runsNav.isVisible()) {
    await runsNav.click();
    await page.waitForTimeout(1500);
  }

  // Check if we are on report or runs view
  // Let's take a screenshot of the Runs view
  await page.screenshot({ path: path.join(artifactDir, 'fixed_execution_runs_table.png'), fullPage: false });
  console.log('  ✓ Saved fixed_execution_runs_table.png');

  // Now click on "Media & Bukti Visual" or "evidence" nav item
  console.log('Navigating to Media & Bukti Visual view...');
  const evidenceNav = page.locator('button.nav-item:has-text("Media"), button.nav-item:has-text("Evidence"), button.nav-item:has-text("Bukti")').first();
  if (await evidenceNav.isVisible()) {
    await evidenceNav.click();
    await page.waitForTimeout(2000);
  }

  // Take screenshot of Media Viewer
  await page.screenshot({ path: path.join(artifactDir, 'fixed_media_viewer_overview.png'), fullPage: false });
  console.log('  ✓ Saved fixed_media_viewer_overview.png');

  // Search or click Staff Teknisi in media list
  console.log('Filtering to Staff Teknisi...');
  const searchInput = page.locator('input[placeholder*="Cari checkpoint" i]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('Teknisi');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'fixed_media_viewer_teknisi.png'), fullPage: false });
    console.log('  ✓ Saved fixed_media_viewer_teknisi.png');
  }

  // Clear search and click "Video" filter button in Media Viewer
  if (await searchInput.isVisible()) {
    await searchInput.fill('');
    await page.waitForTimeout(500);
  }

  const videoFilterBtn = page.locator('button:has-text("Video"), button:has-text("Rekaman")').first();
  if (await videoFilterBtn.isVisible()) {
    await videoFilterBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'fixed_media_viewer_videos.png'), fullPage: false });
    console.log('  ✓ Saved fixed_media_viewer_videos.png');
  }

  await browser.close();
  console.log('Done verifying and capturing fixes.');
}

main().catch(console.error);

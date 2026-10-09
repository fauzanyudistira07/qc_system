const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\aa0db4b0-8490-49e5-a699-04fc6490b8b4';
const TARGET_JOB_ID = '5182a08d-fb3d-42b1-93b6-89c357399370';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:4180 ...');
  await page.goto('http://127.0.0.1:4180', { waitUntil: 'networkidle' });

  // Handle Login if present
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  if (await emailInput.count() > 0 && await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').fill('admin12345');
    await page.locator('button[type="submit"], .btn-primary').first().click();
    await page.waitForTimeout(1500);
  }

  // Set active job directly or click project switcher
  await page.evaluate((jobId) => {
    localStorage.setItem('qc_maestro_active_job_id', jobId);
  }, TARGET_JOB_ID);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // If chip or update room item exists, click it if needed
  const chipBtn = page.locator('.btn-update-room-chip').first();
  if (await chipBtn.count() > 0 && await chipBtn.isVisible()) {
    console.log('Clicking update room chip...');
    await chipBtn.click();
    await page.waitForTimeout(1000);
  }

  // Ensure Overview tab is active
  const overviewNav = page.locator('.nav-item').filter({ hasText: 'Overview' }).first();
  if (await overviewNav.count() > 0) {
    await overviewNav.click();
    await page.waitForTimeout(1000);
  }

  console.log('Taking full page screenshot...');
  const fullScreenshotPath = path.join(ARTIFACT_DIR, 'before_after_overview_full.png');
  await page.screenshot({ path: fullScreenshotPath, fullPage: false });
  console.log('Full screenshot saved to:', fullScreenshotPath);

  // Take element screenshot if banner exists
  const banner = page.locator('.incremental-room-telemetry-banner').first();
  if (await banner.count() > 0 && await banner.isVisible()) {
    const bannerPath = path.join(ARTIFACT_DIR, 'before_after_banner.png');
    await banner.screenshot({ path: bannerPath });
    console.log('Banner screenshot saved to:', bannerPath);
  } else {
    console.log('Banner not visible yet, current URL:', page.url());
  }

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

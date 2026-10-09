const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\aa0db4b0-8490-49e5-a699-04fc6490b8b4';
const TARGET_JOB_ID = '5182a08d-fb3d-42b1-93b6-89c357399370';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
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

  // Set active job directly
  await page.evaluate((jobId) => {
    localStorage.setItem('qc_maestro_active_job_id', jobId);
  }, TARGET_JOB_ID);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Take screenshot of the sidebar state
  console.log('Taking screenshot of sidebar with clean trigger...');
  const sidebarPath = path.join(ARTIFACT_DIR, 'sidebar_clean_trigger.png');
  const sidebarEl = page.locator('.sidebar-accordion-project').first();
  if (await sidebarEl.count() > 0) {
    await sidebarEl.screenshot({ path: sidebarPath });
    console.log('Saved sidebar trigger screenshot to:', sidebarPath);
  }

  // Click the trigger to open the Center-Screen Modal
  console.log('Clicking sidebar trigger to open center modal...');
  const triggerBtn = page.locator('.sidebar-project-trigger-card').first();
  await triggerBtn.click();
  await page.waitForTimeout(600);

  // Take screenshot of the center-screen modal
  console.log('Taking screenshot of center modal...');
  const modalPath = path.join(ARTIFACT_DIR, 'project_picker_center_modal.png');
  await page.screenshot({ path: modalPath, fullPage: false });
  console.log('Saved full modal screenshot to:', modalPath);

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});

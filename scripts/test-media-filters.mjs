import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180 ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // Click "Media" in sidebar
  console.log('Clicking Media in sidebar...');
  const mediaNav = page.locator('.nav-menu button:has-text("Media")').first();
  await mediaNav.click();
  await page.waitForTimeout(2000);

  // 1. Capture Jamaahku Media with 00 - 17
  const jamaahkuScreenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_media_jamaahku_filters.png';
  await page.screenshot({ path: jamaahkuScreenshot });
  console.log('Saved Jamaahku Media screenshot:', jamaahkuScreenshot);

  // Switch to Taskia Digital
  console.log('Switching to Taskia Digital...');
  const switchBtn = page.locator('button:has-text("Ganti"), .project-switcher-trigger').first();
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await page.waitForTimeout(500);
    const taskiaOption = page.locator('text=Taskia Digital').first();
    if (await taskiaOption.isVisible()) {
      await taskiaOption.click();
      await page.waitForTimeout(1500);
    }
  }

  // Click "Media" tab again if not already there
  const mediaNavTaskia = page.locator('.nav-menu button:has-text("Media")').first();
  if (await mediaNavTaskia.isVisible()) {
    await mediaNavTaskia.click();
    await page.waitForTimeout(2000);
  }

  // 2. Capture Taskia Media with Step 1 - Step 8
  const taskiaScreenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_media_taskia_filters.png';
  await page.screenshot({ path: taskiaScreenshot });
  console.log('Saved Taskia Media screenshot:', taskiaScreenshot);

  // Click 2. Login & Masuk Dashboard filter chip
  const flowChip = page.locator('.qc-step-chip:has-text("2. Login")').first();
  if (await flowChip.isVisible()) {
    console.log('Clicking 2. Login flow chip...');
    await flowChip.click();
    await page.waitForTimeout(800);
    const flowScreenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_media_taskia_flow2.png';
    await page.screenshot({ path: flowScreenshot });
    console.log('Saved Flow 2 filtered screenshot:', flowScreenshot);
  }

  await browser.close();
  console.log('All done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

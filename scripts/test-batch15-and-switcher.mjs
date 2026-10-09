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

  // 1. Click Media
  console.log('Clicking Media...');
  const mediaNav = page.locator('.nav-menu button:has-text("Media")').first();
  await mediaNav.click();
  await page.waitForTimeout(1500);

  const mediaP1Screenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_media_batch15_page1.png';
  await page.screenshot({ path: mediaP1Screenshot });
  console.log('Saved Media Page 1 screenshot:', mediaP1Screenshot);

  // Click Next 15
  const nextBtn = page.locator('.qc-pagination-toolbar button:has-text("Next 15")').first();
  if (await nextBtn.isVisible()) {
    console.log('Clicking Next 15...');
    await nextBtn.click();
    await page.waitForTimeout(800);
    const mediaP2Screenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_media_batch15_page2.png';
    await page.screenshot({ path: mediaP2Screenshot });
    console.log('Saved Media Page 2 screenshot:', mediaP2Screenshot);
  }

  // 2. Open Project Switcher to see the runs progress sub-menu
  console.log('Opening Project Switcher...');
  const switchBtn = page.locator('.project-switcher-sidebar-card, button:has-text("Ganti")').first();
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await page.waitForTimeout(1000);
    const switcherScreenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_project_switcher_progress_submenu.png';
    await page.screenshot({ path: switcherScreenshot });
    console.log('Saved Project Switcher sub-menu screenshot:', switcherScreenshot);

    // Expand Taskia Digital progress runs as well
    const taskiaProgressBtn = page.locator('div:has-text("Taskia Digital") button:has-text("Progress")').first();
    if (await taskiaProgressBtn.isVisible()) {
      console.log('Expanding Taskia Digital progress runs...');
      await taskiaProgressBtn.click();
      await page.waitForTimeout(800);
      const taskiaExpandedScreenshot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_taskia_expanded_runs.png';
      await page.screenshot({ path: taskiaExpandedScreenshot });
      console.log('Saved Taskia expanded runs screenshot:', taskiaExpandedScreenshot);
    }
  }

  await browser.close();
  console.log('All tests completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

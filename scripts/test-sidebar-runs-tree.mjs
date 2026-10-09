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

  // 1. Capture sidebar with Jamaahku active
  const sidebarJamaahkuShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_tree_jamaahku.png';
  await page.screenshot({ path: sidebarJamaahkuShot });
  console.log('Saved Jamaahku sidebar screenshot:', sidebarJamaahkuShot);

  // 2. Switch project via tab pill to Taskia
  console.log('Switching to Taskia Digital...');
  const taskiaPill = page.locator('.project-tab-pill:has-text("Taskia")').first();
  if (await taskiaPill.isVisible()) {
    await taskiaPill.click();
    await page.waitForTimeout(1500);

    const sidebarTaskiaShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_tree_taskia.png';
    await page.screenshot({ path: sidebarTaskiaShot });
    console.log('Saved Taskia sidebar screenshot:', sidebarTaskiaShot);

    // 3. Click one of the past failed/interrupted runs (e.g. Pengecekan #4)
    console.log('Clicking Pengecekan #4 in sidebar tree...');
    const runNode4 = page.locator('.sidebar-run-node:has-text("Pengecekan #4")').first();
    if (await runNode4.isVisible()) {
      await runNode4.click();
      await page.waitForTimeout(1000);

      const run4SelectedShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_tree_run4_selected.png';
      await page.screenshot({ path: run4SelectedShot });
      console.log('Saved Run #4 selected screenshot:', run4SelectedShot);
    }
  }

  await browser.close();
  console.log('All tests completed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

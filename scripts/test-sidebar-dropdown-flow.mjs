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

  // 1. Capture state awal sidebar sebelum trigger di-klik
  const beforeClickShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_state_closed.png';
  await page.screenshot({ path: beforeClickShot });
  console.log('Saved closed state screenshot:', beforeClickShot);

  // 2. Klik trigger CURRENT PROJECT di sidebar -> muncul daftar projek
  console.log('Clicking sidebar project trigger card...');
  const triggerCard = page.locator('.sidebar-project-trigger-card').first();
  await triggerCard.click();
  await page.waitForTimeout(800);

  const projectListShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_projects_opened.png';
  await page.screenshot({ path: projectListShot });
  console.log('Saved projects opened screenshot:', projectListShot);

  // 3. Klik projek Taskia Digital di daftar -> muncul dropdown progress run-nya
  console.log('Clicking Taskia Digital project item to open dropdown...');
  const taskiaItem = page.locator('.sidebar-project-item-header:has-text("Taskia Digital")').first();
  if (await taskiaItem.isVisible()) {
    await taskiaItem.click();
    await page.waitForTimeout(800);

    const taskiaRunsShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_taskia_runs_dropdown.png';
    await page.screenshot({ path: taskiaRunsShot });
    console.log('Saved Taskia runs dropdown screenshot:', taskiaRunsShot);

    // 4. Klik Pengecekan #4
    console.log('Clicking Pengecekan #4...');
    const run4Entry = page.locator('.sidebar-run-entry:has-text("Pengecekan #4")').first();
    if (await run4Entry.isVisible()) {
      await run4Entry.click();
      await page.waitForTimeout(1000);

      const run4SelectedShot = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_sidebar_run4_selected.png';
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

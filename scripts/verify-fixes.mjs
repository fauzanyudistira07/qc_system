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
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // 1. Capture Sidebar Dropdown with project runs open
  const projectTrigger = page.locator('.sidebar-project-trigger-card').first();
  if (await projectTrigger.isVisible()) {
    await projectTrigger.click();
    await page.waitForTimeout(600);
    // Expand the first project if not already open
    const firstProjectHeader = page.locator('.sidebar-project-item-header').first();
    if (await firstProjectHeader.isVisible()) {
      await firstProjectHeader.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/fix_sidebar_dropdown.png' });
    console.log('Saved fix_sidebar_dropdown.png');
    // Close dropdown
    await projectTrigger.click();
    await page.waitForTimeout(400);
  }

  // 2. Capture New QC Run Wizard with APK & Backend sections
  const newRunBtn = page.locator('button:has-text("New QC Run")').first();
  if (await newRunBtn.isVisible()) {
    await newRunBtn.click();
    await page.waitForTimeout(1200);
    // Make sure Mobile is selected to view APK card
    const mobileChoice = page.locator('.choice-card:has-text("Mobile App")').first();
    if (await mobileChoice.isVisible()) {
      await mobileChoice.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/fix_new_run_wizard.png' });
    console.log('Saved fix_new_run_wizard.png');
  }

  // 3. Capture Final Report Page
  const reportNav = page.locator('.nav-item:has-text("Laporan Final")').first();
  if (await reportNav.isVisible()) {
    await reportNav.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/fix_final_report.png' });
    console.log('Saved fix_final_report.png');
  }

  // 4. Test explicit light mode to verify topbar and sidebar NEVER turn white
  await page.evaluate(() => {
    localStorage.setItem('qc_theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/fix_light_mode_retained_brown.png' });
  console.log('Saved fix_light_mode_retained_brown.png');

  await browser.close();
  console.log('Verification capture complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

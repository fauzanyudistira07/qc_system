const { chromium } = require('playwright');
const path = require('path');

const artifactDir = 'C:/Users/admin/.gemini/antigravity-ide/brain/e8c8db71-f67c-4cde-9a76-cc4923a277df';

(async () => {
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();

    console.log('Logging in as User...');
    await page.goto('http://127.0.0.1:4180/login');
    await page.fill('#email', 'user@qcmaestro.local');
    await page.fill('#password', 'user12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/projects');

    console.log('Opening /new Step 0...');
    await page.goto('http://127.0.0.1:4180/new');
    await page.waitForTimeout(400);

    // Capture Step 0
    await page.screenshot({ path: path.join(artifactDir, 'spa_wizard_step0_target.png'), fullPage: true });
    console.log('CAPTURED_STEP0');

    // Click Folder Lokal in Step 0
    await page.click('#btnModeLocal');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(artifactDir, 'spa_wizard_step0_local_folder.png'), fullPage: true });
    console.log('CAPTURED_STEP0_LOCAL_FOLDER');

    // Click GitHub in Step 0
    await page.click('#btnModeGithub');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(artifactDir, 'spa_wizard_step0_github.png'), fullPage: true });
    console.log('CAPTURED_STEP0_GITHUB');

    // Go to Step 1 (Akun & Data Uji)
    console.log('Navigating to Step 1...');
    await page.click('#stepTab1');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'spa_wizard_step1_accounts.png'), fullPage: true });
    console.log('CAPTURED_STEP1');

    // Go to Step 2 (Review & Jalankan)
    console.log('Navigating to Step 2...');
    await page.click('#stepTab2');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'spa_wizard_step2_review.png'), fullPage: true });
    console.log('CAPTURED_STEP2');

    // Submit form on Step 2 to verify flow into Live Monitor
    console.log('Submitting form...');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/monitor**');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'spa_wizard_submitted_monitor.png'), fullPage: true });
    console.log('CAPTURED_SUBMITTED_MONITOR');

    await browser.close();
  } catch (err) {
    console.error('Error during SPA wizard capture:', err);
    process.exit(1);
  }
})();

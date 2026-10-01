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

    console.log('Navigating to /new...');
    await page.goto('http://127.0.0.1:4180/new');
    await page.waitForTimeout(400);

    // Default screenshot (Folder / Install Lokal)
    await page.screenshot({ path: path.join(artifactDir, 'new_test_local_folder.png'), fullPage: true });
    console.log('CAPTURED_LOCAL_FOLDER');

    // Click GitHub option
    await page.click('#optGithub');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(artifactDir, 'new_test_github_option.png'), fullPage: true });
    console.log('CAPTURED_GITHUB_OPTION');

    await browser.close();
  } catch (err) {
    console.error('Error during new options screenshot:', err);
    process.exit(1);
  }
})();

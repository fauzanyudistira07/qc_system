const { chromium } = require('playwright');
const path = require('path');

const artifactDir = 'C:/Users/admin/.gemini/antigravity-ide/brain/e8c8db71-f67c-4cde-9a76-cc4923a277df';

(async () => {
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();

    console.log('Logging in as Admin...');
    await page.goto('http://127.0.0.1:4180/login');
    await page.fill('#email', 'admin@qcmaestro.local');
    await page.fill('#password', 'admin12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    await page.waitForTimeout(500);

    console.log('Capturing Admin Dashboard...');
    await page.screenshot({ path: path.join(artifactDir, 'admin_dashboard_restored.png'), fullPage: true });

    console.log('Capturing Admin Projects...');
    await page.goto('http://127.0.0.1:4180/admin/projects');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'admin_projects_restored.png'), fullPage: true });

    console.log('Capturing Admin Flows...');
    await page.goto('http://127.0.0.1:4180/admin/flows');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'admin_flows_restored.png'), fullPage: true });

    console.log('Capturing Admin Runs...');
    await page.goto('http://127.0.0.1:4180/admin/runs');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'admin_runs_restored.png'), fullPage: true });

    console.log('Capturing Admin Reports...');
    await page.goto('http://127.0.0.1:4180/admin/reports');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'admin_reports_restored.png'), fullPage: true });

    console.log('ALL_ADMIN_SCREENSHOTS_CAPTURED');
    await browser.close();
  } catch (err) {
    console.error('Error during admin screenshots:', err);
    process.exit(1);
  }
})();

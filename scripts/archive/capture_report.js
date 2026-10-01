const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  
  await page.goto('http://127.0.0.1:4180/login');
  await page.fill('input[name="email"]', 'admin@qcmaestro.local');
  await page.fill('input[name="password"]', 'admin12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  
  await page.goto('http://127.0.0.1:4180/reports?id=jamaahku');
  await page.waitForTimeout(1500);
  
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/e8c8db71-f67c-4cde-9a76-cc4923a277df/full_report_updated.png', fullPage: true });
  console.log('Report screenshot saved successfully!');
  
  await browser.close();
})();

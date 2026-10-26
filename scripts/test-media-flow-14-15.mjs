import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:4180/');
  await page.evaluate(() => {
    localStorage.setItem('qc_admin_token', 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM');
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });

  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click Media tab in sidebar
  console.log('Clicking Media tab in sidebar...');
  await page.click('button:has-text("Media"), nav a:has-text("Media"), [data-view="media"]');
  await page.waitForTimeout(2000);

  // Find the flow select dropdown
  const dropdown = await page.waitForSelector('.qc-group-dropdown, select', { timeout: 8000 });
  if (dropdown) {
    const options = await page.$$eval('.qc-group-dropdown option, select option', opts => opts.map(o => ({ value: o.value, text: o.textContent.trim() })));
    console.log(`Dropdown options found (${options.length}):`);
    for (const opt of options) {
      console.log(`  - [${opt.value}] ${opt.text}`);
    }

    // Select Flow 14
    const opt14 = options.find(o => o.text.includes('14.') || o.text.includes('Manager'));
    if (opt14) {
      console.log(`\nSelecting Flow 14: "${opt14.text}"...`);
      await page.selectOption('.qc-group-dropdown, select', opt14.value);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.resolve('.qc-artifacts', 'ui_media_flow_14_manager.png'), fullPage: false });
      console.log('Saved Flow 14 media screenshot!');
    }

    // Select Flow 15
    const opt15 = options.find(o => o.text.includes('15.') || o.text.includes('Teknisi'));
    if (opt15) {
      console.log(`\nSelecting Flow 15: "${opt15.text}"...`);
      await page.selectOption('.qc-group-dropdown, select', opt15.value);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.resolve('.qc-artifacts', 'ui_media_flow_15_teknisi.png'), fullPage: false });
      console.log('Saved Flow 15 media screenshot!');
    }
  }

  await browser.close();
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

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

  // Click Media tab
  await page.click('button:has-text("Media"), nav a:has-text("Media"), [data-view="media"]');
  await page.waitForTimeout(2000);

  // Click Export ke Nextcloud button
  console.log('Clicking "Export ke Nextcloud"...');
  await page.click('button:has-text("Export ke Nextcloud"), button:has-text("Nextcloud")');
  await page.waitForTimeout(2500);

  // Take screenshot of the modal
  await page.screenshot({ path: path.resolve('.qc-artifacts', 'ui_nextcloud_modal_smart.png'), fullPage: false });
  console.log('Saved modal screenshot to .qc-artifacts/ui_nextcloud_modal_smart.png');

  // Check modal text
  const modalText = await page.innerText('.qc-nc-modal, .modal-content, [role="dialog"], body');
  console.log('Modal contains "Letakkan di Folder yang Sama":', modalText.includes('Letakkan di Folder yang Sama'));
  console.log('Modal contains "AL- Hikmah Digital (2026-10-18 15-56)":', modalText.includes('AL- Hikmah Digital (2026-10-18 15-56)'));

  await browser.close();
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

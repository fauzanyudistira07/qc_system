import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await context.addInitScript(() => {
    localStorage.setItem('qc_admin_token', 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM');
    localStorage.setItem('qc_admin_user', JSON.stringify({ email: 'admin@qcmaestro.com', name: 'QC Master Admin', role: 'admin' }));
    localStorage.setItem('qc_maestro_active_job_id', '8b86c0e9-2648-4e74-81dd-5a10b461a8bb');
  });

  // 1. Home Dashboard
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/fauzan/.gemini/antigravity-ide/brain/fca0729c-ac37-4f94-825e-500b70e99540/qc_dashboard_verified_all.png' });

  // 2. School Web Room
  await page.goto('http://localhost:4180/rooms/8b86c0e9-2648-4e74-81dd-5a10b461a8bb', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/fauzan/.gemini/antigravity-ide/brain/fca0729c-ac37-4f94-825e-500b70e99540/qc_school_web_room_verified.png' });

  // 3. Media Tab of School Web Room
  const mediaTab = page.locator('button:has-text("Media"), a:has-text("Media"), button:has-text("Gallery")').first();
  if (await mediaTab.count() > 0) {
    await mediaTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: '/home/fauzan/.gemini/antigravity-ide/brain/fca0729c-ac37-4f94-825e-500b70e99540/qc_school_web_media_verified.png' });
  }

  await browser.close();
  console.log('Verification screenshots captured!');
}

main().catch(console.error);

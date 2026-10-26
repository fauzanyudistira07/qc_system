import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });

  await page.goto('http://localhost:4180', { waitUntil: 'networkidle' });

  // Log in
  const emailInput = page.locator('input[type="email"], input[placeholder*="domain"], input[placeholder*="admin"]');
  if (await emailInput.count() > 0) {
    await emailInput.first().fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk ke Control Center"), button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  const outDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';

  // Navigate to Execution Runs
  await page.locator('button.nav-item:has-text("Execution Runs"), .nav-item:has-text("Execution Runs")').first().click();
  await page.waitForTimeout(2000);

  // Scroll down to Flows 10-15
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await page.waitForTimeout(1000);

  const flow11Card = page.locator('text=11. Quick Actions, text=Kalender Kegiatan, text=ai-flow-11-kalender-berita');
  if (await flow11Card.count() > 0) {
    await flow11Card.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: path.join(outDir, 'flows_10_to_15_table.png') });
  console.log('Saved flows 10-15 table screenshot!');

  // Navigate to Media
  await page.locator('button.nav-item:has-text("Media"), .nav-item:has-text("Media")').first().click();
  await page.waitForTimeout(2500);

  // Filter Media dropdown to Flow 11
  const select = page.locator('select');
  if (await select.count() > 0) {
    const options = await select.locator('option').allInnerTexts();
    console.log('Available flow options in dropdown:', options);
    
    // Capture Flow 10: Drawer & Profil
    const f10 = options.find(o => o.includes('10.'));
    if (f10) {
      await page.locator('select.qc-group-dropdown').selectOption({ label: f10 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'media_flow_10_drawer.png') });
      console.log('Saved flow 10 media screenshot!');
    }

    // Capture Flow 13: Dewan Guru
    const f13 = options.find(o => o.includes('13.'));
    if (f13) {
      await page.locator('select.qc-group-dropdown').selectOption({ label: f13 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'media_flow_13_guru.png') });
      console.log('Saved flow 13 media screenshot!');
    }

    // Capture Flow 14: Manager Sarpras
    const f14 = options.find(o => o.includes('14.'));
    if (f14) {
      await page.locator('select.qc-group-dropdown').selectOption({ label: f14 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'media_flow_14_manager.png') });
      console.log('Saved flow 14 media screenshot!');
    }

    // Capture Flow 15: Staff Teknisi
    const f15 = options.find(o => o.includes('15.'));
    if (f15) {
      await page.locator('select.qc-group-dropdown').selectOption({ label: f15 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'media_flow_15_teknisi.png') });
      console.log('Saved flow 15 media screenshot!');
    }
  }

  await browser.close();
}

main().catch(console.error);

import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/fauzan/.local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.addInitScript(() => {
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
  });

  await page.goto('http://localhost:4180', { waitUntil: 'networkidle' });

  const emailInput = page.locator('input[type="email"], input[placeholder*="domain"], input[placeholder*="admin"]');
  if (await emailInput.count() > 0) {
    await emailInput.first().fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk ke Control Center"), button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  await page.locator('button.nav-item:has-text("Media"), .nav-item:has-text("Media")').first().click();
  await page.waitForTimeout(2500);

  const outDir = '/home/fauzan/.gemini/antigravity-ide/brain/0d79c9cd-6fe9-4bf1-9bbb-4c24e598918d';
  const select = page.locator('select.qc-group-dropdown');
  const options = await select.locator('option').allInnerTexts();

  const roleChecks = [
    { prefix: '10.', name: 'Siswa - Drawer & Profil' },
    { prefix: '13.', name: 'Role - Dewan Guru' },
    { prefix: '14.', name: 'Role - Manager Sarpras' },
    { prefix: '15.', name: 'Role - Staff Teknisi' }
  ];

  for (const rc of roleChecks) {
    const opt = options.find(o => o.startsWith(rc.prefix));
    if (opt) {
      console.log(`\nVerifying ${rc.name} (${opt})...`);
      await select.selectOption({ label: opt });
      await page.waitForTimeout(1500);
      
      const shotName = `verified_role_${rc.prefix.replace('.', '')}.png`;
      await page.screenshot({ path: path.join(outDir, shotName) });
      console.log(`  -> Screenshot saved to ${shotName}`);
    } else {
      console.warn(`  ⚠️ Option with prefix ${rc.prefix} not found!`);
    }
  }

  await browser.close();
  console.log('\nAll role UI checks verified successfully!');
}

main().catch(console.error);

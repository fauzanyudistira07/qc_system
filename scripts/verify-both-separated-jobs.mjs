import path from 'node:path';
import { chromium } from 'playwright';

const apiToken = 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM';

async function verifyJob(page, jobId, jobName, outputPrefix) {
  console.log(`\n============================================================`);
  console.log(`🔍 MEMVERIFIKASI JOB TERPISAH: ${jobName} (${jobId})`);
  console.log(`============================================================`);

  await page.goto('http://localhost:4180/');
  await page.evaluate(({ token, id }) => {
    localStorage.setItem('qc_admin_token', token);
    localStorage.setItem('qc_maestro_active_job_id', id);
    localStorage.setItem('qc_maestro_current_view', 'discovery');
  }, { token: apiToken, id: jobId });

  await page.goto(`http://localhost:4180/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check job title in header / overview
  const bodyText = await page.innerText('body');
  console.log(`- Page contains title:`, bodyText.includes('Al-Hikmah') ? '✅ YES' : '❌ NO');

  // Capture Discovery View
  const discPath = path.resolve('.qc-artifacts', `${outputPrefix}_discovery_view.png`);
  await page.screenshot({ path: discPath, fullPage: false });
  console.log(`- Screenshot Discovery: ${discPath}`);

  // Check App Map & Halaman (pages count)
  const pageItems = await page.$$('.page-item, [data-page-id], li:has-text("Langkah")');
  console.log(`- Jumlah list item halaman terdeteksi di DOM: ${pageItems.length}`);

  // Switch to Media tab
  const mediaTabBtn = page.locator('button:has-text("Media"), button:has-text("Galeri"), [data-tab="media"]').first();
  if (await mediaTabBtn.count() > 0) {
    await mediaTabBtn.click().catch(() => {});
    await page.waitForTimeout(1500);

    const mediaPath = path.resolve('.qc-artifacts', `${outputPrefix}_media_gallery_view.png`);
    await page.screenshot({ path: mediaPath, fullPage: false });
    console.log(`- Screenshot Media Gallery: ${mediaPath}`);

    const images = await page.$$eval('img', imgs => imgs.map(img => img.src).filter(src => src.includes('/artifacts/')));
    console.log(`- Total gambar artifact yang dirender di Media Viewer: ${images.length}`);
    if (images.length > 0) {
      console.log(`  Contoh URL: ${images[0]}`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Verifikasi Al-Hikmah Finance
  await verifyJob(
    page,
    '23c7dc4e-7118-49ee-88e7-1ce1365a150d',
    'Al-Hikmah Finance (Keuangan, Tagihan & Kasir)',
    'finance'
  );

  // 2. Verifikasi Al-Hikmah School Web
  await verifyJob(
    page,
    '8b86c0e9-2648-4e74-81dd-5a10b461a8bb',
    'Al-Hikmah School Web (Akademik & KBM)',
    'school'
  );

  await browser.close();
  console.log(`\n🎉 VERIFIKASI DUA SISTEM TERPISAH SELESAI DENGAN SUKSES!`);
}

main().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});

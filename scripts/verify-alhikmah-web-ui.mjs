import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Pre-seed localStorage auth token and active job ID
  await page.goto('http://localhost:4180/');
  await page.evaluate(() => {
    localStorage.setItem('qc_admin_token', 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM');
    localStorage.setItem('qc_maestro_active_job_id', 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d');
    localStorage.setItem('qc_maestro_current_view', 'discovery');
  });

  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const bodyText = await page.innerText('body');
  console.log('--- Checking Flow Names in UI ---');
  const checks = [
    'Amal Siswa Harian',
    'Pengajuan Izin',
    'Keuangan',
    'Informasi Sekolah',
    'Tahfidz',
    'Kalender Kegiatan',
    'Pusat Notifikasi',
    'Manager Sarpras',
    'Staff Teknisi'
  ];

  for (const c of checks) {
    const found = bodyText.includes(c);
    console.log(`- Contains "${c}":`, found ? '✅ YES' : '❌ NO');
  }

  // Take screenshot of discovery view
  await page.screenshot({ path: path.resolve('.qc-artifacts', 'ui_alhikmah_discovery.png'), fullPage: false });
  console.log('Saved discovery screenshot to .qc-artifacts/ui_alhikmah_discovery.png');

  // Switch to Media tab if available
  const mediaTabBtn = await page.$('button:has-text("Media"), button:has-text("Galeri"), [data-tab="media"]');
  if (mediaTabBtn) {
    await mediaTabBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.resolve('.qc-artifacts', 'ui_alhikmah_media_tab.png'), fullPage: false });
    console.log('Saved media tab screenshot to .qc-artifacts/ui_alhikmah_media_tab.png');
  }

  // Check how many images are loaded in live-viewport / gallery
  const images = await page.$$eval('img', imgs => imgs.map(img => img.src).filter(src => src.includes('/artifacts/')));
  console.log(`Loaded artifact images count in DOM: ${images.length}`);
  const uniqueImages = new Set(images.map(s => s.split('/').pop()));
  console.log(`Unique artifact image filenames: ${uniqueImages.size}`);
  for (const name of Array.from(uniqueImages).slice(0, 15)) {
    console.log(`  📸 ${name}`);
  }

  // Check video elements
  const videos = await page.$$eval('video source, video', vids => vids.map(v => v.src || v.currentSrc).filter(Boolean));
  console.log(`Video elements found in DOM: ${videos.length}`);
  for (const v of videos) {
    console.log(`  🎬 ${v}`);
  }

  await browser.close();
  console.log('✅ UI Verification completed successfully!');
}

main().catch(err => {
  console.error('UI Verification error:', err);
  process.exit(1);
});

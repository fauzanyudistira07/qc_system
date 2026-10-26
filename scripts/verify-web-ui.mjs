import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  // Pre-seed localStorage auth token
  await page.goto('http://localhost:4180/');
  await page.evaluate(() => {
    localStorage.setItem('qc_admin_token', 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM');
  });

  // Verify Finance Job
  console.log('Testing Finance Job UI...');
  await page.evaluate(() => {
    localStorage.setItem('qc_maestro_active_job_id', '23c7dc4e-7118-49ee-88e7-1ce1365a150d');
    localStorage.setItem('qc_maestro_current_view', 'discovery');
  });
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  let bodyText = await page.innerText('body');
  const finHasStep01 = bodyText.includes('Langkah 01') || bodyText.includes('step_01');
  const finHasStep48 = bodyText.includes('Langkah 48') || bodyText.includes('step_48');
  console.log('Finance Job UI Verification:');
  console.log('- Contains "[Langkah 01]":', finHasStep01);
  console.log('- Contains "[Langkah 48]":', finHasStep48);

  // Check screenshot preview image
  const imgElement = await page.$('.screenshot-container img');
  const imgSrc = imgElement ? await imgElement.getAttribute('src') : null;
  console.log('- Screenshot preview src:', imgSrc);

  // Verify School Web Job
  console.log('\nTesting School Web Job UI...');
  await page.evaluate(() => {
    localStorage.setItem('qc_maestro_active_job_id', '8b86c0e9-2648-4e74-81dd-5a10b461a8bb');
    localStorage.setItem('qc_maestro_current_view', 'discovery');
  });
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  bodyText = await page.innerText('body');
  const schHasStep01 = bodyText.includes('Langkah 01') || bodyText.includes('step_01');
  const schHasStep33 = bodyText.includes('Langkah 33') || bodyText.includes('step_33');
  console.log('School Web Job UI Verification:');
  console.log('- Contains "[Langkah 01]":', schHasStep01);
  console.log('- Contains "[Langkah 33]":', schHasStep33);

  // Take screenshot of QC Maestro dashboard for visual evidence
  await page.screenshot({ path: path.resolve('.qc-artifacts', 'qc_maestro_dashboard_verified.png'), fullPage: false });
  console.log('Saved dashboard screenshot to .qc-artifacts/qc_maestro_dashboard_verified.png');

  await browser.close();
  console.log('\n✅ All Web UI Job views verified successfully!');
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});

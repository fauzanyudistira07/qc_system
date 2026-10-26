import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  // Get fresh token
  const res = await fetch('http://localhost:4100/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@qcmaestro.com', password: 'admin12345' }),
  });
  const data = await res.json();
  const token = data.token || data.data?.token;

  await page.goto('http://localhost:4180/');
  await page.evaluate((tok) => {
    localStorage.setItem('qc_admin_token', tok);
    localStorage.setItem('qc_maestro_active_job_id', '23c7dc4e-7118-49ee-88e7-1ce1365a150d');
    localStorage.setItem('qc_maestro_current_view', 'overview');
  }, token);

  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const outPath = '/home/fauzan/.gemini/antigravity-ide/brain/fca0729c-ac37-4f94-825e-500b70e99540/qc_summary_reverted.png';
  await page.screenshot({ path: outPath, fullPage: false });
  console.log('Saved screenshot to:', outPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

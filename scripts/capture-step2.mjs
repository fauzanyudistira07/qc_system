import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 993 } });
  await page.goto('http://localhost:4180/');
  await page.waitForTimeout(1000);
  
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1500);
  }

  // Click New QC Run in sidebar
  const newBtn = page.locator('.sidebar button:has-text("New QC Run")').first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(1000);
  }

  // Fill Step 0 with valid data to enable clicking Next
  const nameInput = page.locator('input[placeholder*="Tasdig"], input[placeholder*="Jamaahku"]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill('Jamaahku Travel Agent Web QC');
  }
  
  // Click Web platform
  const webChoice = page.locator('button:has-text("Web Application")').first();
  if (await webChoice.isVisible()) {
    await webChoice.click();
  }

  const urlInput = page.locator('input[type="url"]').first();
  if (await urlInput.isVisible()) {
    await urlInput.fill('http://localhost:5174');
  }

  await page.screenshot({ path: 'step1_view.png' });

  // Click Lanjutkan to go to Step 2
  const nextBtn = page.locator('button:has-text("Lanjutkan")').first();
  if (await nextBtn.isVisible()) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
  }

  // scroll to top of main content
  await page.evaluate(() => {
    const el = document.querySelector('.main-content');
    if (el) el.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'step2_top.png' });

  // scroll to middle of main content
  await page.evaluate(() => {
    const el = document.querySelector('.main-content');
    if (el) el.scrollTop = 550;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'step2_mid.png' });

  // scroll to bottom of main content
  await page.evaluate(() => {
    const el = document.querySelector('.main-content');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'step2_bottom.png' });
  console.log('Step 2 screenshots captured.');
  await browser.close();
}

main().catch(console.error);

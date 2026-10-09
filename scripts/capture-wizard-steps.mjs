import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180/ ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1800);
  }

  // Open New QC Run
  const newBtn = page.locator('.new-job-btn, button:has-text("Run Baru"), button:has-text("New QC Run")').first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(1000);
  }

  // Fill Project Name so validation passes
  const nameInput = page.locator('input[placeholder*="Contoh: Tasdig" i], input[placeholder*="Tasdig" i]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await nameInput.fill('Jamaahku Web Portal E2E');

  // Switch to Web Application
  const webChoice = page.locator('button:has-text("Web Application")').first();
  if (await webChoice.isVisible()) {
    await webChoice.click();
    await page.waitForTimeout(300);
  }

  // Fill Repo URLs and branches
  const feRepo = page.locator('input[placeholder*="frontend-app" i]').first();
  if (await feRepo.isVisible()) {
    await feRepo.fill('https://github.com/organization/jamaahku-frontend');
  }
  const beRepo = page.locator('input[placeholder*="backend-api" i]').first();
  if (await beRepo.isVisible()) {
    await beRepo.fill('https://github.com/organization/jamaahku-backend');
  }

  // Advance to Step 1 (Akun & Data Uji)
  const nextBtn = page.locator('.wizard-footer button.primary').first();
  await nextBtn.click();
  await page.waitForTimeout(1200);

  // Capture Step 1
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/wizard_step1_streamlined.png' });
  console.log('Step 1 screenshot saved to wizard_step1_streamlined.png');

  // Advance to Step 2 (Review & Jalankan)
  const nextBtn2 = page.locator('.wizard-footer button.primary').first();
  await nextBtn2.click();
  await page.waitForTimeout(800);

  // Capture Step 2
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/wizard_step2_modern_review.png' });
  console.log('Step 2 screenshot saved to wizard_step2_modern_review.png');

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180 ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(1500);
  }

  // Click "New QC Run" button
  const newBtn = page.locator('.new-job-btn, button:has-text("New QC Run")').first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(1000);

    // Capture Web Mode (default or selected)
    const webBtn = page.locator('.choice-card:has-text("Web Application")').first();
    if (await webBtn.isVisible()) {
      await webBtn.click();
      await page.waitForTimeout(500);
    }

    // Try testing probe on local
    const probeBtn = page.locator('button:has-text("Tes Konektivitas")').first();
    if (await probeBtn.isVisible()) {
      await probeBtn.click();
      await page.waitForTimeout(1000);
    }

    // Hover over "Tes API" button in Backend form to test tactile hover
    const beProbeBtn = page.locator('button:has-text("Tes API")').first();
    if (await beProbeBtn.isVisible()) {
      await beProbeBtn.hover();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/new_qc_web_mode.png', fullPage: true });
    console.log('Saved new_qc_web_mode.png');

    // Also take a screenshot focused on Backend Section
    const backendSection = page.locator('.backend-service-section').first();
    if (await backendSection.isVisible()) {
      await backendSection.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/new_qc_backend_2x2.png' });
      console.log('Saved new_qc_backend_2x2.png');
    }

    // Hover over footer button to test hover
    const nextBtn = page.locator('.wizard-footer button.primary').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.hover();
      await page.waitForTimeout(300);
      const footerSection = page.locator('.wizard-footer').first();
      if (await footerSection.isVisible()) {
        await footerSection.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/new_qc_button_hover.png' });
        console.log('Saved new_qc_button_hover.png');
      }
    }

    // Now switch to Android Mobile to verify Server Emulator zero-config card
    const androidBtn = page.locator('.choice-card:has-text("Mobile App")').first();
    if (await androidBtn.isVisible()) {
      await androidBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/new_qc_android_mode.png', fullPage: true });
      console.log('Saved new_qc_android_mode.png');
    }
  }

  await browser.close();
  console.log('Done capturing all requested states!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

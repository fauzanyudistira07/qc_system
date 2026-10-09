import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4180 ...');
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    console.log('Logging in as admin...');
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }

  // Open Project Switcher and select Taskia Digital
  console.log('Switching to Taskia Digital...');
  const switchBtn = page.locator('button:has-text("Ganti"), .project-switcher-trigger').first();
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await page.waitForTimeout(500);
    const taskiaOption = page.locator('text=Taskia Digital').first();
    if (await taskiaOption.isVisible()) {
      await taskiaOption.click();
      await page.waitForTimeout(1500);
    }
  }

  // Click Evidence & Media tab in sidebar
  console.log('Clicking Evidence & Media...');
  const evidenceNav = page.locator('button:has-text("Evidence & Media"), button:has-text("Evidence Center")').first();
  await evidenceNav.click();
  await page.waitForTimeout(2000);

  // 1. Capture default Gallery tab (LiveViewport)
  const galleryScreenshotPath = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_taskia_evidence_gallery.png';
  await page.screenshot({ path: galleryScreenshotPath });
  console.log('Saved Taskia gallery screenshot to:', galleryScreenshotPath);

  // 2. Click "Dokumen Audit & JSON" sub-tab
  const auditTab = page.locator('button:has-text("Dokumen Audit")').first();
  if (await auditTab.isVisible()) {
    console.log('Clicking Dokumen Audit & JSON tab...');
    await auditTab.click();
    await page.waitForTimeout(1000);
    const auditScreenshotPath = 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_taskia_evidence_audit.png';
    await page.screenshot({ path: auditScreenshotPath });
    console.log('Saved Taskia audit screenshot to:', auditScreenshotPath);
  }

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

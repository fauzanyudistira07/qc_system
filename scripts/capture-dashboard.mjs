import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk"), button:has-text("Login")').first().click();
    await page.waitForTimeout(2000);
  }
  
  // 1. Screenshot main overview
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_dashboard_main.png' });
  
  // 2. Click Evidence Center tab
  const evidenceNav = page.locator('button:has-text("Evidence Center")').first();
  if (await evidenceNav.isVisible()) {
    await evidenceNav.click();
    await page.locator('.evidence-summary-grid').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_dashboard_evidence.png' });
    
    // Click [CRUD Lifecycle] filter tab
    const crudTab = page.locator('button:has-text("CRUD Lifecycle")').first();
    if (await crudTab.isVisible()) {
      await crudTab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_evidence_crud.png' });
    }

    // Click [Search & Export] filter tab
    const searchTab = page.locator('button:has-text("Search & Export")').first();
    if (await searchTab.isVisible()) {
      await searchTab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_evidence_search_export.png' });
    }

    // Click [Form Validation] filter tab
    const formTab = page.locator('button:has-text("Form Validation")').first();
    if (await formTab.isVisible()) {
      await formTab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_evidence_form_val.png' });
    }

    // Reset back to [Semua (5)]
    const allTab = page.locator('button:has-text("Semua")').first();
    if (await allTab.isVisible()) {
      await allTab.click();
      await page.waitForTimeout(600);
    }
  }

  // 3. Navigate back to Project Summary overview
  const summaryNav = page.locator('button:has-text("Project Summary")').first();
  if (await summaryNav.isVisible()) {
    await summaryNav.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_dashboard_main.png' });
  }

  // 4. Open simplified project switcher popover
  const switcherCard = page.locator('.project-switcher-sidebar-card').first();
  if (await switcherCard.isVisible()) {
    await switcherCard.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/fe72f411-3bfb-4fef-9a72-86eeb9c705c1/qc_project_switcher_simplified.png' });
  }
  
  console.log('Done capturing all screenshots!');
  await browser.close();
}

main().catch(console.error);

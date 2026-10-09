import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk")').first().click();
    await page.waitForTimeout(1500);
  }

  await page.locator('.nav-item:has-text("Live Terminal")').first().click();
  await page.waitForTimeout(1000);

  const bounds = await page.evaluate(() => {
    const ws = document.querySelector('.workspace-view');
    const sidebar = document.querySelector('.bf-flows-sidebar');
    const flowCard = document.querySelector('.bf-flowchart-card');
    const canvas = document.querySelector('.fc-vertical-canvas');
    return {
      wsScrollLeft: ws?.scrollLeft,
      wsScrollTop: ws?.scrollTop,
      sidebarRect: sidebar?.getBoundingClientRect(),
      flowCardRect: flowCard?.getBoundingClientRect(),
      canvasRect: canvas?.getBoundingClientRect(),
      containerWidth: document.querySelector('.bf-visualizer-container')?.clientWidth,
      workspaceWidth: ws?.clientWidth,
    };
  });
  console.log(JSON.stringify(bounds, null, 2));

  // Now scroll flowCard into view and check again
  await page.locator('.bf-flowchart-card').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const boundsAfter = await page.evaluate(() => {
    const ws = document.querySelector('.workspace-view');
    const sidebar = document.querySelector('.bf-flows-sidebar');
    const flowCard = document.querySelector('.bf-flowchart-card');
    return {
      wsScrollLeft: ws?.scrollLeft,
      wsScrollTop: ws?.scrollTop,
      bodyScrollLeft: document.documentElement.scrollLeft,
      sidebarRect: sidebar?.getBoundingClientRect(),
      flowCardRect: flowCard?.getBoundingClientRect(),
    };
  });
  console.log('After scrollIntoView:', JSON.stringify(boundsAfter, null, 2));

  await browser.close();
}

main().catch(console.error);

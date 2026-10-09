import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4180/', { waitUntil: 'networkidle' });

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@qcmaestro.com');
    await page.locator('input[type="password"]').first().fill('admin12345');
    await page.locator('button:has-text("Masuk")').first().click();
    await page.waitForTimeout(2000);
  }

  await page.locator('.nav-item:has-text("Live Terminal")').first().click();
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    return {
      hasTopGrid: !!document.querySelector('.discovery-top-grid'),
      hasStages: !!document.querySelector('.discovery-stages-panel'),
      hasTerminal: !!document.querySelector('.modern-terminal'),
      hasOldTerminal: !!document.querySelector('.terminal'),
      hasVisualizer: !!document.querySelector('.bf-visualizer-container'),
      topGridOffsetTop: document.querySelector('.discovery-top-grid')?.offsetTop,
      visualizerOffsetTop: document.querySelector('.bf-visualizer-container')?.offsetTop,
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => `${h.tagName}: ${h.innerText}`),
      activeJobId: window.localStorage.getItem('qc_job_id'),
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // Take screenshot without scrolling
  await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity-ide/brain/d5858292-4317-4ea5-bcae-ccf9465a80ec/debug_view.png' });

  await browser.close();
}

main().catch(console.error);

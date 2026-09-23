import { chromium } from 'playwright';

async function testLogin(url: string) {
  console.log(`\n=== Testing Login on: ${url} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to login...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('   URL:', page.url());

    console.log('2. Filling email...');
    await page.fill("input[name='email']", 'admin@zannora.com');

    console.log('3. Filling password...');
    await page.fill("input[name='password']", 'password');

    console.log('4. Clicking submit with noWaitAfter...');
    await page.click("button[type='submit']", { noWaitAfter: true });

    console.log('5. Waiting for navigation/URL transition...');
    const start = Date.now();
    while (!page.url().includes('/dashboard') && (Date.now() - start) < 10000) {
      await page.waitForTimeout(300);
    }

    console.log('6. Final URL:', page.url());
    console.log('   Title:', await page.title());

    const isDashboard = page.url().includes('/dashboard');
    console.log(`   Result: ${isDashboard ? '✅ SUCCESS (Dashboard reached)' : '❌ FAILED (Not on dashboard)'}`);
  } catch (err: any) {
    console.error('   ❌ Error during test:', err.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  await testLogin('http://127.0.0.1:8000/login');
  await testLogin('http://127.0.0.1/Zannora/public/login');
}

run().catch(console.error);

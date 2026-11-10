import { chromium } from 'playwright';

async function testLogin(url: string, identifier: string, password: string) {
  console.log(`\n=== Testing Login on: ${url} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to login...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('   URL:', page.url());

    console.log('2. Filling identifier...');
    await page.fill("input[name='email'], input[name='username'], input[type='email'], input[type='text']", identifier);

    console.log('3. Filling password...');
    await page.fill("input[name='password'], input[type='password']", password);

    console.log('4. Clicking submit with noWaitAfter...');
    await page.click("button[type='submit'], button:has-text('Login'), button:has-text('Masuk')", { noWaitAfter: true });

    console.log('5. Waiting for navigation/URL transition...');
    const start = Date.now();
    while (page.url().includes('/login') && (Date.now() - start) < 10000) {
      await page.waitForTimeout(300);
    }

    console.log('6. Final URL:', page.url());
    console.log('   Title:', await page.title());

    const leftLogin = !page.url().includes('/login');
    console.log(`   Result: ${leftLogin ? 'SUCCESS (Authenticated)' : 'FAILED (Still on login)'}`);
  } catch (err: any) {
    console.error('   Error during test:', err?.message || String(err));
  } finally {
    await browser.close();
  }
}

async function run() {
  const url = process.argv[2] || process.env.QC_TEST_URL;
  const identifier = process.argv[3] || process.env.QC_TEST_IDENTIFIER;
  const password = process.argv[4] || process.env.QC_TEST_PASSWORD;
  if (!url || !identifier || !password) {
    console.error('Usage: tsx verify-login.ts <login-url> <identifier> <password> (or set QC_TEST_URL / QC_TEST_IDENTIFIER / QC_TEST_PASSWORD)');
    process.exitCode = 1;
    return;
  }
  await testLogin(url, identifier, password);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

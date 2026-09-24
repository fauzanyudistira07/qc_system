import { chromium } from 'playwright';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://host.docker.internal:8001/login', { waitUntil: 'domcontentloaded' });
  console.log('LOGIN', await p.evaluate(() => Array.from(document.querySelectorAll('button,select,textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])')).map((e) => ({ tag: e.tagName, type: e.getAttribute('type'), name: e.getAttribute('name'), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), cls: String(e.className) }))));
  await p.locator('input[name=email]').fill('admin@zannora.com');
  await p.locator('input[name=password]').fill('password');
  await p.locator('button[type=submit]').click({ noWaitAfter: true });
  await p.waitForURL((url) => !url.pathname.includes('/login'));
  await p.goto('http://host.docker.internal:8001/admin/reports', { waitUntil: 'domcontentloaded' });
  console.log('REPORT', await p.evaluate(() => Array.from(document.querySelectorAll('p.text-2xl')).map((e) => ({ text: e.textContent?.trim(), cw: e.clientWidth, sw: e.scrollWidth, ow: e.offsetWidth, whiteSpace: getComputedStyle(e).whiteSpace, wordBreak: getComputedStyle(e).wordBreak, overflow: getComputedStyle(e).overflowX, rect: e.getBoundingClientRect().toJSON() }))));
  await b.close();
})();

/**
 * Dev-only visual check: drives the locally installed Chrome against a running
 * server and writes screenshots to .screens/.
 *   node scripts/shoot.js [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:4931';
const OUT = path.resolve(import.meta.dirname, '..', '.screens');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const consoleErrors = [];

async function shoot(name, { url, width = 1280, height = 900, theme = 'dark', full = false, wait = 700, action }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${name}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[${name}] pageerror: ${err.message}`));
  await page.addInitScript((t) => localStorage.setItem('pul.theme', t), theme);
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  if (action) await action(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  const title = await page.title();
  await page.close();
  return title;
}

await shoot('01-leaderboard-normalized', { url: '/' });
await shoot('02-leaderboard-absolute', {
  url: '/',
  action: async (page) => {
    await page.getByRole('tab', { name: /Absolute/i }).click();
    await page.waitForTimeout(600);
  },
});
await shoot('03-users', { url: '/users', full: true });
await shoot('04-detail', {
  url: '/users',
  full: true,
  action: async (page) => {
    await page.locator('.panel .row a').first().click();
    await page.waitForTimeout(900);
  },
});
await shoot('05-detail-bodyweight', {
  url: '/users',
  action: async (page) => {
    await page.locator('.panel .row a').first().click();
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: /Bodyweight/i }).click();
    await page.waitForTimeout(500);
  },
});
await shoot('06-awards', { url: '/awards', full: true });
await shoot('06b-light-mode', { url: '/', theme: 'light' });
await shoot('06c-awards-light', { url: '/awards', theme: 'light', full: true });
await shoot('07-add-modal', {
  url: '/users?new=1',
  action: async (page) => {
    await page.waitForTimeout(500);
  },
});
await shoot('08-mobile', { url: '/', width: 390, height: 844, full: true });
await shoot('08b-mobile-roster', { url: '/users', width: 390, height: 844, full: true });
await shoot('08c-mobile-awards', { url: '/awards', width: 390, height: 844, full: true });
await shoot('09-mobile-detail', {
  url: '/users',
  width: 390,
  height: 844,
  full: true,
  action: async (page) => {
    await page.locator('.panel .row a').first().click();
    await page.waitForTimeout(900);
  },
});

await browser.close();

console.log(`screenshots → ${OUT}`);
if (consoleErrors.length) {
  console.log('\nconsole errors:');
  for (const e of consoleErrors) console.log('  ' + e);
} else {
  console.log('no console errors');
}

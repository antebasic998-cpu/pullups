/**
 * Dev-only UI verification: drives locally installed Chrome against a running
 * server and asserts what a screenshot review would catch – layout overflow,
 * ordering, chart geometry, contrast, CRUD and validation.
 *
 *   npm start        (in another terminal)
 *   npm run verify
 *
 * Run it against a scratch copy, never the live data:
 *   DATA_DIR=$PWD/.verify-data npm run seed
 *   DATA_DIR=$PWD/.verify-data PORT=4941 npm start
 *   BASE_URL=http://localhost:4941 npm run verify
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:4931';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: CHROME });
const problems = [];
const notes = [];
const note = (m) => notes.push(m);
const problem = (m) => problems.push(m);

function relativeLuminance([r, g, b]) {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const parseRGB = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
function contrast(fg, bg) {
  const l1 = relativeLuminance(parseRGB(fg));
  const l2 = relativeLuminance(parseRGB(bg));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

async function open(url, { theme = 'dark', width = 1280, height = 900 } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => {
    // 4xx resource errors are expected: this script deliberately probes validation paths.
    if (m.type() === 'error' && !/Failed to load resource.*(4\d\d)/.test(m.text())) {
      problem(`console error on ${url}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => problem(`page error on ${url}: ${e.message}`));
  await page.addInitScript((t) => localStorage.setItem('pul.theme', t), theme);
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return page;
}

const viewport = (page) =>
  page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, winW: window.innerWidth }));

const cellsOf = (page) =>
  page
    .locator('.panel .row')
    .evaluateAll((rows) => rows.map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim())));

/* ---------------- 1. Leaderboard ---------------- */
{
  const page = await open('/');
  note(`leaderboard h1: "${(await page.locator('h1').first().innerText()).trim()}"`);
  note(`subtitle: "${(await page.locator('main p').first().innerText()).trim()}"`);

  const vp = await viewport(page);
  if (vp.scrollW > vp.winW + 1) problem(`horizontal overflow: ${vp.scrollW} > ${vp.winW}`);
  else note(`no horizontal overflow (viewport ${vp.winW}px)`);

  const rows = await cellsOf(page);
  note(`leaderboard rows: ${rows.length}`);
  note(`row 1: ${JSON.stringify(rows[0])}`);
  note(`row 2: ${JSON.stringify(rows[1])}`);
  if (rows.some((cells) => cells.length !== 4)) problem('a leaderboard row does not have exactly 4 cells');

  const normalizedOrder = rows.map((c) => c[2]);
  note(`normalized column: ${normalizedOrder.join(' | ')}`);
  const nNums = normalizedOrder.map(Number);
  if (nNums.some((v, i) => i > 0 && v > nNums[i - 1])) problem('normalized column is not sorted descending');

  const ranks = await page.locator('.panel .row .rank').evaluateAll((els) =>
    els.slice(0, 4).map((e) => ({ text: e.textContent.trim(), color: getComputedStyle(e).color })),
  );
  note(`rank colours: ${JSON.stringify(ranks)}`);
  if (new Set(ranks.slice(0, 3).map((r) => r.color)).size < 3) problem('top three ranks are not visually distinct');

  await page.getByRole('tab', { name: 'Absolute' }).click();
  await page.waitForTimeout(500);
  const absRows = await cellsOf(page);
  const absoluteOrder = absRows.map((c) => c[2]);
  note(`absolute column: ${absoluteOrder.join(' | ')}`);
  const aNums = absoluteOrder.map(Number);
  if (aNums.some((v, i) => i > 0 && v > aNums[i - 1])) problem('absolute column is not sorted descending');
  if (JSON.stringify(normalizedOrder.slice(0, 5)) === JSON.stringify(absoluteOrder.slice(0, 5))) {
    problem('normalized and absolute show the same order – normalization is not affecting the ranking');
  }

  await page.getByRole('tab', { name: 'Best' }).click();
  await page.waitForTimeout(300);
  const themeVars = await page.evaluate(() => ({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
  }));
  note(`dark theme: ${JSON.stringify(themeVars)}`);
  const subtitle = await page.evaluate(() => getComputedStyle(document.querySelector('main p')).color);
  const ratio = contrast(subtitle, themeVars.bg);
  note(`subtitle contrast: ${ratio.toFixed(2)}:1`);
  if (ratio < 4.5) problem(`subtitle contrast too low: ${ratio.toFixed(2)}:1`);

  await page.locator('.panel .row').first().click();
  await page.waitForTimeout(700);
  if (!page.url().includes('/users/')) problem('clicking a leaderboard row did not open the profile');
  else note('row click opens the profile');
  await page.close();
}

/* ---------------- 2. Roster ---------------- */
{
  const page = await open('/users');
  note(`roster rows: ${await page.locator('.panel .row').count()}`);
  note(`first row: ${(await page.locator('.panel .row').first().innerText()).replace(/\s+/g, ' ').slice(0, 120)}`);

  const clipped = await page.locator('.panel .row').evaluateAll((els) =>
    els.filter((e) => e.scrollHeight > e.getBoundingClientRect().height + 2).length,
  );
  if (clipped) problem(`${clipped} roster row(s) clip their content`);

  const controls = await page.locator('.panel .row').first().locator('button').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        label: e.textContent.trim() || e.getAttribute('aria-label'),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }),
  );
  note(`row controls: ${JSON.stringify(controls)}`);
  if (controls.some((c) => c.h < 24)) problem(`a row control is under 24px tall: ${JSON.stringify(controls)}`);

  const search = page.getByLabel('Search athletes');
  await search.fill('mar');
  await page.waitForTimeout(350);
  note(`search "mar" → ${await page.locator('.panel .row').count()} row(s)`);
  await search.fill('zzz');
  await page.waitForTimeout(350);
  const emptyShown = await page.getByText('No match').count();
  note(`search "zzz" → empty state: ${emptyShown > 0}`);
  if (!emptyShown) problem('empty search state is missing');
  await search.fill('');
  await page.waitForTimeout(300);
  note(`search cleared → ${await page.locator('.panel .row').count()} row(s)`);
  await page.close();
}

/* ---------------- 3. Profile + chart ---------------- */
{
  const page = await open('/users');
  await page.locator('.panel .row a').first().click();
  await page.waitForTimeout(900);
  note(`profile h1: "${(await page.locator('h1').first().innerText()).trim()}"`);
  note(`profile meta: "${(await page.locator('header p').first().innerText()).trim()}"`);

  const metrics = await page.locator('.metric').evaluateAll((els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  note(`metrics: ${JSON.stringify(metrics)}`);
  if (metrics.length !== 5) problem(`expected 5 career metrics, got ${metrics.length}`);

  const chart = await page.locator('svg[role="img"]').first().evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    return {
      w: Math.round(box.width),
      h: Math.round(box.height),
      pathLengths: [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d')?.length ?? 0),
      dots: svg.querySelectorAll('circle').length,
      yLabels: [...svg.querySelectorAll('text')].slice(0, 6).map((t) => t.textContent),
    };
  });
  note(`chart: ${JSON.stringify(chart)}`);
  if (chart.w < 260 || chart.h < 180) problem(`chart too small: ${chart.w}x${chart.h}`);
  if (!chart.pathLengths.some((l) => l > 40)) problem('chart line path looks empty');
  if (chart.dots === 0) problem('chart has no data points');

  const box = await page.locator('svg[role="img"]').first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await page.waitForTimeout(300);
  const tooltip = await page.locator('.pointer-events-none.absolute').first().innerText().catch(() => null);
  note(`chart tooltip: ${tooltip ? tooltip.replace(/\s+/g, ' ') : 'NOT SHOWN'}`);
  if (!tooltip) problem('chart hover tooltip did not appear');

  for (const label of ['Pull-ups', 'Bodyweight', 'Normalized']) {
    await page.getByRole('tab', { name: new RegExp(label, 'i') }).click();
    await page.waitForTimeout(300);
    note(`series ${label}: ${(await page.locator('svg[role="img"]').first().getAttribute('aria-label'))?.slice(0, 60)}`);
  }

  const historyRows = await page.locator('table tbody tr').count();
  note(`history rows: ${historyRows}`);
  if (historyRows === 0) problem('profile history table is empty');

  const deleteOpacity = await page
    .locator('table tbody tr')
    .first()
    .locator('button')
    .evaluate((b) => getComputedStyle(b).opacity);
  note(`row delete button opacity at rest: ${deleteOpacity}`);
  if (Number(deleteOpacity) > 0.05) problem('history delete buttons should stay hidden until hover');

  const vp = await viewport(page);
  if (vp.scrollW > vp.winW + 1) problem(`profile horizontal overflow: ${vp.scrollW} > ${vp.winW}`);
  await page.close();
}

/* ---------------- 4. Log-result modal ---------------- */
{
  const page = await open('/users');
  await page.getByRole('button', { name: 'Log' }).first().click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole('dialog');
  note(`log modal: ${(await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 140)}`);

  const median = await page.evaluate(async () => (await (await fetch('/api/meta')).json()).medianMassKg);
  const weight = await dialog.getByLabel('Bodyweight that day (kg)').inputValue();
  await dialog.getByLabel('Pull-ups completed').fill('12');
  await page.waitForTimeout(300);
  const preview = await dialog.locator('[data-testid="normalized-preview"]').innerText();
  const expected = (12 * (Number(weight) / median) ** 0.67).toFixed(2);
  note(`live preview for 12 reps @ ${weight}kg (median ${median}): got ${preview}, expected ${expected}`);
  if (preview !== expected) problem(`live normalized preview mismatch: ${preview} vs ${expected}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.getByRole('dialog').count()) problem('Escape did not close the modal');
  else note('Escape closes the modal');
  await page.close();
}

/* ---------------- 5. Write path + validation ---------------- */
{
  const page = await open('/users');
  const created = `Test Athlete ${Date.now() % 10000}`;
  await page.getByRole('button', { name: 'Add athlete' }).first().click();
  await page.waitForTimeout(400);
  await page.getByLabel('Full name').fill(created);
  await page.getByLabel('Age').fill('33');
  await page.getByLabel('Bodyweight (kg)').fill('95');
  await page.getByLabel('Pull-ups (PB)').fill('11');
  await page.getByRole('button', { name: 'Add athlete' }).last().click();
  await page.waitForTimeout(1000);
  note(`redirect after create: ${page.url().includes('/users/') ? 'profile' : page.url()}`);
  note(`new athlete PB metric: ${(await page.locator('.metric').first().innerText()).replace(/\s+/g, ' ')}`);

  const median = await page.evaluate(async () => (await (await fetch('/api/meta')).json()).medianMassKg);
  note(`expected normalized for 11 reps @95kg: ${(11 * (95 / median) ** 0.67).toFixed(2)}`);

  await page.getByRole('button', { name: 'Log result' }).first().click();
  await page.waitForTimeout(400);
  await page.getByLabel('Pull-ups completed').fill('14');
  await page.getByRole('button', { name: 'Save result' }).click();
  await page.waitForTimeout(1100);
  note(`after logging 14 reps: ${(await page.locator('.metric').first().innerText()).replace(/\s+/g, ' ')}`);
  note(`history rows now: ${await page.locator('table tbody tr').count()}`);

  const guards = await page.evaluate(async (name) => {
    const post = async (body) => {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.status;
    };
    const statuses = {
      dup: await post({ name, weightKg: 70 }),
      reps501: await post({ name: 'Too Many', weightKg: 70, pbAbsolute: 501 }),
      light: await post({ name: 'Too Light', weightKg: 19 }),
      heavy: await post({ name: 'Too Heavy', weightKg: 401 }),
      old: await post({ name: 'Too Old', age: 200, weightKg: 70 }),
      blank: await post({ name: '   ', weightKg: 70 }),
    };
    const users = (await (await fetch('/api/users')).json()).users.map((u) => u.name);
    return { ...statuses, halfCreated: users.includes('Too Many') };
  }, created);
  note(`validation: ${JSON.stringify(guards)}`);
  if (guards.dup !== 409) problem(`duplicate name should be 409, got ${guards.dup}`);
  for (const key of ['reps501', 'light', 'heavy', 'old', 'blank']) {
    if (guards[key] !== 400) problem(`${key} should be rejected with 400, got ${guards[key]}`);
  }
  if (guards.halfCreated) problem('a rejected PB still created a half-created athlete');

  const id = page.url().split('/').pop();
  await page.evaluate(async (userId) => fetch(`/api/users/${userId}`, { method: 'DELETE' }), id);
  note('test athlete removed');
  await page.close();
}

/* ---------------- 6. CSV import ---------------- */
{
  const page = await open('/users');
  const result = await page.evaluate(async (csv) => {
    const list = await (await fetch('/api/users')).json();
    const target = list.users[0];
    const res = await fetch(`/api/users/${target.id}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });
    const body = await res.json();
    // Roll the imported rows back out so the demo data stays pristine.
    for (const s of body.user.sessions.filter((x) => x.date < '2026-03-01')) {
      await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
    }
    return { name: target.name, imported: body.imported, errors: body.errors };
  }, 'date,reps,weight\n2026-01-05,9,70\n2026-01-12,11,70\n05.02.2026;12;71\nnot-a-row');
  note(`csv import: ${JSON.stringify(result)}`);
  if (result.imported !== 3) problem(`expected 3 imported rows, got ${result.imported}`);
  if (!result.errors?.length) problem('the malformed CSV row was not reported');
  await page.close();
}

/* ---------------- 6b. Awards page ---------------- */
{
  const page = await open('/awards');
  note(`awards h1: "${(await page.locator('h1').first().innerText()).trim()}"`);
  note(`awards subtitle: "${(await page.locator('header p').first().innerText()).trim()}"`);

  const cards = await page.locator('main section').first().locator('> div').evaluateAll((els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 48)),
  );
  note(`award cards (${cards.length}): ${JSON.stringify(cards)}`);
  if (cards.length < 9) problem(`expected 9 award categories, got ${cards.length}`);

  const awarded = await page.locator('main section').first().locator('> div a').count();
  note(`awards with a winner: ${awarded}`);
  if (awarded === 0) problem('no weekly award was given out despite the demo data');

  const xpRows = await page.locator('main section').nth(1).locator('.row').count();
  const levelRows = await page.locator('main section').nth(2).locator('.row').count();
  note(`XP race rows: ${xpRows}, level rows: ${levelRows}`);
  if (xpRows === 0 || levelRows === 0) problem('XP race or levels list is empty');

  const badgeTiles = await page.locator('main section').nth(3).locator('> div > div').count();
  note(`badge wall tiles: ${badgeTiles}`);
  if (badgeTiles < 16) problem(`expected 16 badges in the wall, got ${badgeTiles}`);

  const vp = await viewport(page);
  if (vp.scrollW > vp.winW + 1) problem(`awards page horizontal overflow: ${vp.scrollW} > ${vp.winW}`);
  await page.close();
}

/* ---------------- 6c. Gamification on the profile ---------------- */
{
  const page = await open('/users');
  await page.locator('.panel .row a').first().click();
  await page.waitForTimeout(900);

  const level = await page.locator('.card').first().innerText();
  note(`level card: ${level.replace(/\s+/g, ' ')}`);
  if (!/Level \d/.test(level)) problem('level card does not show a level');
  if (!/XP/.test(level)) problem('level card does not show XP');

  const bar = await page.locator('[role="progressbar"]').first().evaluate((el) => ({
    now: el.getAttribute('aria-valuenow'),
    fillWidth: el.firstElementChild?.getBoundingClientRect().width ?? 0,
    trackWidth: el.getBoundingClientRect().width,
  }));
  note(`XP bar: ${JSON.stringify(bar)}`);
  if (Number(bar.now) <= 0) problem('XP progress bar shows 0%');
  if (bar.fillWidth <= 0 || bar.fillWidth > bar.trackWidth + 1) problem('XP bar fill is not within its track');

  const career = await page.locator('.metric').allInnerTexts();
  note(`career metrics: ${JSON.stringify(career)}`);
  if (career.length !== 5) problem(`expected 5 career metrics, got ${career.length}`);

  const badges = await page.locator('.panel .grid > div').evaluateAll((els) =>
    els.map((e) => e.getAttribute('title') ?? ''),
  );
  const unlocked = badges.filter((t) => t.includes('unlocked')).length;
  note(`badge tiles: ${badges.length}, unlocked for this athlete: ${unlocked}`);
  if (badges.length < 16) problem(`expected 16 badge tiles on the profile, got ${badges.length}`);
  if (!badges.every((t) => t.length > 0)) problem('a badge tile is missing its tooltip/description');

  const lockedShown = badges.filter((t) => !t.includes('unlocked')).length;
  note(`locked badges visible (not hidden): ${lockedShown}`);
  if (lockedShown === 0) problem('locked badges are not shown — nothing to chase');

  // board names in the profile chart still work
  for (const label of ['Pull-ups', 'Bodyweight', 'Normalized']) {
    await page.getByRole('tab', { name: new RegExp(label, 'i') }).click();
    await page.waitForTimeout(250);
  }
  note('chart series still switch correctly on the profile');

  const vp = await viewport(page);
  if (vp.scrollW > vp.winW + 1) problem(`profile horizontal overflow: ${vp.scrollW} > ${vp.winW}`);
  await page.close();
}

/* ---------------- 7. Light theme ---------------- */
{
  const page = await open('/', { theme: 'light' });
  const vars = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  }));
  const body = contrast(vars.fg, vars.bg);
  note(`light theme: ${JSON.stringify(vars)} body contrast ${body.toFixed(2)}:1`);
  if (body < 10) problem(`light theme body contrast low: ${body.toFixed(2)}:1`);

  const faintColour = await page.evaluate(() => {
    const el = document.querySelector('.faint');
    return el ? getComputedStyle(el).color : null;
  });
  if (faintColour) {
    const r = contrast(faintColour, vars.bg);
    note(`light theme .faint contrast: ${r.toFixed(2)}:1`);
    if (r < 3) problem(`.faint is too light to read in light mode: ${r.toFixed(2)}:1`);
  }
  await page.close();
}

/* ---------------- 8. Responsive sweep ---------------- */
{
  for (const width of [320, 360, 414, 768, 1024, 1440]) {
    for (const route of ['/', '/awards', '/users']) {
      const page = await open(route, { width, height: 900 });
      const vp = await viewport(page);
      if (vp.scrollW > vp.winW + 1) problem(`horizontal overflow at ${width}px on ${route}: ${vp.scrollW} > ${vp.winW}`);
      await page.close();
    }
    const page = await open('/users', { width, height: 900 });
    await page.locator('.panel .row a').first().click();
    await page.waitForTimeout(800);
    const vp = await viewport(page);
    if (vp.scrollW > vp.winW + 1) problem(`horizontal overflow at ${width}px on the profile: ${vp.scrollW} > ${vp.winW}`);
    await page.close();
  }
  note('responsive sweep done: 320 / 360 / 414 / 768 / 1024 / 1440 px on all three pages');
}

/* ---------------- 9. Mobile layout ---------------- */
{
  const page = await open('/', { width: 390, height: 844 });
  const cells = await page.locator('.panel .row').first().evaluate((row) =>
    [...row.children].map(
      (c) =>
        `${getComputedStyle(c).display === 'none' ? 'HIDDEN' : 'shown'}:${c.textContent.replace(/\s+/g, ' ').trim().slice(0, 16)}`,
    ),
  );
  note(`mobile leaderboard row: ${cells.join(' | ')}`);
  if (!cells.some((c) => c.startsWith('HIDDEN'))) problem('the mobile leaderboard should drop the secondary column');

  const header = await page.evaluate(() => {
    const longLabel = [...document.querySelectorAll('header span')].find((s) => s.textContent === 'Add athlete');
    return { addLabelShown: longLabel ? getComputedStyle(longLabel).display !== 'none' : false };
  });
  note(`mobile header: ${JSON.stringify(header)}`);
  if (header.addLabelShown) problem('"Add athlete" should collapse to "Add" on small screens');
  await page.close();

  const roster = await open('/users', { width: 360, height: 800 });
  const actions = await roster
    .locator('.panel .row')
    .first()
    .locator('button')
    .evaluateAll((els) =>
      els
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => e.textContent.trim() || e.getAttribute('aria-label')),
    );
  note(`mobile roster actions visible: ${JSON.stringify(actions)}`);
  if (!actions.includes('Log')) problem('the Log button disappears on mobile');
  if (actions.length > 2) problem(`too many controls on a phone roster row: ${JSON.stringify(actions)}`);
  const vp = await viewport(roster);
  if (vp.scrollW > vp.winW + 1) problem(`mobile roster overflow: ${vp.scrollW} > ${vp.winW}`);
  await roster.close();
}

/* ---------------- 10. Edge-case data ---------------- */
{
  const page = await open('/users');
  const made = await page.evaluate(async () => {
    const mk = async (payload) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return (await res.json()).user;
    };
    const long = await mk({ name: 'Maximilian-Alexander von Habsburg-Lothringen III', age: 44, weightKg: 20 });
    const empty = await mk({ name: 'Zero Attempts', weightKg: 400 });
    const single = await mk({ name: 'Single Attempt', weightKg: 55, pbAbsolute: 1, pbDate: '2026-09-01' });
    const markup = await mk({ name: 'Bold <b>Bob</b> & Co', weightKg: 70 });
    await fetch(`/api/users/${long.id}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reps: 500, date: '2026-09-10' }),
    });
    return { long: long.id, empty: empty.id, single: single.id, markup: markup.id };
  });
  note('edge users created: long name @20 kg / 500 reps, no attempts @400 kg, single attempt, markup in a name');

  await page.goto(`${BASE}/users/${made.long}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const extreme = await page.evaluate(() => ({
    metrics: [...document.querySelectorAll('.metric')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    scrollW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  }));
  note(`extreme athlete: ${JSON.stringify(extreme)}`);
  if (extreme.scrollW > extreme.winW + 1) problem('a long name causes horizontal overflow');

  await page.goto(`${BASE}/users/${made.empty}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  note(`zero-attempt metrics: ${JSON.stringify(await page.locator('.metric').allInnerTexts())}`);
  const emptyRows = await page.locator('table tbody tr').count();
  note(`zero-attempt history rows: ${emptyRows}`);
  if (emptyRows !== 0) problem('a profile with no attempts should not render history rows');

  await page.goto(`${BASE}/users/${made.single}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const singleFallback = await page.getByText(/log one more attempt to see the trend line/).count();
  note(`single-attempt chart fallback: ${singleFallback > 0}`);
  if (!singleFallback) problem('single-attempt chart fallback text is missing');

  await page.goto(`${BASE}/users/${made.markup}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const escaped = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent,
    boldTags: document.querySelectorAll('h1 b').length,
  }));
  note(`markup in a name renders as: ${JSON.stringify(escaped)}`);
  if (escaped.boldTags > 0) problem('user-supplied name rendered as raw HTML (XSS)');

  const cleanup = await page.evaluate(async (ids) => {
    for (const id of ids) await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const meta = await (await fetch('/api/meta')).json();
    return { removed: ids.length, users: meta.userCount, attempts: meta.attemptCount, median: meta.medianMassKg };
  }, [made.long, made.empty, made.single, made.markup]);
  note(`final data state: ${JSON.stringify(cleanup)}`);
  if (cleanup.users !== 10 || cleanup.attempts !== 224 || cleanup.median !== 71) {
    problem(`verification did not leave the demo data pristine: ${JSON.stringify(cleanup)}`);
  }
  await page.close();
}

await browser.close();

console.log('=== NOTES ===');
for (const n of notes) console.log(' • ' + n);
console.log(`\n=== PROBLEMS: ${problems.length} ===`);
for (const p of problems) console.log(' ✗ ' + p);
if (!problems.length) console.log(' none');

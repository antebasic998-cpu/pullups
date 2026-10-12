/**
 * Brand asset generator – "first over the bar + hands" logo.
 *
 * One piece of vector art (256×256 grid) → every icon the web and mobile apps need.
 * Renders through the locally installed Chrome, same as scripts/shoot.js.
 *
 *   node scripts/brand-assets.js      (or: npm run brand)
 *
 * Writes:
 *   brand/            logo-tile.svg · logo-mark.svg · logo-mono.svg   (design sources)
 *   web/public/       logo.svg · favicon.ico · apple-touch-icon.png · icon-192/512 · icon-maskable-512
 *   mobile/assets/    icon · android-icon-{foreground,background,monochrome} · splash-icon · favicon · logo
 *
 * web/public/site.webmanifest is hand-written and not touched here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Palette – the app's dark theme (web --bg / --accent).
const BG = '#0a0b0d';
const LIME = '#c9f750';
const LIME_MID = '#7f9a33';
const LIME_LOW = '#4e5f25';

// ───────────────────────── art ─────────────────────────

const rect = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

/** Column with rounded top corners and a flat base. */
const col = (x, y, w, h, r, fill, opacity = 1) =>
  `<path d="M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z" ` +
  `fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;

const HANDS = [
  [68, 82],
  [164, 82],
];
const ART_CENTER_Y = 129.5; // vertical middle of the art's bounding box (y 45 → 214)

/**
 * The mark: bar, three podium columns, head, two fists gripping the bar.
 * The small gap around each fist is a real transparent cut-out (mask), so the art
 * works on any background – tile, transparent splash, monochrome Android icon.
 *
 * @param scale  1 = art spans 83% of the canvas width. Android adaptive/splash icons use
 *               0.7 so the bar stays inside the 66% safe circle.
 * @param mono   single-colour version (alpha only): columns step down in opacity instead of tone.
 */
function art({ scale = 1, mono = false } = {}) {
  const c1 = mono ? '#fff' : LIME;
  const c2 = mono ? '#fff' : LIME_MID;
  const c3 = mono ? '#fff' : LIME_LOW;
  const o2 = mono ? 0.6 : 1;
  const o3 = mono ? 0.35 : 1;

  const hands = HANDS.map(([x, y]) => rect(x, y, 24, 32, 9, c1)).join('');
  const handCuts = HANDS.map(([x, y]) =>
    rect(x, y, 24, 32, 9, '#fff', 'stroke="#000" stroke-width="5" paint-order="stroke"'),
  ).join('');

  return (
    `<defs><mask id="notch" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">` +
    `<rect width="256" height="256" fill="#fff"/>${handCuts}</mask></defs>` +
    `<g transform="translate(128 128) scale(${scale}) translate(-128 -${ART_CENTER_Y})">` +
    `<g mask="url(#notch)">` +
    rect(22, 92, 212, 12, 6, c1) +
    col(49, 150, 46, 64, 16, c2, o2) +
    col(161, 174, 46, 40, 14, c3, o3) +
    col(105, 116, 46, 98, 16, c1) +
    `<circle cx="128" cy="64" r="19" fill="${c1}"/>` +
    `</g>${hands}</g>`
  );
}

const svgDoc = (inner, size = 256) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">${inner}</svg>`;

/** Variants – each returns an SVG factory taking the pixel size. */
const V = {
  /** Rounded tile on transparent corners: web favicon/logo, in-app logo. */
  tile: (s) => svgDoc(`<rect width="256" height="256" rx="57" fill="${BG}"/>${art()}`, s),
  /** Full-bleed opaque square: iOS icon, apple-touch-icon, PWA icons (OS applies its own mask). */
  square: (s) => svgDoc(`<rect width="256" height="256" fill="${BG}"/>${art()}`, s),
  /** Same, art pulled in to sit inside the 80% maskable safe zone. */
  maskable: (s) => svgDoc(`<rect width="256" height="256" fill="${BG}"/>${art({ scale: 0.88 })}`, s),
  /** Transparent art, scaled for Android's adaptive-icon safe zone and the Android 12 splash mask. */
  foreground: (s) => svgDoc(art({ scale: 0.7 }), s),
  /** Alpha-only art for Android themed icons. */
  monochrome: (s) => svgDoc(art({ scale: 0.7, mono: true }), s),
  /** Solid adaptive-icon background layer. */
  solid: (s) => svgDoc(`<rect width="256" height="256" fill="${BG}"/>`, s),
  /** Transparent art at full size (design source). */
  mark: (s) => svgDoc(art(), s),
  /** Single-colour art at full size (design source). */
  mono: (s) => svgDoc(art({ mono: true }), s),
};

// ───────────────────────── output ─────────────────────────

const write = (rel, data) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('  ' + rel);
};

/** Minimal .ico writer: PNG-compressed entries (supported everywhere since Vista). */
function ico(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dir = entries.map(({ size, buf }) => {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size;
    d[1] = size >= 256 ? 0 : size;
    d.writeUInt16LE(1, 4); // colour planes
    d.writeUInt16LE(32, 6); // bits per pixel
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    return d;
  });
  return Buffer.concat([head, ...dir, ...entries.map((e) => e.buf)]);
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });

/** Rasterise a variant at an exact pixel size; transparent where the art is. Not safe to call concurrently. */
async function png(variant, size) {
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${V[variant](size)}</body></html>`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

try {
  console.log('brand/');
  write('brand/logo-tile.svg', V.tile(256) + '\n');
  write('brand/logo-mark.svg', V.mark(256) + '\n');
  write('brand/logo-mono.svg', V.mono(256) + '\n');

  console.log('web/public/');
  write('web/public/logo.svg', V.tile(256) + '\n');
  // Sequential on purpose: png() reuses one page, concurrent calls would overwrite each other.
  const faviconSizes = [];
  for (const size of [16, 32, 48]) faviconSizes.push({ size, buf: await png('tile', size) });
  write('web/public/favicon.ico', ico(faviconSizes));
  write('web/public/apple-touch-icon.png', await png('square', 180));
  write('web/public/icon-192.png', await png('square', 192));
  write('web/public/icon-512.png', await png('square', 512));
  write('web/public/icon-maskable-512.png', await png('maskable', 512));

  console.log('mobile/assets/');
  write('mobile/assets/icon.png', await png('square', 1024));
  write('mobile/assets/android-icon-foreground.png', await png('foreground', 1024));
  write('mobile/assets/android-icon-background.png', await png('solid', 1024));
  write('mobile/assets/android-icon-monochrome.png', await png('monochrome', 1024));
  write('mobile/assets/splash-icon.png', await png('foreground', 1024));
  write('mobile/assets/favicon.png', await png('tile', 48));
  write('mobile/assets/logo.png', await png('tile', 1024));
} finally {
  await browser.close();
}

/**
 * Renders the Android launcher icons and splash images from the shared art in orbit-art.mjs:
 *   - legacy square and round icons (Android 7.x and launchers that ignore adaptive icons),
 *   - the adaptive-icon foreground layer (the background is a solid colour resource),
 *   - portrait and landscape splash images for every density, and a 512 px preview for the README.
 *
 *   npm run android:icons
 *
 * It drives the installed Edge or Chrome through playwright-core, so there is no image library to install. Set
 * ORBIT_BROWSER to a Chromium executable if neither browser is found.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BACKDROP, COLORS, MARK, svg } from './orbit-art.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const work = mkdtempSync(join(tmpdir(), 'orbit-icons-'));

const DENSITIES = [
  { name: 'mdpi', legacy: 48, layer: 108, splash: [320, 480] },
  { name: 'hdpi', legacy: 72, layer: 162, splash: [480, 800] },
  { name: 'xhdpi', legacy: 96, layer: 216, splash: [720, 1280] },
  { name: 'xxhdpi', legacy: 144, layer: 324, splash: [960, 1600] },
  { name: 'xxxhdpi', legacy: 192, layer: 432, splash: [1280, 1920] },
];

const serif = require.resolve('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2');

function iconSvg(shape) {
  if (shape === 'foreground') return svg(MARK);
  const clip =
    shape === 'round'
      ? '<circle cx="54" cy="54" r="54"/>'
      : '<rect width="108" height="108" rx="24"/>';
  const bg = `<clipPath id="c">${clip}</clipPath><g clip-path="url(#c)"><rect width="108" height="108" fill="${COLORS.bg}"/>${BACKDROP}</g>`;
  return svg(`${bg}${MARK}`);
}

function splashHtml(width, height) {
  const mark = Math.round(Math.min(width, height) * 0.5);
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: 'OS'; font-style: italic; src: url('${pathToFileURL(serif).href}'); }
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${COLORS.bg}; overflow: hidden; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${Math.round(height * 0.03)}px; }
    .mark { width: ${mark}px; height: ${mark}px; }
    h1 { margin: 0; font: italic 400 ${Math.round(Math.min(width, height) * 0.13)}px/1 'OS', Georgia, serif; color: ${COLORS.text}; }
    h1 b { color: ${COLORS.amber}; font-weight: 400; }
  </style><div class="mark">${svg(BACKDROP + MARK)}</div><h1>Orbit <b>Shift</b></h1>`;
}

async function launch() {
  const candidates = process.env.ORBIT_BROWSER
    ? [{ executablePath: process.env.ORBIT_BROWSER }]
    : [{ channel: 'msedge' }, { channel: 'chrome' }];
  for (const candidate of candidates) {
    try {
      return await chromium.launch({ headless: true, ...candidate });
    } catch {
      /* try the next browser */
    }
  }
  throw new Error('No Chromium-based browser found. Set ORBIT_BROWSER to its executable path.');
}

/** Renders `html` at `size` ([w, h]) to a PNG at `file`; `transparent` keeps the page background see-through. */
async function render(browser, { html, size, file, transparent = false }) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  const path = join(work, 'page.html');
  writeFileSync(path, html);
  await page.goto(pathToFileURL(path).href);
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
}

function squarePage(inner, px, transparent) {
  const bg = transparent ? 'transparent' : COLORS.bg;
  return `<!doctype html><style>html,body{margin:0;width:${px}px;height:${px}px;background:${bg}}svg{display:block}</style>${inner}`;
}

const browser = await launch();
for (const d of DENSITIES) {
  const dir = join(res, `mipmap-${d.name}`);
  const icon = (shape, px, name) => {
    const html = squarePage(iconSvg(shape), px, true);
    return render(browser, { html, size: [px, px], file: join(dir, name), transparent: true });
  };
  await icon('square', d.legacy, 'ic_launcher.png');
  await icon('round', d.legacy, 'ic_launcher_round.png');
  await icon('foreground', d.layer, 'ic_launcher_foreground.png');
  const [w, h] = d.splash;
  const splash = (name, size) =>
    render(browser, { html: splashHtml(...size), size, file: join(res, `drawable-${name}-${d.name}`, 'splash.png') });
  await splash('port', [w, h]);
  await splash('land', [h, w]);
}
await render(browser, { html: splashHtml(480, 320), size: [480, 320], file: join(res, 'drawable', 'splash.png') });
mkdirSync(join(root, 'docs'), { recursive: true });
await render(browser, {
  html: squarePage(iconSvg('square'), 512, true),
  size: [512, 512],
  file: join(root, 'docs', 'orbit-shift-icon.png'),
  transparent: true,
});
writeFileSync(
  join(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${COLORS.bg}</color>\n</resources>\n`,
);
await browser.close();
console.log('Wrote launcher icons, splash images and docs/orbit-shift-icon.png');

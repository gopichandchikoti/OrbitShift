/**
 * Android checks against a running emulator or phone: installs the debug APK, then drives the real app through its
 * WebView's DevTools socket (a small CDP client) plus device-level adb input and lifecycle events.
 *
 *   npm run android:apk:debug
 *   ORBIT_ADB_SERIAL=emulator-5562 npm run android:verify
 *
 * ORBIT_ADB_SERIAL is required, so this can never touch some other device or emulator by accident. An emulator is
 * not a phone: frame rate and touch feel measured here say nothing about a real Samsung Galaxy.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const serial = process.env.ORBIT_ADB_SERIAL;
const sdk = process.env.ANDROID_HOME;
if (!serial || !sdk) {
  console.error('Set ORBIT_ADB_SERIAL (for example emulator-5562) and ANDROID_HOME.');
  process.exit(2);
}
const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const APP = 'com.portfolio.orbitshift';
const APK = join(root, 'artifacts', 'OrbitShift-1.0.0-debug.apk');
const OUT = join(root, 'tests', 'android', 'output');
mkdirSync(OUT, { recursive: true });
const PORT = 9333;
const results = [];
const consoleLog = [];

function sh(...args) {
  const r = spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
}
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(name, body) {
  try {
    await body();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n      ${String(error.message).split('\n').join('\n      ')}`);
  }
}

/** A minimal Chrome DevTools Protocol client for the app's WebView page. */
async function pageTarget() {
  for (let i = 0; i < 40; i++) {
    const targets = await fetch(`http://localhost:${PORT}/json`).then((r) => r.json()).catch(() => []);
    const target = targets.find((t) => t.type === 'page');
    if (target) return target;
    await sleep(500);
  }
  throw new Error('no page target appeared in the WebView');
}

async function connect() {
  const target = await pageTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
      consoleLog.push(`${msg.params.type}: ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleLog.push(`pageerror: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1);
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async (expression, what, timeout = 20000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
      await sleep(250);
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  return { evaluate, waitFor, close: () => ws.close() };
}

async function launchAndAttach() {
  sh('shell', 'am', 'force-stop', APP);
  sh('shell', 'am', 'start', '-n', `${APP}/.MainActivity`);
  let socket = '';
  for (let i = 0; i < 40 && !socket; i++) {
    await sleep(500);
    // Only this app's WebView: the socket is named after the app's process id.
    const pid = sh('shell', 'pidof', APP).split(/\s+/)[0];
    if (pid && sh('shell', 'cat', '/proc/net/unix').includes(`@webview_devtools_remote_${pid}`)) {
      socket = `webview_devtools_remote_${pid}`;
    }
  }
  assert(socket, 'the WebView DevTools socket never appeared (is this a debug build?)');
  sh('forward', `tcp:${PORT}`, `localabstract:${socket}`);
  const page = await connect();
  await page.waitFor("document.querySelector('canvas') && !document.getElementById('splash')", 'the game to start');
  return page;
}

function screenshotDevice(name) {
  sh('shell', 'screencap', '-p', `/sdcard/${name}.png`);
  sh('pull', `/sdcard/${name}.png`, join(OUT, `${name}.png`));
}

const buttonByText = (re) =>
  `Array.from(document.querySelectorAll('button')).find((b) => ${re}.test((b.getAttribute('aria-label') ?? b.textContent ?? '').trim()))`;

console.log(`Orbit Shift Android checks on ${serial}`);
console.log(`  device: ${sh('shell', 'getprop', 'ro.product.model')}, Android ${sh('shell', 'getprop', 'ro.build.version.release')}`);

await check('the debug APK installs over the previous one (an update keeps saved data)', async () => {
  assert(/Success/.test(sh('install', '-r', APK)), 'adb install did not report Success');
});

await check('the installed package is Orbit Shift 1.0.0 with no INTERNET permission', async () => {
  const info = sh('shell', 'dumpsys', 'package', APP);
  assert(/versionName=1\.0\.0/.test(info), 'versionName is not 1.0.0');
  assert(!/android\.permission\.INTERNET/.test(info), 'the app requests INTERNET');
  assert(/android\.permission\.VIBRATE/.test(info), 'expected the VIBRATE permission for haptics');
});

let page = await launchAndAttach();

await check('the game loads from the bundled files (https://localhost), with no dev hook', async () => {
  assert(/^https:\/\/localhost\//.test(await page.evaluate('location.href')), 'not served from the bundled origin');
  assert((await page.evaluate('document.title')) === 'Orbit Shift', 'wrong title');
  assert((await page.evaluate("document.querySelectorAll('canvas').length")) === 1, 'expected one canvas');
  assert(await page.evaluate("typeof window.__orbit === 'undefined'"), 'the dev hook is present in the APK');
});

await check('the bundled fonts are available with no network', async () => {
  const fonts = await page.evaluate(
    `['italic 40px "Instrument Serif"', '600 20px "IBM Plex Mono"', '600 30px "Instrument Sans Variable"'].map((f) => document.fonts.check(f))`,
  );
  assert(fonts.every(Boolean), `font check: ${fonts}`);
});

await check('the playfield is 9:16 and the UI layer sits exactly over it', async () => {
  const g = await page.evaluate(`(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    const u = document.getElementById('ui').getBoundingClientRect();
    return { c: [c.width, c.height, c.left, c.top], u: [u.width, u.height, u.left, u.top], w: innerWidth, h: innerHeight, dpr: devicePixelRatio };
  })()`);
  assert(Math.abs(g.c[0] / g.c[1] - 0.5625) < 0.01, `canvas ratio ${(g.c[0] / g.c[1]).toFixed(3)}`);
  g.c.forEach((v, i) => assert(Math.abs(v - g.u[i]) < 2, `UI misaligned ${JSON.stringify(g)}`));
  console.log(`      viewport ${g.w}x${g.h} css px at ${g.dpr}x; canvas ${Math.round(g.c[0])}x${Math.round(g.c[1])}`);
});

await check('system-bar insets reach the page (Capacitor safe-area variables)', async () => {
  const v = await page.evaluate(
    `(() => { const r = getComputedStyle(document.documentElement); return { top: r.getPropertyValue('--safe-area-inset-top').trim(), safe: r.getPropertyValue('--safe-top').trim() }; })()`,
  );
  console.log(`      --safe-area-inset-top: "${v.top}"   resolved --safe-top: "${v.safe}"`);
  assert(v.safe.length > 0, 'the --safe-top variable did not resolve');
});

await check('a device-level tap on Play starts level 1', async () => {
  const size = /(\d+)x(\d+)/.exec(sh('shell', 'wm', 'size'));
  const deviceHeight = Number(size[2]);
  const r = await page.evaluate(
    `(() => { const b = document.querySelector('.btn--primary').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, dpr: devicePixelRatio, vh: innerHeight }; })()`,
  );
  // The WebView sits between the status bar and the gesture bar; centre it vertically to map CSS px to the screen.
  const offset = (deviceHeight - r.vh * r.dpr) / 2;
  sh('shell', 'input', 'tap', String(Math.round(r.x * r.dpr)), String(Math.round(r.y * r.dpr + offset)));
  await page.waitFor("document.querySelector('.hud')", 'the HUD after the tap');
});

await check('holding the screen at device level aims, and releasing launches (real touch)', async () => {
  await sleep(1200);
  sh('shell', 'input', 'swipe', '540', '1200', '540', '1200', '900');
  await sleep(600);
  const hud = await page.evaluate("document.querySelector('.hud')?.textContent ?? ''");
  assert(/Launches\s*[1-9]/.test(hud), `the HUD still says: ${hud}`);
  screenshotDevice('android-flight');
});

await check('Android back pauses the game and resumes it; Home pauses it too', async () => {
  const dialogText = "document.querySelector('[role=dialog]')?.textContent ?? ''";
  // The ship launched above may already have flown off the field (a loss is a finished run, so there is nothing to
  // pause). The R key restarts the level, which also checks that hardware-key shortcuts reach the app on Android.
  sh('shell', 'input', 'keyevent', 'KEYCODE_R');
  await page.waitFor("/Launches\\s*0/.test(document.querySelector('.hud')?.textContent ?? '') && !document.querySelector('[role=dialog]')", 'a fresh attempt (0 launches, no dialog)');
  await sleep(700);
  sh('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await page.waitFor(`/Paused/.test(${dialogText})`, 'the pause dialog after Back');
  sh('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await page.waitFor("!document.querySelector('[role=dialog]')", 'the dialog to close after a second Back');
  sh('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await sleep(1500);
  sh('shell', 'am', 'start', '-n', `${APP}/.MainActivity`);
  await page.waitFor(`/Paused/.test(${dialogText})`, 'the game to be paused after returning from Home');
  await sleep(2500); // let the window's resume animation finish, or the capture shows a stale frame
  screenshotDevice('android-paused');
});

await check('progress survives the app being killed and restarted', async () => {
  await page.evaluate(`(() => {
    const levels = {};
    for (let i = 1; i <= 4; i++) levels[i] = { stars: 3, bestTicks: 700, bestLaunches: 2, bestShards: 1 };
    localStorage.setItem('orbit-shift.progress', JSON.stringify({ version: 1, data: { levels, achievements: {}, stats: { restarts: 0, deaths: 0, launches: 8 }, lastLevel: 4, tutorialDone: true } }));
  })()`);
  // The running game keeps its own copy and saves it on events, so let a fresh page load pick the seed up first.
  await page.evaluate('location.reload()');
  await sleep(1500);
  await page.waitFor("document.querySelector('canvas') && !document.getElementById('splash')", 'the reloaded page');
  const reloaded = await page.evaluate(`(${buttonByText('/^Continue/')})?.textContent ?? ''`);
  assert(/Level 5/.test(reloaded), `after a reload the Continue button says: "${reloaded}"`);
  page.close();
  page = await launchAndAttach(); // force-stops the app first, so this is a cold start of a killed process
  const label = await page.evaluate(`(${buttonByText('/^Continue/')})?.textContent ?? ''`);
  assert(/Level 5/.test(label), `after killing the app the Continue button says: "${label}"`);
  screenshotDevice('android-continue');
});

await check('the game still starts and plays in airplane mode', async () => {
  sh('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  sh('shell', 'svc', 'wifi', 'disable');
  sh('shell', 'svc', 'data', 'disable');
  await sleep(1500);
  page.close();
  page = await launchAndAttach();
  await page.evaluate(`(${buttonByText('/^Continue/')}).click()`);
  await page.waitFor("document.querySelector('.hud')", 'the HUD in airplane mode');
  sh('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
  sh('shell', 'svc', 'wifi', 'enable');
  sh('shell', 'svc', 'data', 'enable');
});

await check('frame rate on this device, and no console errors from the app', async () => {
  await sleep(1000);
  const fps = await page.evaluate(`new Promise((resolve) => {
    let frames = 0; const start = performance.now();
    const tick = () => { frames += 1; if (performance.now() - start < 3000) requestAnimationFrame(tick); else resolve(Math.round(frames / (performance.now() - start) * 1000)); };
    requestAnimationFrame(tick);
  })`);
  const emulator = /emu|sdk|ranchu|goldfish/i.test(`${serial} ${sh('shell', 'getprop', 'ro.hardware')} ${sh('shell', 'getprop', 'ro.product.model')}`);
  console.log(`      measured ${fps} fps (${emulator ? 'an EMULATOR with software graphics: not representative of a phone' : 'a physical device'})`);
  const errors = consoleLog.filter((m) => /^(error|pageerror)/.test(m));
  assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
});

page.close();
writeFileSync(join(OUT, 'console.txt'), consoleLog.join('\n'));
sh('forward', '--remove', `tcp:${PORT}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed. Console lines captured: ${consoleLog.length} (tests/android/output/console.txt)`);
process.exit(failed ? 1 : 0);

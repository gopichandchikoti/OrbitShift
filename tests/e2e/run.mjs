/**
 * Real-browser end-to-end checks (core flows). Drives an installed Chromium browser with real mouse, touch and
 * keyboard input against a running Orbit Shift server.
 *
 *   npm run dev          # in one terminal (serves http://localhost:5610)
 *   npm run test:e2e     # in another
 *
 * The screens, accessibility, layout and persistence checks are in screens.mjs, and the all-levels sweep is in
 * levels.mjs. Shared plumbing is in harness.mjs.
 */
import { PHONE, assert, finish, openBrowser, runAxe, shot, snap, test, waitSnap } from './harness.mjs';
import { runScreenTests } from './screens.mjs';
import { runLevelSweep } from './levels.mjs';

const playButton = (page) => page.getByRole('button', { name: /^(Play|Continue)/ });
const centre = async (page) => {
  const box = await page.locator('canvas').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

await openBrowser();

await test('menu loads, renders one canvas and the scene animates', {}, async (page) => {
  await page.getByRole('heading', { name: /Orbit\s*Shift/ }).waitFor();
  await playButton(page).waitFor();
  assert((await page.locator('canvas').count()) === 1, 'expected exactly one canvas');
  const first = await page.screenshot();
  await page.waitForTimeout(900);
  const second = await page.screenshot();
  assert(first.length > 20000, 'first frame looks blank (screenshot is tiny)');
  assert(!first.equals(second), 'scene is static: the ambient planets and ship should be moving');
  await shot(page, '01-menu');
});

await test('menu passes automated WCAG 2.2 AA checks', {}, async (page) => {
  await playButton(page).waitFor();
  await runAxe(page, 'the menu');
});

await test('Play starts level 1 and the HUD shows level, launches and time', { context: PHONE }, async (page) => {
  await playButton(page).click();
  const hud = page.getByRole('region', { name: 'Level status' });
  await hud.waitFor();
  const text = await hud.innerText();
  assert(/L1/.test(text) && /\d:\d\d\.\d/.test(text), `HUD text was: ${text}`);
  // The short visible chips carry hidden labels for screen readers.
  const spoken = await hud.evaluate((el) => el.textContent);
  assert(/Launches\s+0\s*\/\s*3/.test(spoken) && /Time/.test(spoken), `HUD spoken text was: ${spoken}`);
  assert((await hud.boundingBox()).height > 0, 'HUD has no size');
  await page.getByRole('note').waitFor();
  await page.waitForTimeout(600);
  await shot(page, '02-level1-phone');
});

await test('hold to aim shows the projected path; releasing launches (mouse)', {}, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.tick > 20 && s.mode === 'orbit');
  const at = await centre(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  const aiming = await waitSnap(page, (s) => s.aiming && s.previewPoints > 2);
  assert(aiming.launches === 0, 'must not launch on press');
  await page.waitForTimeout(150);
  await page.mouse.up();
  const flying = await waitSnap(page, (s) => s.launches === 1);
  assert(['flight', 'orbit', 'dead'].includes(flying.mode), `unexpected mode ${flying.mode}`);
  assert(!flying.aiming, 'aiming should end on release');
}, { needsHook: true });

await test('Space aims and launches, without scrolling or clicking the focused button', {}, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.tick > 20);
  await page.keyboard.down('Space');
  await waitSnap(page, (s) => s.aiming);
  await page.keyboard.up('Space');
  const after = await waitSnap(page, (s) => s.launches === 1);
  assert(after.dialog === null, `Space opened a dialog (${after.dialog}): it clicked the focused button`);
  assert((await page.evaluate(() => window.scrollY)) === 0, 'page scrolled');
}, { needsHook: true });

await test('real touch: hold and release launches', { context: PHONE }, async (page, context) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.tick > 20);
  const at = await centre(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x: at.x, y: at.y }]);
  await waitSnap(page, (s) => s.aiming && s.previewPoints > 2);
  await touch('touchEnd', []);
  await waitSnap(page, (s) => s.launches === 1);
}, { needsHook: true });

await test('real mouse input can clear level 1 using the recorded release timing', {}, async (page) => {
  await playButton(page).click();
  const solution = await page.evaluate(() => window.__orbit.solution(1));
  const release = solution.launchTicks[0] - 3;
  const at = await centre(page);
  let won = false;
  for (let attempt = 0; attempt < 6 && !won; attempt++) {
    // A fresh start each attempt puts the clock back at zero, so the release tick means the same thing every time.
    await page.evaluate(() => window.__orbit.startLevel(1));
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await waitSnap(page, (s, tick) => s.tick >= tick, 20000, release);
    await page.mouse.up();
    const end = await waitSnap(page, (s) => s.won || s.death !== null || (s.mode === 'orbit' && s.launches > 0), 20000);
    won = end.won;
  }
  assert(won, 'could not clear level 1 with real mouse input in 6 attempts');
  await page.getByRole('dialog').waitFor();
  assert(/Level clear/.test(await page.getByRole('dialog').innerText()), 'win dialog missing');
  await shot(page, '03-level-clear');
}, { needsHook: true });

await test('pause freezes the simulation; P and Escape pause and resume', {}, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.tick > 30);
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await waitSnap(page, (s) => s.paused && s.dialog === 'pause');
  await page.waitForTimeout(500);
  assert((await snap(page)).tick === paused.tick, 'the simulation advanced while paused');
  await shot(page, '04-paused');
  await page.keyboard.press('p');
  const resumed = await waitSnap(page, (s) => !s.paused && s.dialog === null);
  await waitSnap(page, (s, from) => s.tick > from + 5, 15000, resumed.tick);
  await page.keyboard.press('Escape');
  await waitSnap(page, (s) => s.paused);
  await page.keyboard.press('Escape');
  await waitSnap(page, (s) => !s.paused);
}, { needsHook: true });

await test('a loss shows Retry already focused; Enter retries at once', {}, async (page) => {
  let died = false;
  for (const wait of [0, 40, 80, 120, 160, 200]) {
    if (died) break;
    await page.evaluate((k) => {
      window.__orbit.startLevel(1);
      window.__orbit.fastForward(k);
    }, wait);
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await page.evaluate(() => window.__orbit.fastForward(900));
    died = (await snap(page)).death !== null;
  }
  assert(died, 'could not make the ship die on level 1');
  await waitSnap(page, (s) => s.dialog === 'fail');
  const focused = await page.evaluate(() => document.activeElement?.textContent ?? '');
  assert(/Retry/.test(focused), `focus was on "${focused}", expected Retry`);
  await shot(page, '05-fail');
  await page.keyboard.press('Enter');
  const again = await waitSnap(page, (s) => s.dialog === null && s.tick < 120 && s.death === null);
  assert(again.launches === 0, 'retry did not reset the attempt');
}, { needsHook: true });

await test('R restarts a level that is in progress', {}, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.tick > 60);
  await page.keyboard.press('r');
  const restarted = await waitSnap(page, (s) => s.tick < 40);
  assert(restarted.launches === 0, 'launch count was not reset');
}, { needsHook: true });

await test('clearing a level saves progress and unlocks the next; it survives a reload', {}, async (page) => {
  await playButton(page).click();
  await page.evaluate(() => {
    window.__orbit.autopilot(true);
    window.__orbit.fastForward(4000);
  });
  await waitSnap(page, (s) => s.dialog === 'win', 8000);
  const dialog = page.getByRole('dialog');
  assert(/Level clear/.test(await dialog.innerText()), 'win dialog text');
  await runAxe(page, 'the level-clear dialog');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('orbit-shift.progress') ?? '{}'));
  assert(saved.data?.levels?.['1']?.stars >= 1, `progress not saved: ${JSON.stringify(saved)}`);
  await dialog.getByRole('button', { name: 'Next level' }).click();
  await waitSnap(page, (s) => s.levelId === 2);
  await page.reload();
  await page.locator('#splash').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /^Continue · Level 2/ }).waitFor();
}, { needsHook: true });

await runScreenTests();
await runLevelSweep();
await finish();

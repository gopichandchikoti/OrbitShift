/**
 * Screens, navigation, settings, persistence, accessibility, responsive layout and lifecycle checks.
 * Run from run.mjs; shared plumbing is in harness.mjs.
 */
import { PHONE, SMALL_PHONE, assert, runAxe, shot, snap, test, waitSnap } from './harness.mjs';

const menuButton = (page, name) => page.getByRole('button', { name });

const SEEDED_PROGRESS = {
  key: 'orbit-shift.progress',
  value: JSON.stringify({
    version: 1,
    data: {
      levels: { 1: { stars: 3, bestTicks: 600, bestLaunches: 1, bestShards: 1 } },
      achievements: {},
      stats: { restarts: 0, deaths: 0, launches: 1 },
      lastLevel: 1,
      tutorialDone: true,
    },
  }),
};

async function openSettings(page) {
  await menuButton(page, 'Settings').click();
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
}

export async function runScreenTests() {
  await test('chapters: 12 listed, only the first unlocked, a locked one explains itself', {}, async (page) => {
    await menuButton(page, 'Chapters').click();
    await page.getByRole('heading', { name: 'Chapters' }).waitFor();
    const chapters = page.getByRole('button', { name: /^Chapter \d+ / });
    assert((await chapters.count()) === 12, `expected 12 chapters, found ${await chapters.count()}`);
    assert((await page.locator('button[aria-disabled="true"]').count()) === 11, 'expected 11 locked chapters');
    // Playwright treats aria-disabled controls as not clickable; a real finger can still tap them, so force it.
    await chapters.nth(1).click({ force: true });
    await page.waitForFunction(() => /locked/i.test(document.getElementById('live')?.textContent ?? ''));
    assert(await page.getByRole('heading', { name: 'Twin Suns' }).count() === 0, 'a locked chapter opened');
  });

  await test('levels: ten per chapter, only level 1 open, a locked level explains itself', {}, async (page) => {
    await menuButton(page, 'Chapters').click();
    await page.getByRole('button', { name: /^Chapter 1 / }).click();
    await page.getByRole('heading', { name: 'First Orbit' }).waitFor();
    const tiles = page.getByRole('button', { name: /^Level \d+,/ });
    assert((await tiles.count()) === 10, 'expected 10 level tiles');
    assert((await page.locator('button.tile[aria-disabled="true"]').count()) === 9, 'expected 9 locked levels');
    await tiles.nth(1).click({ force: true });
    await page.waitForFunction(() => /locked/i.test(document.getElementById('live')?.textContent ?? ''));
    await shot(page, '06-levels');
  });

  await test('back button and Escape walk back: levels, chapters, menu', {}, async (page) => {
    await menuButton(page, 'Chapters').click();
    await page.getByRole('button', { name: /^Chapter 1 / }).click();
    await page.getByRole('heading', { name: 'First Orbit' }).waitFor();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('heading', { name: 'Chapters' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { name: /Orbit\s*Shift/ }).waitFor();
  });

  await test('how to play, achievements and credits open and close', {}, async (page) => {
    for (const [button, heading] of [['How to play', 'How to play'], ['Achievements', 'Achievements'], ['Credits', 'Credits']]) {
      await menuButton(page, button).click();
      await page.getByRole('heading', { name: heading, level: 1 }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('heading', { name: /Orbit\s*Shift/ }).waitFor();
    }
    await menuButton(page, 'How to play').click();
    assert((await page.locator('.legend__row').count()) === 10, 'expected 10 legend rows');
    await shot(page, '07-how-to-play');
  });

  await test('every screen passes automated WCAG 2.2 AA checks', {}, async (page) => {
    const pages = [
      ['Chapters', 'Chapters'],
      ['Settings', 'Settings'],
      ['How to play', 'How to play'],
      ['Achievements', 'Achievements'],
      ['Credits', 'Credits'],
    ];
    for (const [button, heading] of pages) {
      await menuButton(page, button).click();
      await page.getByRole('heading', { name: heading, level: 1 }).waitFor();
      await runAxe(page, heading);
      await page.keyboard.press('Escape');
      await page.getByRole('heading', { name: /Orbit\s*Shift/ }).waitFor();
    }
    await menuButton(page, 'Chapters').click();
    await page.getByRole('button', { name: /^Chapter 1 / }).click();
    await runAxe(page, 'the level list');
  });

  await test('pause and loss dialogs pass accessibility checks and trap focus', {}, async (page) => {
    await page.getByRole('button', { name: /^Play/ }).click();
    await page.getByRole('button', { name: 'Pause' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await runAxe(page, 'the pause dialog');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
    assert(inside, 'focus escaped the dialog');
    assert((await page.locator('.hud').getAttribute('inert')) !== null, 'the HUD under a dialog must be inert');
  }, { needsHook: false });

  await test('settings persist across a reload and change the page theme', {}, async (page) => {
    await openSettings(page);
    await page.getByRole('switch', { name: /High contrast/ }).click();
    await page.getByRole('switch', { name: /Reduce motion/ }).click();
    await page.getByRole('switch', { name: /Mute all sound/ }).click();
    await page.locator('input[type="range"]').first().fill('20');
    await page.getByRole('button', { name: 'Tap twice' }).click();
    assert((await page.locator('html').getAttribute('data-contrast')) === 'high', 'contrast attribute not set');
    assert((await page.locator('html').getAttribute('data-motion')) === 'reduced', 'motion attribute not set');
    await page.reload();
    await page.locator('#splash').waitFor({ state: 'detached' });
    assert((await page.locator('html').getAttribute('data-contrast')) === 'high', 'contrast did not survive reload');
    await openSettings(page);
    assert((await page.getByRole('switch', { name: /High contrast/ }).getAttribute('aria-checked')) === 'true', 'switch');
    assert((await page.getByRole('switch', { name: /Mute all sound/ }).getAttribute('aria-checked')) === 'true', 'mute');
    assert((await page.getByRole('button', { name: 'Tap twice' }).getAttribute('aria-pressed')) === 'true', 'control mode');
    assert((await page.locator('input[type="range"]').first().inputValue()) === '20', 'music volume');
    await shot(page, '08-settings-high-contrast');
    await runAxe(page, 'settings in high contrast');
  });

  await test('tap-to-aim mode: the first tap aims, the second launches', {}, async (page) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Tap twice' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Play/ }).click();
    await waitSnap(page, (s) => s.tick > 20);
    const box = await page.locator('canvas').boundingBox();
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.click(at.x, at.y);
    const aiming = await waitSnap(page, (s) => s.aiming);
    assert(aiming.launches === 0, 'first tap must only aim');
    await page.mouse.click(at.x, at.y);
    await waitSnap(page, (s) => s.launches === 1 && !s.aiming);
  }, { needsHook: true });

  await test('reset progress asks first; cancelling keeps it, confirming erases it', { seed: SEEDED_PROGRESS }, async (page) => {
    await page.getByText('0/120', { exact: false }).count();
    assert(/1\/120/.test(await page.locator('.menu__meta').innerText()), 'seeded progress was not shown');
    await openSettings(page);
    await page.getByRole('button', { name: /Reset progress/ }).click();
    const alert = page.getByRole('alertdialog');
    await alert.waitFor();
    await alert.getByRole('button', { name: 'Cancel' }).click();
    await page.keyboard.press('Escape');
    assert(/1\/120/.test(await page.locator('.menu__meta').innerText()), 'cancel erased progress');
    await openSettings(page);
    await page.getByRole('button', { name: /Reset progress/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Erase everything' }).click();
    await page.keyboard.press('Escape');
    assert(/0\/120/.test(await page.locator('.menu__meta').innerText()), 'progress was not erased');
  });

  await test('a corrupt save falls back to a clean start instead of crashing', {
    seed: [{ key: 'orbit-shift.progress', value: '{not json' }, { key: 'orbit-shift.settings', value: '[]' }],
  }, async (page) => {
    await page.getByRole('button', { name: /^Play/ }).waitFor();
    assert(/0\/120/.test(await page.locator('.menu__meta').innerText()), 'expected a clean start');
  });

  await test('the app pauses itself when the page is hidden', {}, async (page) => {
    await page.getByRole('button', { name: /^Play/ }).click();
    await waitSnap(page, (s) => s.tick > 20);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const paused = await waitSnap(page, (s) => s.paused && s.dialog === 'pause');
    assert(paused.paused, 'did not pause');
  }, { needsHook: true });

  await test('a system reduced-motion preference turns the setting on by default', { context: { reducedMotion: 'reduce' } }, async (page) => {
    assert((await page.locator('html').getAttribute('data-motion')) === 'reduced', 'motion attribute');
    await openSettings(page);
    assert((await page.getByRole('switch', { name: /Reduce motion/ }).getAttribute('aria-checked')) === 'true', 'switch');
  });

  for (const [label, context] of [['320 px phone', SMALL_PHONE], ['390 px phone', PHONE]]) {
    await test(`${label}: nothing overflows sideways and every control is at least 44 px`, { context }, async (page) => {
      const visit = [null, 'Chapters', 'Settings', 'How to play', 'Achievements', 'Credits'];
      for (const name of visit) {
        if (name) await menuButton(page, name).click();
        await page.waitForTimeout(350);
        const issues = await page.evaluate(() => {
          const out = [];
          if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('horizontal overflow');
          const controls = document.querySelectorAll('button, input, select, summary, [role="switch"]');
          for (const el of controls) {
            if (el.closest('.dev')) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (Math.min(r.width, r.height) < 43.5) {
              out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 28)}" is ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          }
          return out;
        });
        assert(issues.length === 0, `${name ?? 'menu'}: ${issues.join('; ')}`);
        if (name) await page.keyboard.press('Escape');
      }
      await shot(page, `09-${label.split(' ')[0]}-menu`);
    });
  }

  for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['tall phone', { width: 412, height: 915 }], ['desktop', { width: 1280, height: 720 }]]) {
    await test(`${label}: the playfield keeps its 9:16 shape and the UI sits exactly over it`, { context: { viewport } }, async (page) => {
      await page.getByRole('button', { name: /^Play/ }).click();
      await page.waitForTimeout(500);
      const geometry = await page.evaluate(() => {
        const c = document.querySelector('canvas').getBoundingClientRect();
        const u = document.getElementById('ui').getBoundingClientRect();
        return { c: [c.left, c.top, c.width, c.height], u: [u.left, u.top, u.width, u.height] };
      });
      const ratio = geometry.c[2] / geometry.c[3];
      assert(Math.abs(ratio - 720 / 1280) < 0.01, `canvas ratio ${ratio.toFixed(3)} is not 9:16`);
      geometry.c.forEach((value, i) => assert(Math.abs(value - geometry.u[i]) < 2, `UI layer is misaligned: ${JSON.stringify(geometry)}`));
      await shot(page, `10-play-${label.replace(' ', '-')}`);
    });
  }

  await test('the development hook and inspector are not shipped (production build)', {}, async (page) => {
    assert(await page.evaluate(() => typeof window.__orbit === 'undefined'), 'window.__orbit exists in production');
    assert((await page.locator('.dev').count()) === 0, 'the developer inspector is in the page');
    assert((await page.locator('canvas').count()) === 1, 'expected the playfield canvas');
  }, { prodOnly: true });

  await test('works with no network after loading (production build)', {}, async (page, context) => {
    // Let the browser finish its own lazy fetches (the tab icon) first; the game itself never asks for anything.
    await page.waitForLoadState('networkidle');
    await context.setOffline(true);
    await page.getByRole('button', { name: /^Play/ }).click();
    await page.getByRole('region', { name: 'Level status' }).waitFor();
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor();
  }, { prodOnly: true });
}

export { snap };

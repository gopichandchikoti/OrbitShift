/**
 * Level sweeps in the live game (dev server only).
 *
 *  1. The first level of every chapter renders a non-blank frame without console errors.
 *  2. Every one of the 120 recorded solutions, replayed through the running app, wins with three stars.
 *
 * This replays recorded routes; it is an automated check, not a person playing the levels.
 */
import { assert, shot, snap, test } from './harness.mjs';

export async function runLevelSweep() {
  await test('the first level of every chapter renders and runs', {}, async (page) => {
    for (let chapter = 1; chapter <= 12; chapter++) {
      const id = (chapter - 1) * 10 + 1;
      await page.evaluate((levelId) => window.__orbit.startLevel(levelId), id);
      await page.waitForFunction((levelId) => {
        const s = window.__orbit.snapshot();
        return s.levelId === levelId && s.tick > 30;
      }, id);
      const frame = await page.screenshot();
      assert(frame.length > 20000, `chapter ${chapter}: the frame looks blank`);
      if (chapter === 1 || chapter === 4 || chapter === 8 || chapter === 9 || chapter === 12) await shot(page, `11-chapter-${chapter}`);
    }
  }, { needsHook: true });

  await test('the recorded solution wins all 120 levels in the running game, with three stars', {}, async (page) => {
    const failures = [];
    for (let id = 1; id <= 120; id++) {
      const result = await page.evaluate((levelId) => {
        const orbit = window.__orbit;
        orbit.startLevel(levelId);
        orbit.autopilot(true);
        const { totalTicks } = orbit.solution(levelId);
        orbit.fastForward(totalTicks + 20);
        const s = orbit.snapshot();
        return { won: s.won, stars: s.stars, tick: s.tick, launches: s.launches, death: s.death };
      }, id);
      if (!result.won || result.stars !== 3) failures.push(`level ${id}: ${JSON.stringify(result)}`);
    }
    assert(failures.length === 0, `${failures.length} level(s) did not replay to three stars:\n  ${failures.slice(0, 10).join('\n  ')}`);
    assert((await snap(page)).won, 'the last level should be won');
  }, { needsHook: true });
}

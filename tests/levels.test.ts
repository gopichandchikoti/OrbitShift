import { describe, expect, it } from 'vitest';
import { auditLevels, familiesOf, summarise } from '../src/game/levels/audit';
import { ATTRACT_LEVEL } from '../src/game/levels/attract';
import { LEVELS, levelById, levelsOfChapter } from '../src/game/levels/catalog';
import { CHAPTERS, LEVEL_COUNT, chapterOf, levelId } from '../src/game/levels/chapters';
import { layoutCells, layoutSignature, layoutSimilarity, mechanicFingerprint } from '../src/game/levels/fingerprint';
import { levelSchema } from '../src/game/levels/schema';
import { validateLevel } from '../src/game/levels/validate';
import { verifySolution } from '../src/game/levels/verify';
import type { Level } from '../src/game/levels/types';
import { PlaySession } from '../src/game/session';

const schemaProblems = (level: Level): string[] => {
  const result = levelSchema.safeParse(level);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const clone = (level: Level): Level => structuredClone(level);
const first = LEVELS[0] as Level;

describe('the shipped catalogue', () => {
  it('has 120 levels in 12 chapters of 10, in order', () => {
    expect(LEVELS).toHaveLength(LEVEL_COUNT);
    expect(CHAPTERS).toHaveLength(12);
    LEVELS.forEach((level, i) => {
      expect(level.id).toBe(i + 1);
      expect(level.chapter).toBe(chapterOf(level.id));
      expect(level.id).toBe(levelId(level.chapter, level.index));
    });
    for (const chapter of CHAPTERS) expect(levelsOfChapter(chapter.id)).toHaveLength(10);
  });

  it('passes the full audit: schema, geometry, replay, distinctness, themes and families', () => {
    expect(auditLevels(LEVELS, schemaProblems)).toEqual([]);
  });

  it('replays every recorded solution to a three-star win', () => {
    for (const level of LEVELS) {
      const check = verifySolution(level);
      expect(check.problems, `level ${level.id}`).toEqual([]);
      expect(check.stars).toBe(3);
    }
  });

  it('introduces each mechanic family in its own chapter', () => {
    const wanted: [number, string][] = [
      [3, 'satellite'], [4, 'laser'], [5, 'moving-planet'], [6, 'inversion'], [7, 'pulse'], [8, 'wormhole'], [9, 'gate'],
    ];
    for (const [chapter, family] of wanted) {
      for (const level of levelsOfChapter(chapter)) expect(familiesOf(level).has(family as never), `level ${level.id}`).toBe(true);
    }
  });

  it('asks for shards only where they exist, and from chapter 9 on', () => {
    for (const level of LEVELS) {
      const shards = level.collectibles.filter((c) => c.kind === 'shard').length;
      expect(level.goal.requiredShards).toBeLessThanOrEqual(shards);
      if (level.chapter === 9) expect(level.goal.requiredShards).toBeGreaterThan(0);
    }
  });

  it('gets harder: more hazards and tighter timing in the last chapters than the first', () => {
    const rows = summarise(LEVELS);
    const firstRow = rows[0];
    const lastRow = rows[11];
    expect(lastRow?.meanHazards ?? 0).toBeGreaterThan((firstRow?.meanHazards ?? 99) + 2);
    expect(lastRow?.meanWindowMs ?? 999).toBeLessThan((firstRow?.meanWindowMs ?? 0) * 0.7);
  });

  it('gives every launch a timing window of at least five ticks (83 ms)', () => {
    for (const level of LEVELS) expect(level.solution.minWindow, `level ${level.id}`).toBeGreaterThanOrEqual(5);
  });

  it('looks levels up by id', () => {
    expect(levelById(1)?.name).toBe(first.name);
    expect(levelById(120)?.id).toBe(120);
    expect(levelById(0)).toBeUndefined();
    expect(levelById(121)).toBeUndefined();
  });
});

describe('the validator and audit catch bad levels', () => {
  it('rejects a level that breaks the runtime schema', () => {
    const bad = clone(first);
    bad.planets[0] = { ...(bad.planets[0] as Level['planets'][number]), radius: -4 };
    expect(schemaProblems(bad).length).toBeGreaterThan(0);
    expect(schemaProblems({ ...bad, extra: 1 } as unknown as Level).length).toBeGreaterThan(0);
  });

  it('finds structural problems', () => {
    const cases: [string, (level: Level) => void, RegExp][] = [
      ['wrong id', (l) => { l.id = 999; }, /id 999/],
      ['wrong bounds', (l) => { l.bounds = { w: 100, h: 100 }; }, /bounds/],
      ['blank name', (l) => { l.name = ' '; }, /name is empty/],
      ['missing start planet', (l) => { l.start.planet = 'zz'; }, /does not exist/],
      ['planet off screen', (l) => { (l.planets[0] as Level['planets'][number]).x = -50; }, /leaves the playfield/],
      ['duplicate planet', (l) => { l.planets.push({ ...(l.planets[0] as Level['planets'][number]) }); }, /duplicate planet|overlaps/],
      ['goal on the start', (l) => { l.goal.x = l.planets[0]?.x ?? 0; l.goal.y = (l.planets[0]?.y ?? 0) - 40; }, /too close|overlaps/],
      ['asteroid on a planet', (l) => { const p = l.planets[0] as Level['planets'][number]; l.hazards.push({ type: 'asteroid', id: 'zz1', x: p.x + 70, y: p.y, radius: 20, seed: 1 }); }, /blocks planet/],
      ['asteroid on the portal', (l) => { l.hazards.push({ type: 'asteroid', id: 'zz2', x: l.goal.x, y: l.goal.y, radius: 20, seed: 1 }); }, /portal/],
      ['unknown satellite host', (l) => { l.hazards.push({ type: 'satellite', id: 'zz3', around: 'nope', cx: 0, cy: 0, orbit: 90, omega: 1, phase: 0, radius: 10 }); }, /unknown planet/],
      ['laser with no warning', (l) => { l.hazards.push({ type: 'laser', id: 'zz4', cx: 300, cy: 600, innerR: 80, outerR: 70, width: 4, omega: 1, phase: 0, period: 100, warn: 5, on: 5 }); }, /warning|innerR|width/],
      ['wormhole mouths together', (l) => { l.hazards.push({ type: 'wormhole', id: 'zz5', a: { x: 300, y: 600 }, b: { x: 310, y: 600 }, radius: 26, rotate: 0, speedScale: 1 }); }, /too close/],
      ['gate with no opener', (l) => { l.hazards.push({ type: 'gate', id: 'zz6', a: { x: 100, y: 600 }, b: { x: 200, y: 600 }, opensWith: ['ghost'] }); }, /unknown collectible/],
      ['duplicate hazard ids', (l) => { l.hazards.push({ type: 'inversion', id: 'zz7', x: 300, y: 600, radius: 60 }, { type: 'inversion', id: 'zz7', x: 300, y: 700, radius: 60 }); }, /duplicate hazard/],
      ['collectible in a planet', (l) => { const p = l.planets[0] as Level['planets'][number]; l.collectibles.push({ id: 'zz8', kind: 'shard', x: p.x, y: p.y }); }, /inside a planet/],
      ['goal needs more shards', (l) => { l.goal.requiredShards = 9; }, /more shards/],
      ['par below the solution', (l) => { l.par.launches = 0; }, /par launches/],
      ['unordered launch ticks', (l) => { l.solution.launchTicks = [50, 20]; }, /increasing/],
      ['blank hint', (l) => { l.tutorialHint = ' '; }, /tutorialHint/],
    ];
    for (const [label, mutate, expected] of cases) {
      const level = clone(first);
      mutate(level);
      const problems = validateLevel(level).join(' | ');
      expect(problems, label).toMatch(expected);
    }
  });

  it('flags a recorded route that no longer wins or no longer earns three stars', () => {
    const broken = clone(first);
    broken.solution.launchTicks = broken.solution.launchTicks.map((tick) => tick + 90);
    expect(verifySolution(broken).ok).toBe(false);
    const slow = clone(first);
    slow.par = { launches: slow.par.launches, seconds: 0.1 };
    expect(verifySolution(slow).problems.join(' ')).toMatch(/stars/);
    const drifted = clone(first);
    drifted.solution.totalTicks += 7;
    expect(verifySolution(drifted).problems.join(' ')).toMatch(/ticks/);
  });

  it('flags missing, duplicate and out-of-order levels', () => {
    expect(auditLevels(LEVELS.slice(0, 5)).join(' ')).toMatch(/Expected 120 levels/);
    const twin = clone(first);
    const problems = auditLevels([first, { ...twin, id: 2 }]).join(' | ');
    expect(problems).toMatch(/duplicate name|identical layout|too alike/);
    expect(auditLevels([first, first]).join(' | ')).toMatch(/out of order/);
  });
});

describe('fingerprints', () => {
  const second = LEVELS[1] as Level;

  it('treats a level as identical to itself and different from another', () => {
    expect(layoutSimilarity(first, first)).toBe(1);
    expect(layoutSimilarity(first, second)).toBeLessThan(0.55);
    expect(layoutSignature(first)).not.toBe(layoutSignature(second));
    // Level 1 is deliberately minimal: one planet, the portal and one shard.
    expect(layoutCells(first).size).toBeGreaterThanOrEqual(3);
  });

  it('describes mechanics as counts', () => {
    expect(mechanicFingerprint(first)).toMatch(/^P\d+\|mov\d+\|ast\d+/);
    const hazardous = LEVELS.find((level) => level.hazards.some((h) => h.type === 'gate')) as Level;
    expect(mechanicFingerprint(hazardous)).toMatch(/gat[1-9]/);
  });
});

describe('the menu backdrop', () => {
  it('is a runnable scene that keeps the ship circling', () => {
    const session = new PlaySession(ATTRACT_LEVEL);
    for (let i = 0; i < 600; i++) session.update(1000 / 60);
    expect(session.state.ship.mode).toBe('orbit');
    expect(session.state.tick).toBeGreaterThan(500);
  });
});

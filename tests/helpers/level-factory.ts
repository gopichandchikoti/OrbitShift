import type { Hazard, Level, Planet } from '../../src/game/levels/types';
import { buildRuntime, type LevelRuntime } from '../../src/game/simulation/runtime';
import { createInitialState } from '../../src/game/simulation/state';

export function planet(id: string, x: number, y: number, extra: Partial<Planet> = {}): Planet {
  return { id, x, y, radius: 40, gravity: 700, influence: 190, orbitSpeed: 150, style: 0, ...extra };
}

export function makeLevel(extra: Partial<Level> = {}): Level {
  return {
    schema: 1,
    id: 1,
    chapter: 1,
    index: 1,
    name: 'Test',
    seed: 1,
    bounds: { w: 720, h: 1280 },
    start: { planet: 'a', angle: -Math.PI / 2, dir: 1 },
    goal: { x: 360, y: 140, radius: 36, requiredShards: 0 },
    planets: [planet('a', 360, 1050)],
    hazards: [],
    collectibles: [],
    par: { launches: 3, seconds: 30 },
    tutorialHint: null,
    solution: { launchTicks: [], totalTicks: 0, shards: 0, minWindow: 0, solver: 'test' },
    ...extra,
  };
}

/** Three planets in a rising zig-zag with the portal above: the smallest level that needs a hop. */
export function chainLevel(hazards: Hazard[] = []): Level {
  return makeLevel({
    planets: [planet('a', 360, 1050), planet('b', 220, 760, { radius: 38 }), planet('c', 500, 460, { radius: 38 })],
    hazards,
  });
}

export function runtimeOf(level: Level = makeLevel()): LevelRuntime {
  return buildRuntime(level);
}

/** A runtime plus a ship already in free flight at the given position and velocity. */
export function flightAt(level: Level, x: number, y: number, [vx, vy]: [number, number]) {
  const rt = runtimeOf(level);
  const state = createInitialState(rt);
  Object.assign(state.ship, { mode: 'flight', planetId: null, x, y, vx, vy, flightTicks: 0 });
  return { rt, state };
}

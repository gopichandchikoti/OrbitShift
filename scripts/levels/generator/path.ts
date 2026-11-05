import type { Level } from '../../../src/game/levels/types';
import { buildRuntime } from '../../../src/game/simulation/runtime';
import { createInitialState, isFinished } from '../../../src/game/simulation/state';
import { stepSim } from '../../../src/game/simulation/step';

/** A point on a recorded route, with the direction of travel. `hop` counts launches (0 = the first flight). */
export interface PathSample {
  x: number;
  y: number;
  tick: number;
  hop: number;
  tx: number;
  ty: number;
}

const STRIDE = 3;

/** Replays a launch list and records the ship's position every few ticks while it is in free flight. */
export function samplePath(level: Level, launchTicks: readonly number[]): PathSample[] {
  const rt = buildRuntime(level);
  const state = createInitialState(rt);
  const samples: PathSample[] = [];
  let next = 0;
  while (!isFinished(state) && state.tick < 20000) {
    const release = launchTicks[next] === state.tick + 1;
    if (release) next += 1;
    stepSim(rt, state, release);
    const { ship } = state;
    if (ship.mode !== 'flight' || state.tick % STRIDE !== 0) continue;
    const speed = Math.hypot(ship.vx, ship.vy) || 1;
    samples.push({ x: ship.x, y: ship.y, tick: state.tick, hop: next - 1, tx: ship.vx / speed, ty: ship.vy / speed });
  }
  return samples;
}

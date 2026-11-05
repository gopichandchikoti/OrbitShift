import { describe, expect, it } from 'vitest';
import { flyUntilDone, outcomeOf, predictLaunch, replayLaunches } from '../src/game/simulation/flight';
import { cloneState, createInitialState } from '../src/game/simulation/state';
import { stepSim } from '../src/game/simulation/step';
import { DEFAULT_SOLVER, expandNode, solveLevel } from '../src/game/tools/solver';
import type { Vec } from '../src/game/levels/types';
import { chainLevel, makeLevel, planet, runtimeOf } from './helpers/level-factory';

function actualPath(level = chainLevel(), wait = 37): { points: Vec[]; outcome: ReturnType<typeof outcomeOf> } {
  const rt = runtimeOf(level);
  const state = createInitialState(rt);
  for (let i = 0; i < wait; i++) stepSim(rt, state, false);
  const points: Vec[] = [{ x: state.ship.x, y: state.ship.y }];
  stepSim(rt, state, true);
  points.push({ x: state.ship.x, y: state.ship.y });
  while (state.ship.mode === 'flight' && points.length < 400) {
    stepSim(rt, state, false);
    points.push({ x: state.ship.x, y: state.ship.y });
  }
  return { points, outcome: outcomeOf(state) };
}

function predicted(level = chainLevel(), wait = 37) {
  const rt = runtimeOf(level);
  const state = createInitialState(rt);
  for (let i = 0; i < wait; i++) stepSim(rt, state, false);
  return predictLaunch(rt, state, 400, 1);
}

describe('trajectory preview', () => {
  it('matches the real flight point for point when released on the next step', () => {
    const real = actualPath();
    const preview = predicted();
    expect(preview.points.length).toBe(real.points.length + 1);
    real.points.forEach((point, i) => {
      expect(preview.points[i]?.x).toBeCloseTo(point.x, 9);
      expect(preview.points[i]?.y).toBeCloseTo(point.y, 9);
    });
    expect(preview.outcome).toEqual(real.outcome);
  });

  it('also matches when planets and hazards move', () => {
    const moving = chainLevel([
      { type: 'satellite', id: 's', around: 'b', cx: 0, cy: 0, orbit: 90, omega: 1.2, phase: 0, radius: 10 },
    ]);
    moving.planets[1] = planet('b', 220, 760, {
      radius: 38,
      motion: { kind: 'orbit', cx: 220, cy: 760, radius: 40, omega: 0.6, phase: 0 },
    });
    for (const wait of [0, 55, 140]) {
      const real = actualPath(moving, wait);
      const preview = predicted(moving, wait);
      expect(preview.outcome).toEqual(real.outcome);
      real.points.forEach((point, i) => {
        expect(preview.points[i]?.x).toBeCloseTo(point.x, 9);
        expect(preview.points[i]?.y).toBeCloseTo(point.y, 9);
      });
    }
  });

  it('does not change the live state it was asked about', () => {
    const rt = runtimeOf(chainLevel());
    const state = createInitialState(rt);
    const before = JSON.stringify(state);
    predictLaunch(rt, state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reports a flight that is still open when the horizon ends', () => {
    const rt = runtimeOf(chainLevel());
    const state = createInitialState(rt);
    expect(predictLaunch(rt, state, 3).outcome).toEqual({ kind: 'open' });
  });

  it('samples every few ticks by default', () => {
    const rt = runtimeOf(chainLevel());
    const state = createInitialState(rt);
    const dense = predictLaunch(rt, state, 60, 1).points.length;
    const sparse = predictLaunch(rt, state, 60, 3).points.length;
    expect(sparse).toBeLessThan(dense);
  });
});

describe('flyUntilDone', () => {
  it('stops at the horizon without a sample array', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    stepSim(rt, state, true);
    expect(flyUntilDone(rt, cloneState(state), 5)).toBe(5);
  });
});

describe('solver', () => {
  it('finds a route that replays to a win with a comfortable timing window', () => {
    const level = chainLevel();
    const { solution, nodes } = solveLevel(level);
    expect(nodes).toBeGreaterThan(0);
    expect(solution).not.toBeNull();
    expect(solution?.minWindow).toBeGreaterThanOrEqual(DEFAULT_SOLVER.minWindow);
    const replay = replayLaunches(runtimeOf(level), solution?.launchTicks ?? []);
    expect(replay.won).toBe(true);
    expect(replay.state.tick).toBe(solution?.totalTicks);
    expect(replay.state.launches).toBe(solution?.launchTicks.length);
  });

  it('routes around an obstacle and still replays to a win', () => {
    const rock = { type: 'asteroid' as const, id: 'r', x: 290, y: 900, radius: 26, seed: 3 };
    const level = chainLevel([rock]);
    const { solution } = solveLevel(level);
    expect(solution).not.toBeNull();
    expect(replayLaunches(runtimeOf(level), solution?.launchTicks ?? []).won).toBe(true);
  });

  it('reports no solution when the portal cannot be reached', () => {
    const level = makeLevel();
    expect(solveLevel(level, { ...DEFAULT_SOLVER, maxNodes: 20 }).solution).toBeNull();
  });

  it('stops at the node budget', () => {
    const result = solveLevel(chainLevel(), { ...DEFAULT_SOLVER, maxNodes: 1 });
    expect(result.nodes).toBeLessThanOrEqual(2);
  });

  it('gives up on routes whose timing window is narrower than asked for', () => {
    const rt = runtimeOf(chainLevel());
    const node = { state: createInitialState(rt), trace: [], window: Infinity };
    const wide = expandNode(rt, node, 5);
    expect(wide.length).toBeGreaterThan(0);
    expect(expandNode(rt, node, 10_000)).toEqual([]);
  });

  it('fails a replay whose release ticks are wrong', () => {
    const level = chainLevel();
    const { solution } = solveLevel(level);
    const shifted = (solution?.launchTicks ?? []).map((tick) => tick + 90);
    expect(replayLaunches(runtimeOf(level), shifted).won).toBe(false);
  });
});

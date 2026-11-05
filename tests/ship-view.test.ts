import { describe, expect, it } from 'vitest';
import { DT } from '../src/game/simulation/constants';
import { orbitRadiusOf } from '../src/game/simulation/runtime';
import { viewShip } from '../src/game/simulation/ship-view';
import { createInitialState } from '../src/game/simulation/state';
import { stepSim } from '../src/game/simulation/step';
import { makeLevel, planet, runtimeOf } from './helpers/level-factory';

describe('viewShip', () => {
  it('advances an orbiting ship analytically between steps and points along the orbit', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    const rest = viewShip(rt, state, 0);
    const half = viewShip(rt, state, 0.5);
    expect(rest.mode).toBe('orbit');
    expect(half.heading).toBeGreaterThan(rest.heading);
    const lane = orbitRadiusOf(rt.planets[0] as never);
    expect(Math.hypot(half.x - 360, half.y - 1050)).toBeCloseTo(lane, 6);
  });

  it('follows a moving host planet', () => {
    const moving = planet('a', 360, 1050, { motion: { kind: 'orbit', cx: 360, cy: 900, radius: 100, omega: 1, phase: 1 } });
    const rt = runtimeOf(makeLevel({ planets: [moving] }));
    const state = createInitialState(rt);
    const view = viewShip(rt, state, 0.25);
    const centre = { x: 360 + Math.cos(1 + DT * 0.25) * 100, y: 900 + Math.sin(1 + DT * 0.25) * 100 };
    // The ship sits on the host's lane, which moves with the planet.
    expect(Math.hypot(view.x - centre.x, view.y - centre.y)).toBeCloseTo(orbitRadiusOf(moving), 0);
  });

  it('extrapolates a flying ship by its velocity and faces its heading', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    stepSim(rt, state, true);
    const view = viewShip(rt, state, 1);
    expect(view.mode).toBe('flight');
    expect(view.x).toBeCloseTo(state.ship.x + state.ship.vx * DT, 9);
    expect(view.heading).toBeCloseTo(Math.atan2(state.ship.vy, state.ship.vx), 9);
  });

  it('keeps a stationary flight pointing along its default heading', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    Object.assign(state.ship, { mode: 'flight', planetId: null, vx: 0, vy: 0 });
    expect(viewShip(rt, state, 0.5).heading).toBe(0);
  });

  it('reports a finished ship as gone, and tolerates an orbit with no host', () => {
    const rt = runtimeOf();
    const dead = createInitialState(rt);
    dead.ship.mode = 'dead';
    expect(viewShip(rt, dead, 0).mode).toBe('gone');
    const lost = createInitialState(rt);
    lost.ship.planetId = null;
    expect(viewShip(rt, lost, 0).mode).toBe('orbit');
  });
});

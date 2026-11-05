import { describe, expect, it } from 'vitest';
import {
  CAPTURE_SPEED_MAX,
  DT,
  FLIGHT_TIMEOUT_TICKS,
  LAUNCH_SPEED,
  MAX_CATCHUP_STEPS,
  ORBIT_GAP,
} from '../src/game/simulation/constants';
import { accelerationAt } from '../src/game/simulation/forces';
import { planetPosition, planetVelocity } from '../src/game/simulation/motion';
import { cloneState, createInitialState, isFinished } from '../src/game/simulation/state';
import { stepSim } from '../src/game/simulation/step';
import { FixedStepper } from '../src/game/simulation/timing';
import { chainLevel, flightAt, makeLevel, planet, runtimeOf } from './helpers/level-factory';

const LANE = 40 + ORBIT_GAP;

describe('orbit', () => {
  it('starts on the lane at the requested angle', () => {
    const state = createInitialState(runtimeOf());
    expect(state.ship.mode).toBe('orbit');
    expect(state.ship.x).toBeCloseTo(360, 9);
    expect(state.ship.y).toBeCloseTo(1050 - LANE, 9);
  });

  it('keeps a constant radius and the configured angular speed', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    const startAngle = state.ship.angle;
    for (let i = 0; i < 90; i++) stepSim(rt, state, false);
    expect(Math.hypot(state.ship.x - 360, state.ship.y - 1050)).toBeCloseTo(LANE, 9);
    expect(state.ship.angle - startAngle).toBeCloseTo(90 * DT * (150 / LANE), 9);
  });

  it('turns the other way when dir is -1', () => {
    const rt = runtimeOf(makeLevel({ start: { planet: 'a', angle: 0, dir: -1 } }));
    const state = createInitialState(rt);
    stepSim(rt, state, false);
    expect(state.ship.angle).toBeLessThan(0);
  });

  it('follows a moving planet', () => {
    const moving = planet('a', 360, 1050, { motion: { kind: 'orbit', cx: 360, cy: 900, radius: 150, omega: 1, phase: Math.PI / 2 } });
    const rt = runtimeOf(makeLevel({ planets: [moving] }));
    const state = createInitialState(rt);
    for (let i = 0; i < 60; i++) stepSim(rt, state, false);
    const at = planetPosition(moving, state.tick);
    expect(Math.hypot(state.ship.x - at.x, state.ship.y - at.y)).toBeCloseTo(LANE, 9);
  });

  it('throws a clear error when the start planet is missing', () => {
    const level = makeLevel({ start: { planet: 'nope', angle: 0, dir: 1 } });
    expect(() => createInitialState(runtimeOf(level))).toThrow(/start planet "nope"/);
  });
});

describe('launch', () => {
  it('leaves along the tangent plus an outward push at the launch speed', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    stepSim(rt, state, true);
    const { ship } = state;
    expect(ship.mode).toBe('flight');
    expect(Math.hypot(ship.vx, ship.vy)).toBeCloseTo(LAUNCH_SPEED, 6);
    expect(ship.vx).toBeGreaterThan(0);
    expect(ship.vy).toBeLessThan(0);
    expect(state.launches).toBe(1);
  });

  it('ignores a second release while already flying', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    stepSim(rt, state, true);
    stepSim(rt, state, true);
    expect(state.launches).toBe(1);
  });

  it('inherits the velocity of a moving planet', () => {
    const moving = planet('a', 360, 1050, { motion: { kind: 'orbit', cx: 360, cy: 900, radius: 150, omega: 1, phase: Math.PI / 2 } });
    const rt = runtimeOf(makeLevel({ planets: [moving] }));
    const state = createInitialState(rt);
    stepSim(rt, state, true);
    const drift = planetVelocity(moving, state.tick);
    expect(Math.hypot(state.ship.vx - drift.x, state.ship.vy - drift.y)).toBeCloseTo(LAUNCH_SPEED, 6);
  });

  it('cannot be recaptured by the planet it just left', () => {
    const rt = runtimeOf();
    const state = createInitialState(rt);
    stepSim(rt, state, true);
    for (let i = 0; i < 10; i++) stepSim(rt, state, false);
    expect(state.ship.mode).toBe('flight');
  });
});

describe('gravity', () => {
  const rt = runtimeOf();

  it('pulls toward the planet with the documented quadratic falloff', () => {
    const pull = accelerationAt(rt, 360, 1050 - 100, 0);
    const expected = 700 * (1 - 100 / 190) ** 2;
    expect(pull.x).toBeCloseTo(0, 9);
    expect(pull.y).toBeCloseTo(expected, 6);
  });

  it('is exactly zero at and beyond the influence radius', () => {
    expect(accelerationAt(rt, 360, 1050 - 190, 0)).toEqual({ x: 0, y: 0 });
    expect(accelerationAt(rt, 0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('is bounded at the planet centre', () => {
    const centre = accelerationAt(rt, 360, 1050, 0);
    expect(centre).toEqual({ x: 0, y: 0 });
    const near = accelerationAt(rt, 360, 1049.999, 0);
    expect(Math.hypot(near.x, near.y)).toBeLessThanOrEqual(700);
  });

  it('flips sign inside an inversion field', () => {
    const level = makeLevel({ hazards: [{ type: 'inversion', id: 'i', x: 360, y: 950, radius: 60 }] });
    const inverted = accelerationAt(runtimeOf(level), 360, 950, 0);
    const normal = accelerationAt(rt, 360, 950, 0);
    expect(inverted.y).toBeCloseTo(-normal.y, 9);
  });

  it('pushes outward only while a pulse is firing', () => {
    const pulse = { type: 'pulse' as const, id: 'p', x: 360, y: 500, radius: 100, strength: 800, period: 100, warn: 20, on: 30 };
    const prt = runtimeOf(makeLevel({ hazards: [pulse] }));
    expect(accelerationAt(prt, 400, 500, 10).x).toBe(0);
    expect(accelerationAt(prt, 400, 500, 30).x).toBeGreaterThan(0);
    expect(accelerationAt(prt, 400, 500, 80).x).toBe(0);
    expect(accelerationAt(prt, 500, 500, 30).x).toBe(0);
  });
});

describe('capture', () => {
  const ring = LANE + 16;
  /** Just inside the capture ring, so the result does not hinge on sub-unit movement during the step. */
  const inside = ring - 10;

  it('locks a slow ship into orbit and picks the direction from its approach', () => {
    const { rt, state } = flightAt(makeLevel(), 360 + inside, 1050, [0, 60]);
    stepSim(rt, state, false);
    expect(state.ship.mode).toBe('orbit');
    expect(state.ship.planetId).toBe('a');
    expect(state.ship.dir).toBe(1);
    expect(Math.hypot(state.ship.x - 360, state.ship.y - 1050)).toBeCloseTo(LANE, 9);
    const other = flightAt(makeLevel(), 360 + inside, 1050, [0, -60]);
    stepSim(other.rt, other.state, false);
    expect(other.state.ship.dir).toBe(-1);
  });

  it('does not capture a ship that is too fast, and it crashes into the planet', () => {
    expect(CAPTURE_SPEED_MAX).toBeLessThan(500);
    const { rt, state } = flightAt(makeLevel(), 360 + ring + 30, 1050, [-500, 0]);
    for (let i = 0; i < 30 && !isFinished(state); i++) stepSim(rt, state, false);
    expect(state.ship.mode).toBe('dead');
    expect(state.death).toBe('crash');
  });

  it('measures speed relative to a moving planet', () => {
    const moving = planet('a', 360, 1050, { motion: { kind: 'ping', ax: 200, ay: 1050, bx: 500, by: 1050, period: 4, phase: 0.25 } });
    const level = makeLevel({ planets: [moving], start: { planet: 'a', angle: 0, dir: 1 } });
    const rt = runtimeOf(level);
    const state = createInitialState(rt);
    state.tick = 30;
    const at = planetPosition(moving, 31);
    const drift = planetVelocity(moving, 31);
    Object.assign(state.ship, { mode: 'flight', planetId: null, x: at.x + inside, y: at.y, vx: drift.x, vy: drift.y + 40 });
    stepSim(rt, state, false);
    expect(state.ship.mode).toBe('orbit');
  });
});

describe('fail states and goal', () => {
  it('fails quickly when the ship leaves the playfield', () => {
    const { rt, state } = flightAt(makeLevel(), 5, 640, [-300, 0]);
    for (let i = 0; i < 12 && !isFinished(state); i++) stepSim(rt, state, false);
    expect(state.death).toBe('out-of-bounds');
  });

  it('declares a drifting ship lost instead of letting it float forever', () => {
    const { rt, state } = flightAt(makeLevel(), 360, 640, [0, 0]);
    for (let i = 0; i < FLIGHT_TIMEOUT_TICKS + 5 && !isFinished(state); i++) stepSim(rt, state, false);
    expect(state.death).toBe('lost');
  });

  it('wins at the portal when no shards are required', () => {
    const { rt, state } = flightAt(makeLevel(), 360, 160, [0, -10]);
    const events = stepSim(rt, state, false);
    expect(state.ship.mode).toBe('won');
    expect(events).toContainEqual({ type: 'win' });
  });

  it('keeps the portal closed until the required shards are held', () => {
    const level = makeLevel({
      goal: { x: 360, y: 140, radius: 36, requiredShards: 1 },
      collectibles: [{ id: 's1', kind: 'shard', x: 360, y: 400 }],
    });
    const closed = flightAt(level, 360, 150, [0, 0]);
    stepSim(closed.rt, closed.state, false);
    expect(closed.state.ship.mode).toBe('flight');
    const open = flightAt(level, 360, 150, [0, 0]);
    open.state.collected.push('s1');
    stepSim(open.rt, open.state, false);
    expect(open.state.ship.mode).toBe('won');
  });

  it('does nothing once the run is finished', () => {
    const { rt, state } = flightAt(makeLevel(), 360, 160, [0, -10]);
    stepSim(rt, state, false);
    const tick = state.tick;
    expect(stepSim(rt, state, true)).toEqual([]);
    expect(state.tick).toBe(tick);
  });

  it('can win while orbiting a lane that passes through the portal', () => {
    const level = makeLevel({ goal: { x: 360, y: 1050 - LANE, radius: 30, requiredShards: 0 } });
    const rt = runtimeOf(level);
    const state = createInitialState(rt);
    stepSim(rt, state, false);
    expect(state.ship.mode).toBe('won');
  });
});

describe('determinism and the fixed step', () => {
  function run(launchTicks: number[], steps: number): string {
    const rt = runtimeOf(chainLevel());
    const state = createInitialState(rt);
    for (let i = 0; i < steps; i++) stepSim(rt, state, launchTicks.includes(state.tick + 1));
    return JSON.stringify(state);
  }

  it('gives bit-identical results for identical inputs', () => {
    expect(run([40, 190], 400)).toBe(run([40, 190], 400));
  });

  it('differs when the release time differs', () => {
    expect(run([40], 300)).not.toBe(run([41], 300));
  });

  it('clones state without sharing arrays or the ship', () => {
    const state = createInitialState(runtimeOf());
    const copy = cloneState(state);
    copy.collected.push('x');
    copy.ship.x = 1;
    expect(state.collected).toEqual([]);
    expect(state.ship.x).not.toBe(1);
  });

  it.each([30, 60, 90, 120, 144])('runs the same number of steps per second at %i fps', (fps) => {
    const stepper = new FixedStepper();
    let steps = 0;
    for (let frame = 0; frame < fps * 2; frame++) steps += stepper.advance(1000 / fps);
    expect(Math.abs(steps - 120)).toBeLessThanOrEqual(1);
  });

  it('caps catch-up after a long stall', () => {
    const stepper = new FixedStepper();
    expect(stepper.advance(10_000)).toBe(MAX_CATCHUP_STEPS);
  });

  it('exposes the leftover fraction and drops it on reset', () => {
    const stepper = new FixedStepper();
    expect(stepper.advance(DT * 1000 * 1.5)).toBe(1);
    expect(stepper.alpha).toBeCloseTo(0.5, 6);
    stepper.reset();
    expect(stepper.alpha).toBe(0);
    expect(stepper.advance(-50)).toBe(0);
  });
});

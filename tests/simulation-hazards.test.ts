import { describe, expect, it } from 'vitest';
import { gateIsOpen, laserHits, segmentDistance } from '../src/game/simulation/collision';
import { angleFrom, cyclePhase, planetPosition, satellitePosition } from '../src/game/simulation/motion';
import { shardCount } from '../src/game/simulation/state';
import { stepSim } from '../src/game/simulation/step';
import type { Asteroid, LaserArc, Satellite, ShieldGate, Wormhole } from '../src/game/levels/types';
import { flightAt, makeLevel, planet, runtimeOf } from './helpers/level-factory';

const asteroid: Asteroid = { type: 'asteroid', id: 'r', x: 360, y: 640, radius: 20, seed: 1 };
const laser: LaserArc = {
  type: 'laser', id: 'l', cx: 360, cy: 640, innerR: 100, outerR: 140, width: 1, omega: 0, phase: 0,
  period: 120, warn: 30, on: 60,
};
const gate: ShieldGate = { type: 'gate', id: 'g', a: { x: 200, y: 600 }, b: { x: 520, y: 600 }, opensWith: ['s1'] };
const wormhole: Wormhole = {
  type: 'wormhole', id: 'w', a: { x: 200, y: 640 }, b: { x: 500, y: 900 }, radius: 30, rotate: Math.PI / 2, speedScale: 1,
};

describe('asteroids and satellites', () => {
  it('kills a ship that touches a stationary asteroid', () => {
    const { rt, state } = flightAt(makeLevel({ hazards: [asteroid] }), 360, 665, [0, -60]);
    stepSim(rt, state, false);
    expect(state.death).toBe('asteroid');
  });

  it('lets a ship pass just outside an asteroid', () => {
    const { rt, state } = flightAt(makeLevel({ hazards: [asteroid] }), 360, 640 + 20 + 7 + 8, [0, 0]);
    stepSim(rt, state, false);
    expect(state.ship.mode).toBe('flight');
  });

  it('kills a ship at the satellite position for that tick', () => {
    const sat: Satellite = { type: 'satellite', id: 's', cx: 300, cy: 640, orbit: 80, omega: 1, phase: 0, radius: 12 };
    const level = makeLevel({ hazards: [sat] });
    const at = satellitePosition(runtimeOf(level), sat, 1);
    const { rt, state } = flightAt(level, at.x, at.y, [0, 0]);
    stepSim(rt, state, false);
    expect(state.death).toBe('satellite');
  });

  it('keeps a satellite that orbits a planet at a constant distance from it', () => {
    const moving = planet('a', 360, 1050, { motion: { kind: 'orbit', cx: 360, cy: 900, radius: 100, omega: 0.8, phase: 0 } });
    const sat: Satellite = { type: 'satellite', id: 's', around: 'a', cx: 0, cy: 0, orbit: 90, omega: 1.5, phase: 1, radius: 10 };
    const rt = runtimeOf(makeLevel({ planets: [moving], hazards: [sat] }));
    for (const tick of [0, 25, 130]) {
      const host = planetPosition(moving, tick);
      const at = satellitePosition(rt, sat, tick);
      expect(Math.hypot(at.x - host.x, at.y - host.y)).toBeCloseTo(90, 9);
    }
  });
});

describe('laser arcs', () => {
  const inArc = { x: 360 + 120 * Math.cos(0.5), y: 640 + 120 * Math.sin(0.5) };

  it('is harmless while warning and while resting, lethal while firing', () => {
    expect(cyclePhase(10, laser)).toBe('warn');
    expect(laserHits(laser, inArc.x, inArc.y, 10)).toBe(false);
    expect(cyclePhase(40, laser)).toBe('on');
    expect(laserHits(laser, inArc.x, inArc.y, 40)).toBe(true);
    expect(cyclePhase(100, laser)).toBe('off');
    expect(laserHits(laser, inArc.x, inArc.y, 100)).toBe(false);
  });

  it('only covers its band of radii and its slice of angles', () => {
    expect(laserHits(laser, 360 + 60, 640, 40)).toBe(false);
    expect(laserHits(laser, 360 + 200, 640, 40)).toBe(false);
    expect(laserHits(laser, 360 + 120 * Math.cos(2), 640 + 120 * Math.sin(2), 40)).toBe(false);
  });

  it('rotates over time and handles the wrap at 2*pi', () => {
    const spinning = { ...laser, omega: Math.PI, period: 600, warn: 0, on: 600, width: 0.8 };
    const at = (angle: number) => ({ x: 360 + 120 * Math.cos(angle), y: 640 + 120 * Math.sin(angle) });
    const tick = 90;
    const start = Math.PI * tick * (1 / 60);
    expect(laserHits(spinning, at(start + 0.3).x, at(start + 0.3).y, tick)).toBe(true);
    expect(laserHits(spinning, at(start - 0.3).x, at(start - 0.3).y, tick)).toBe(false);
    const wrapped = { ...spinning, omega: 0, phase: 2 * Math.PI - 0.2 };
    expect(laserHits(wrapped, at(0.2).x, at(0.2).y, 5)).toBe(true);
  });

  it('kills through the step function with the right reason', () => {
    const { rt, state } = flightAt(makeLevel({ hazards: [laser] }), inArc.x, inArc.y, [0, 0]);
    state.tick = 39;
    stepSim(rt, state, false);
    expect(state.death).toBe('laser');
  });

  it('normalises angle differences into [0, 2pi)', () => {
    expect(angleFrom(0, -0.5)).toBeCloseTo(2 * Math.PI - 0.5, 9);
    expect(angleFrom(1, 1.5)).toBeCloseTo(0.5, 9);
  });
});

describe('shield gates and pickups', () => {
  it('blocks a ship until its shard is collected', () => {
    const level = makeLevel({ hazards: [gate], collectibles: [{ id: 's1', kind: 'shard', x: 360, y: 300 }] });
    const closed = flightAt(level, 360, 604, [0, -30]);
    stepSim(closed.rt, closed.state, false);
    expect(closed.state.death).toBe('gate');
    const open = flightAt(level, 360, 604, [0, -30]);
    open.state.collected.push('s1');
    stepSim(open.rt, open.state, false);
    expect(open.state.ship.mode).toBe('flight');
  });

  it('reports the gate opening when the shard is picked up', () => {
    const level = makeLevel({ hazards: [gate], collectibles: [{ id: 's1', kind: 'switch', x: 360, y: 400 }] });
    const { rt, state } = flightAt(level, 360, 405, [0, 0]);
    const events = stepSim(rt, state, false);
    expect(events).toContainEqual({ type: 'collect', id: 's1', kind: 'switch' });
    expect(events).toContainEqual({ type: 'gate-open', id: 'g' });
    expect(gateIsOpen(gate, state.collected)).toBe(true);
  });

  it('measures distance to a segment, including degenerate segments', () => {
    expect(segmentDistance(5, 5, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5, 9);
    expect(segmentDistance(20, 0, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(10, 9);
    expect(segmentDistance(3, 4, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5, 9);
  });

  it('counts only shards toward the portal, not switches', () => {
    const level = makeLevel({
      goal: { x: 360, y: 140, radius: 36, requiredShards: 1 },
      collectibles: [{ id: 'k', kind: 'switch', x: 360, y: 150 }],
    });
    const { rt, state } = flightAt(level, 360, 150, [0, 0]);
    stepSim(rt, state, false);
    expect(state.collected).toEqual(['k']);
    expect(shardCount(rt, state)).toBe(0);
    expect(state.ship.mode).toBe('flight');
  });

  it('collects a shard that lies on an orbit lane', () => {
    const level = makeLevel({ collectibles: [{ id: 's', kind: 'shard', x: 360, y: 1050 - 68 }] });
    const rt = runtimeOf(level);
    const { state } = flightAt(level, 0, 0, [0, 0]);
    state.ship.mode = 'orbit';
    state.ship.planetId = 'a';
    state.ship.angle = -Math.PI / 2 - 0.01;
    stepSim(rt, state, false);
    expect(state.collected).toEqual(['s']);
  });

  it('lets a lethal hazard win over a pickup in the same place', () => {
    const level = makeLevel({ hazards: [asteroid], collectibles: [{ id: 's', kind: 'shard', x: 360, y: 640 }] });
    const { rt, state } = flightAt(level, 360, 640, [0, 0]);
    stepSim(rt, state, false);
    expect(state.death).toBe('asteroid');
    expect(state.collected).toEqual([]);
  });
});

describe('wormholes', () => {
  const level = makeLevel({ hazards: [wormhole] });

  it('moves the ship to the far mouth and turns its velocity', () => {
    const { rt, state } = flightAt(level, 195, 640, [100, 0]);
    const events = stepSim(rt, state, false);
    expect(events).toContainEqual({ type: 'teleport', wormholeId: 'w' });
    expect(Math.hypot(state.ship.x - 500, state.ship.y - 900)).toBeLessThan(45);
    expect(Math.hypot(state.ship.vx, state.ship.vy)).toBeCloseTo(100, 6);
    expect(Math.atan2(state.ship.vy, state.ship.vx)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('turns the opposite way when entered from the other mouth', () => {
    const { rt, state } = flightAt(level, 495, 900, [100, 0]);
    stepSim(rt, state, false);
    expect(Math.atan2(state.ship.vy, state.ship.vx)).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('scales speed in and out, capped at the maximum speed', () => {
    const boosted = makeLevel({ hazards: [{ ...wormhole, rotate: 0, speedScale: 2 }] });
    const forward = flightAt(boosted, 195, 640, [100, 0]);
    stepSim(forward.rt, forward.state, false);
    expect(Math.hypot(forward.state.ship.vx, forward.state.ship.vy)).toBeCloseTo(200, 6);
    const back = flightAt(boosted, 495, 900, [100, 0]);
    stepSim(back.rt, back.state, false);
    expect(Math.hypot(back.state.ship.vx, back.state.ship.vy)).toBeCloseTo(50, 6);
    const capped = flightAt(boosted, 195, 640, [400, 0]);
    stepSim(capped.rt, capped.state, false);
    expect(Math.hypot(capped.state.ship.vx, capped.state.ship.vy)).toBeCloseTo(540, 6);
  });

  it('does not bounce straight back out of the mouth it came from', () => {
    const { rt, state } = flightAt(level, 195, 640, [100, 0]);
    stepSim(rt, state, false);
    const first = { x: state.ship.x, y: state.ship.y };
    stepSim(rt, state, false);
    expect(Math.hypot(state.ship.x - 200, state.ship.y - 640)).toBeGreaterThan(100);
    expect(Math.hypot(state.ship.x - first.x, state.ship.y - first.y)).toBeLessThan(5);
  });
});

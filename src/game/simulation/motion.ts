import type { LaserArc, Planet, RepulsionPulse, Satellite, Vec } from '../levels/types';
import { DT } from './constants';
import type { LevelRuntime } from './runtime';

const TAU = Math.PI * 2;

/** Where a planet is at a given tick. Static planets never move; moving ones are closed-form in the tick. */
export function planetPosition(planet: Planet, tick: number): Vec {
  const motion = planet.motion;
  if (!motion) return { x: planet.x, y: planet.y };
  const t = tick * DT;
  if (motion.kind === 'orbit') {
    const angle = motion.phase + motion.omega * t;
    return { x: motion.cx + Math.cos(angle) * motion.radius, y: motion.cy + Math.sin(angle) * motion.radius };
  }
  const blend = 0.5 - 0.5 * Math.cos(TAU * (t / motion.period + motion.phase));
  return { x: motion.ax + (motion.bx - motion.ax) * blend, y: motion.ay + (motion.by - motion.ay) * blend };
}

export function satellitePosition(rt: LevelRuntime, sat: Satellite, tick: number): Vec {
  const host = sat.around ? rt.planetById.get(sat.around) : undefined;
  const center = host ? planetPosition(host, tick) : { x: sat.cx, y: sat.cy };
  const angle = sat.phase + sat.omega * tick * DT;
  return { x: center.x + Math.cos(angle) * sat.orbit, y: center.y + Math.sin(angle) * sat.orbit };
}

export type CyclePhase = 'off' | 'warn' | 'on';

/** Lasers and pulses share one cycle: warning, then firing, then rest. */
export function cyclePhase(tick: number, hazard: LaserArc | RepulsionPulse): CyclePhase {
  const t = tick % hazard.period;
  if (t < hazard.warn) return 'warn';
  return t < hazard.warn + hazard.on ? 'on' : 'off';
}

export function laserStartAngle(laser: LaserArc, tick: number): number {
  return laser.phase + laser.omega * tick * DT;
}

export function planetVelocity(planet: Planet, tick: number): Vec {
  if (!planet.motion) return { x: 0, y: 0 };
  const now = planetPosition(planet, tick);
  const before = planetPosition(planet, tick - 1);
  return { x: (now.x - before.x) / DT, y: (now.y - before.y) / DT };
}

/** Smallest positive angle from `from` to `to`, in [0, 2pi). */
export function angleFrom(from: number, to: number): number {
  const delta = (to - from) % TAU;
  return delta < 0 ? delta + TAU : delta;
}

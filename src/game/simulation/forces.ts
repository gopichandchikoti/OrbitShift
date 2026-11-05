import type { Vec } from '../levels/types';
import { cyclePhase, planetPosition } from './motion';
import type { LevelRuntime } from './runtime';

/** True while the point lies inside any gravity-inversion field. */
export function isInverted(rt: LevelRuntime, x: number, y: number): boolean {
  return rt.inversions.some((field) => Math.hypot(x - field.x, y - field.y) < field.radius);
}

/**
 * Bounded arcade gravity. Each planet pulls toward its centre with a quadratic falloff that reaches exactly zero at
 * its influence radius, so nothing is singular and nothing reaches across the whole level. Inversion fields flip the
 * sign of every planet's pull; an active pulse pushes outward from its emitter.
 */
export function accelerationAt(rt: LevelRuntime, x: number, y: number, tick: number): Vec {
  const sign = isInverted(rt, x, y) ? -1 : 1;
  let ax = 0;
  let ay = 0;
  for (const planet of rt.planets) {
    const at = planetPosition(planet, tick);
    const dx = at.x - x;
    const dy = at.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist >= planet.influence || dist < 1e-6) continue;
    const fade = 1 - dist / planet.influence;
    const pull = (sign * planet.gravity * fade * fade) / dist;
    ax += dx * pull;
    ay += dy * pull;
  }
  for (const pulse of rt.pulses) {
    if (cyclePhase(tick, pulse) !== 'on') continue;
    const dx = x - pulse.x;
    const dy = y - pulse.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= pulse.radius || dist < 1e-6) continue;
    const push = (pulse.strength * (1 - dist / pulse.radius)) / dist;
    ax += dx * push;
    ay += dy * push;
  }
  return { x: ax, y: ay };
}

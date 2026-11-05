import { DT } from './constants';
import type { LevelRuntime } from './runtime';
import { orbitRadiusOf } from './runtime';
import { planetPosition } from './motion';
import type { SimState } from './types';

/** The part of the ship's mode the renderer cares about. */
export type PlayerMode = 'orbit' | 'flight' | 'gone';

export interface ShipView {
  x: number;
  y: number;
  /** Direction the nose points, radians. */
  heading: number;
  mode: PlayerMode;
}

/**
 * Where to draw the ship between two simulation steps. `alpha` is the elapsed fraction of the next step; orbits are
 * advanced analytically and flights by their velocity, so motion stays smooth on 90 and 120 Hz displays.
 */
export function viewShip(rt: LevelRuntime, state: SimState, alpha: number): ShipView {
  const { ship } = state;
  if (ship.mode === 'dead' || ship.mode === 'won') return { x: ship.x, y: ship.y, heading: 0, mode: 'gone' };
  if (ship.mode === 'flight') {
    const speed = Math.hypot(ship.vx, ship.vy);
    return {
      x: ship.x + ship.vx * DT * alpha,
      y: ship.y + ship.vy * DT * alpha,
      heading: speed > 1 ? Math.atan2(ship.vy, ship.vx) : 0,
      mode: 'flight',
    };
  }
  const host = ship.planetId ? rt.planetById.get(ship.planetId) : undefined;
  if (!host) return { x: ship.x, y: ship.y, heading: 0, mode: 'orbit' };
  const radius = orbitRadiusOf(host);
  const angle = ship.angle + ship.dir * (host.orbitSpeed / radius) * DT * alpha;
  const centre = planetPosition(host, state.tick + alpha);
  return {
    x: centre.x + Math.cos(angle) * radius,
    y: centre.y + Math.sin(angle) * radius,
    heading: angle + (ship.dir * Math.PI) / 2,
    mode: 'orbit',
  };
}

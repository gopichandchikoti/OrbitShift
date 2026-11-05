import { lethalAt } from './collision';
import {
  DT,
  FLIGHT_TIMEOUT_TICKS,
  LAUNCH_RADIAL,
  LAUNCH_SPEED,
  MAX_SPEED,
  OUT_OF_BOUNDS_MARGIN,
  RECAPTURE_LOCKOUT,
} from './constants';
import { collectNearby, reachesGoal, tryCapture, useWormhole } from './encounters';
import { accelerationAt } from './forces';
import { planetPosition, planetVelocity } from './motion';
import { orbitRadiusOf, type LevelRuntime } from './runtime';
import { isFinished } from './state';
import type { DeathReason, SimEvent, SimState } from './types';

const NO_EVENTS: readonly SimEvent[] = [];

function die(s: SimState, reason: DeathReason, events: SimEvent[]): void {
  s.ship.mode = 'dead';
  s.death = reason;
  events.push({ type: 'death', reason });
}

function outOfBounds(rt: LevelRuntime, x: number, y: number): boolean {
  const { w, h } = rt.level.bounds;
  const m = OUT_OF_BOUNDS_MARGIN;
  return x < -m || x > w + m || y < -m || y > h + m;
}

/** Moves the orbiting ship along its lane; the lane follows the planet when it moves. */
function advanceOrbit(rt: LevelRuntime, s: SimState): void {
  const ship = s.ship;
  const host = ship.planetId ? rt.planetById.get(ship.planetId) : undefined;
  if (!host) return;
  const radius = orbitRadiusOf(host);
  ship.angle += (ship.dir * (host.orbitSpeed / radius)) * DT;
  const at = planetPosition(host, s.tick);
  ship.x = at.x + Math.cos(ship.angle) * radius;
  ship.y = at.y + Math.sin(ship.angle) * radius;
}

/** Releases the ship along the orbit tangent with an outward push, inheriting a moving planet's velocity. */
function launchShip(rt: LevelRuntime, s: SimState, events: SimEvent[]): void {
  const ship = s.ship;
  const host = ship.planetId ? rt.planetById.get(ship.planetId) : undefined;
  if (!host) return;
  const tx = -Math.sin(ship.angle) * ship.dir;
  const ty = Math.cos(ship.angle) * ship.dir;
  const dx = tx + Math.cos(ship.angle) * LAUNCH_RADIAL;
  const dy = ty + Math.sin(ship.angle) * LAUNCH_RADIAL;
  const norm = Math.hypot(dx, dy);
  const drift = planetVelocity(host, s.tick);
  ship.vx = (dx / norm) * LAUNCH_SPEED + drift.x;
  ship.vy = (dy / norm) * LAUNCH_SPEED + drift.y;
  ship.mode = 'flight';
  ship.graceId = host.id;
  ship.graceTicks = RECAPTURE_LOCKOUT;
  ship.planetId = null;
  ship.flightTicks = 0;
  s.launches += 1;
  events.push({ type: 'launch' });
}

function integrateFlight(rt: LevelRuntime, s: SimState): void {
  const ship = s.ship;
  const pull = accelerationAt(rt, ship.x, ship.y, s.tick);
  ship.vx += pull.x * DT;
  ship.vy += pull.y * DT;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > MAX_SPEED) {
    ship.vx *= MAX_SPEED / speed;
    ship.vy *= MAX_SPEED / speed;
  }
  ship.x += ship.vx * DT;
  ship.y += ship.vy * DT;
  ship.flightTicks += 1;
}

/** Collision order is fixed: bounds, lethal things, pickups, wormholes, the portal, then planet capture. */
function resolveFlight(rt: LevelRuntime, s: SimState, events: SimEvent[]): void {
  const ship = s.ship;
  if (outOfBounds(rt, ship.x, ship.y)) return die(s, 'out-of-bounds', events);
  const lethal = lethalAt(rt, ship, s.tick, s.collected);
  if (lethal) return die(s, lethal, events);
  collectNearby(rt, s, events);
  useWormhole(rt, s, events);
  if (reachesGoal(rt, s)) {
    ship.mode = 'won';
    events.push({ type: 'win' });
    return;
  }
  if (tryCapture(rt, s, events)) return;
  if (ship.flightTicks > FLIGHT_TIMEOUT_TICKS) die(s, 'lost', events);
}

/**
 * Advances the simulation by exactly one fixed step (1/60 s), mutating `s`. `launch` is the player's release for this
 * step: it only does anything while the ship is in orbit. Returns the events the step produced.
 */
export function stepSim(rt: LevelRuntime, s: SimState, launch: boolean): readonly SimEvent[] {
  if (isFinished(s)) return NO_EVENTS;
  const events: SimEvent[] = [];
  s.tick += 1;
  const ship = s.ship;
  if (ship.graceTicks > 0) ship.graceTicks -= 1;
  if (ship.wormholeTicks > 0) ship.wormholeTicks -= 1;
  if (ship.mode === 'orbit') {
    advanceOrbit(rt, s);
    collectNearby(rt, s, events);
    if (reachesGoal(rt, s)) {
      ship.mode = 'won';
      events.push({ type: 'win' });
    } else if (launch) {
      launchShip(rt, s, events);
    }
    return events;
  }
  integrateFlight(rt, s);
  resolveFlight(rt, s, events);
  return events;
}

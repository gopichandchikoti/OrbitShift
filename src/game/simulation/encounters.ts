import { gateIsOpen } from './collision';
import {
  CAPTURE_MARGIN,
  CAPTURE_SPEED_MAX,
  COLLECTIBLE_RADIUS,
  MAX_SPEED,
  SHIP_HIT_RADIUS,
  WORMHOLE_COOLDOWN,
} from './constants';
import { planetPosition, planetVelocity } from './motion';
import { orbitRadiusOf, type LevelRuntime } from './runtime';
import { shardCount } from './state';
import type { SimEvent, SimState } from './types';

/** Picks up any collectible the ship touches, and reports gates that this pickup opened. */
export function collectNearby(rt: LevelRuntime, s: SimState, events: SimEvent[]): void {
  for (const item of rt.level.collectibles) {
    if (s.collected.includes(item.id)) continue;
    if (Math.hypot(s.ship.x - item.x, s.ship.y - item.y) > COLLECTIBLE_RADIUS + SHIP_HIT_RADIUS) continue;
    s.collected.push(item.id);
    events.push({ type: 'collect', id: item.id, kind: item.kind });
    for (const gate of rt.gates) {
      if (gate.opensWith.includes(item.id) && gateIsOpen(gate, s.collected)) {
        events.push({ type: 'gate-open', id: gate.id });
      }
    }
  }
}

/** Enters a wormhole mouth and leaves by the other one, turning and scaling the velocity as the level says. */
export function useWormhole(rt: LevelRuntime, s: SimState, events: SimEvent[]): void {
  const ship = s.ship;
  if (ship.wormholeTicks > 0) return;
  for (const hole of rt.wormholes) {
    const enteredA = Math.hypot(ship.x - hole.a.x, ship.y - hole.a.y) < hole.radius;
    const enteredB = Math.hypot(ship.x - hole.b.x, ship.y - hole.b.y) < hole.radius;
    if (!enteredA && !enteredB) continue;
    const turn = enteredA ? hole.rotate : -hole.rotate;
    const scale = enteredA ? hole.speedScale : 1 / hole.speedScale;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const speed = Math.min(Math.hypot(ship.vx, ship.vy) * scale, MAX_SPEED);
    const heading = Math.atan2(ship.vx * sin + ship.vy * cos, ship.vx * cos - ship.vy * sin);
    ship.vx = Math.cos(heading) * speed;
    ship.vy = Math.sin(heading) * speed;
    const exit = enteredA ? hole.b : hole.a;
    const clearance = hole.radius + SHIP_HIT_RADIUS + 2;
    ship.x = exit.x + Math.cos(heading) * clearance;
    ship.y = exit.y + Math.sin(heading) * clearance;
    ship.wormholeTicks = WORMHOLE_COOLDOWN;
    events.push({ type: 'teleport', wormholeId: hole.id });
    return;
  }
}

/** Reaching the portal wins once enough shards are held; before that it is inert. */
export function reachesGoal(rt: LevelRuntime, s: SimState): boolean {
  const { goal } = rt.level;
  if (Math.hypot(s.ship.x - goal.x, s.ship.y - goal.y) > goal.radius) return false;
  return shardCount(rt, s) >= goal.requiredShards;
}

/** Locks onto the first planet whose capture ring the ship is inside of, slowly enough, and not just launched from. */
export function tryCapture(rt: LevelRuntime, s: SimState, events: SimEvent[]): boolean {
  const ship = s.ship;
  for (const planet of rt.planets) {
    if (ship.graceId === planet.id && ship.graceTicks > 0) continue;
    const at = planetPosition(planet, s.tick);
    const dx = ship.x - at.x;
    const dy = ship.y - at.y;
    const ring = orbitRadiusOf(planet);
    if (Math.hypot(dx, dy) > ring + CAPTURE_MARGIN) continue;
    const drift = planetVelocity(planet, s.tick);
    const rvx = ship.vx - drift.x;
    const rvy = ship.vy - drift.y;
    if (Math.hypot(rvx, rvy) > CAPTURE_SPEED_MAX) continue;
    const angle = Math.atan2(dy, dx);
    ship.mode = 'orbit';
    ship.planetId = planet.id;
    ship.angle = angle;
    ship.dir = dx * rvy - dy * rvx >= 0 ? 1 : -1;
    ship.x = at.x + Math.cos(angle) * ring;
    ship.y = at.y + Math.sin(angle) * ring;
    ship.vx = 0;
    ship.vy = 0;
    events.push({ type: 'capture', planetId: planet.id });
    return true;
  }
  return false;
}

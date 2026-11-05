import type { LaserArc, ShieldGate, Vec } from '../levels/types';
import { GATE_HALF_THICKNESS, SHIP_HIT_RADIUS } from './constants';
import { angleFrom, cyclePhase, laserStartAngle, planetPosition, satellitePosition } from './motion';
import type { LevelRuntime } from './runtime';
import type { DeathReason } from './types';

const TAU = Math.PI * 2;

export function gateIsOpen(gate: ShieldGate, collected: readonly string[]): boolean {
  return gate.opensWith.every((id) => collected.includes(id));
}

/** Distance from point p to the segment a-b. */
export function segmentDistance(px: number, py: number, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / lengthSq));
  return Math.hypot(px - (a.x + abx * t), py - (a.y + aby * t));
}

/** A firing laser covers a band of radii and a slice of angles; the warning phase is harmless. */
export function laserHits(laser: LaserArc, x: number, y: number, tick: number): boolean {
  if (cyclePhase(tick, laser) !== 'on') return false;
  const dx = x - laser.cx;
  const dy = y - laser.cy;
  const dist = Math.hypot(dx, dy);
  if (dist < laser.innerR - SHIP_HIT_RADIUS || dist > laser.outerR + SHIP_HIT_RADIUS) return false;
  const slack = SHIP_HIT_RADIUS / Math.max(dist, 1);
  const offset = angleFrom(laserStartAngle(laser, tick), Math.atan2(dy, dx));
  return offset <= laser.width + slack || offset >= TAU - slack;
}

function hitsPlanet(rt: LevelRuntime, x: number, y: number, tick: number): boolean {
  return rt.planets.some((planet) => {
    const at = planetPosition(planet, tick);
    return Math.hypot(x - at.x, y - at.y) < planet.radius + SHIP_HIT_RADIUS * 0.5;
  });
}

function hitsAsteroid(rt: LevelRuntime, x: number, y: number): boolean {
  return rt.asteroids.some((rock) => Math.hypot(x - rock.x, y - rock.y) < rock.radius + SHIP_HIT_RADIUS);
}

function hitsSatellite(rt: LevelRuntime, x: number, y: number, tick: number): boolean {
  return rt.satellites.some((sat) => {
    const at = satellitePosition(rt, sat, tick);
    return Math.hypot(x - at.x, y - at.y) < sat.radius + SHIP_HIT_RADIUS;
  });
}

function hitsGate(rt: LevelRuntime, x: number, y: number, collected: readonly string[]): boolean {
  return rt.gates.some(
    (gate) =>
      !gateIsOpen(gate, collected) && segmentDistance(x, y, gate.a, gate.b) < GATE_HALF_THICKNESS + SHIP_HIT_RADIUS,
  );
}

/** What kills a ship at this point and tick, if anything. A planet body is checked first, then each hazard family. */
export function lethalAt(
  rt: LevelRuntime,
  at: Vec,
  tick: number,
  collected: readonly string[],
): DeathReason | null {
  const { x, y } = at;
  if (hitsPlanet(rt, x, y, tick)) return 'crash';
  if (hitsAsteroid(rt, x, y)) return 'asteroid';
  if (hitsSatellite(rt, x, y, tick)) return 'satellite';
  if (rt.lasers.some((laser) => laserHits(laser, x, y, tick))) return 'laser';
  if (hitsGate(rt, x, y, collected)) return 'gate';
  return null;
}

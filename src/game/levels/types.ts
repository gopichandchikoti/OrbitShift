/** Typed, versioned level contract. Level files under ./data are the single source of truth for every level. */

export const LEVEL_SCHEMA_VERSION = 1;

/** The playfield is a fixed portrait rectangle; every level uses it so the browser and the APK play identically. */
export const WORLD_WIDTH = 720;
export const WORLD_HEIGHT = 1280;

export interface Vec {
  x: number;
  y: number;
}

export type PlanetMotion =
  | { kind: 'orbit'; cx: number; cy: number; radius: number; omega: number; phase: number }
  | { kind: 'ping'; ax: number; ay: number; bx: number; by: number; period: number; phase: number };

export interface Planet {
  id: string;
  /** Position at tick 0 (the planet's anchor when it has no motion). */
  x: number;
  y: number;
  radius: number;
  /** Peak pull in units/s^2 at the planet's centre; it fades to zero at `influence`. */
  gravity: number;
  influence: number;
  /** Tangential speed of a ship in orbit, units/s. Smaller planets therefore spin the ship faster. */
  orbitSpeed: number;
  /** Index into the planet palette (0-5); purely visual. */
  style: number;
  motion?: PlanetMotion;
}

export interface Asteroid {
  type: 'asteroid';
  id: string;
  x: number;
  y: number;
  radius: number;
  /** Seeds the jagged outline so each rock looks different; purely visual. */
  seed: number;
}

export interface Satellite {
  type: 'satellite';
  id: string;
  /** Centre of the satellite's orbit: a planet (it follows it) or a fixed point. */
  around?: string;
  cx: number;
  cy: number;
  orbit: number;
  omega: number;
  phase: number;
  radius: number;
}

export interface LaserArc {
  type: 'laser';
  id: string;
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  /** Angular width of the beam, radians. */
  width: number;
  omega: number;
  phase: number;
  /** Cycle length, warning length and firing length, all in ticks (60 per second). The rest of the cycle is off. */
  period: number;
  warn: number;
  on: number;
}

export interface RepulsionPulse {
  type: 'pulse';
  id: string;
  x: number;
  y: number;
  radius: number;
  /** Peak outward acceleration (units/s^2) at the emitter. */
  strength: number;
  period: number;
  warn: number;
  on: number;
}

export interface InversionField {
  type: 'inversion';
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface Wormhole {
  type: 'wormhole';
  id: string;
  a: Vec;
  b: Vec;
  radius: number;
  /** Radians the velocity turns by when entering `a` (entering `b` turns it the opposite way). */
  rotate: number;
  /** Speed multiplier when entering `a` (entering `b` divides by it). 1 preserves the speed. */
  speedScale: number;
}

export interface ShieldGate {
  type: 'gate';
  id: string;
  a: Vec;
  b: Vec;
  /** Collectible ids that must all be collected to open the gate. */
  opensWith: string[];
}

export type Hazard = Asteroid | Satellite | LaserArc | RepulsionPulse | InversionField | Wormhole | ShieldGate;
export type HazardType = Hazard['type'];

export interface Collectible {
  id: string;
  /** A shard counts toward the goal and the totals; a switch only opens gates. */
  kind: 'shard' | 'switch';
  x: number;
  y: number;
}

export interface Goal {
  x: number;
  y: number;
  radius: number;
  /** Shards needed before the portal opens. */
  requiredShards: number;
}

export interface StartOrbit {
  planet: string;
  angle: number;
  dir: 1 | -1;
}

export interface Par {
  /** 2 stars: finish with at most this many launches. 3 stars: also finish within `seconds`. */
  launches: number;
  seconds: number;
}

/** A recorded, replayable winning run: the absolute simulation tick of every launch. */
export interface Solution {
  launchTicks: number[];
  totalTicks: number;
  shards: number;
  /** Narrowest timing window (in ticks) over the launches, a measure of how forgiving the route is. */
  minWindow: number;
  solver: string;
}

export interface Level {
  schema: number;
  id: number;
  chapter: number;
  /** 1-10 within the chapter. */
  index: number;
  name: string;
  seed: number;
  bounds: { w: number; h: number };
  start: StartOrbit;
  goal: Goal;
  planets: Planet[];
  hazards: Hazard[];
  collectibles: Collectible[];
  par: Par;
  tutorialHint: string | null;
  solution: Solution;
}

export const HAZARD_TYPES: readonly HazardType[] = [
  'asteroid',
  'satellite',
  'laser',
  'pulse',
  'inversion',
  'wormhole',
  'gate',
];

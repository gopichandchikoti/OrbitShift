import type { Goal, Planet, PlanetMotion, StartOrbit, Vec } from '../../../src/game/levels/types';
import { WORLD_WIDTH } from '../../../src/game/levels/types';
import { planetKeepOut } from '../../../src/game/levels/validate';
import { planetPosition } from '../../../src/game/simulation/motion';
import type { Recipe } from './recipes';
import { round1, type Rng } from './rng';

export interface Layout {
  planets: Planet[];
  goal: Goal;
  start: StartOrbit;
}

const CENTER_X = WORLD_WIDTH / 2;
const BOTTOM_Y = 1070;
const GOAL_TOP = 170;
const GOAL_GAP = 270;
const MIN_X = 110;
const MAX_X = WORLD_WIDTH - 110;

interface Tuning {
  /** Ship speed on the orbit lane: slower orbits give a finer release timing. */
  orbit: [number, number];
  /** Portal radius: a bigger portal widens the timing window of the last hop. */
  portal: [number, number];
}

/** Early chapters are the most forgiving; the final chapters use the tightest geometry. */
function tuningFor(chapter: number): Tuning {
  if (chapter <= 3) return { orbit: [95, 118], portal: [46, 56] };
  if (chapter <= 6) return { orbit: [108, 135], portal: [40, 50] };
  if (chapter <= 9) return { orbit: [118, 150], portal: [36, 46] };
  return { orbit: [125, 165], portal: [32, 42] };
}

function makePlanet(rng: Rng, id: string, at: Vec, chapter: number): Planet {
  const [slow, fast] = tuningFor(chapter).orbit;
  return {
    id,
    x: round1(at.x),
    y: round1(at.y),
    radius: rng.int(30, 48),
    gravity: rng.int(560, 860),
    influence: rng.int(175, 225),
    orbitSpeed: rng.int(slow, fast),
    style: (chapter + rng.int(0, 5)) % 6,
  };
}

/** Rising zig-zag of route planets: spacing about 240-320 units so each hop has a forgiving timing window. */
function chainPoints(rng: Rng, hops: number): { points: Vec[]; goal: Vec } {
  const spacing = rng.range(250, 310);
  const room = BOTTOM_Y - GOAL_TOP - GOAL_GAP;
  const rise = hops > 1 ? Math.min(spacing * 0.82, room / (hops - 1)) : 0;
  const run = Math.sqrt(Math.max(spacing * spacing - rise * rise, 0));
  const height = rise * (hops - 1) + GOAL_GAP;
  const bottom = Math.min(BOTTOM_Y, GOAL_TOP + (1280 - GOAL_TOP * 2 + height) / 2 + 40);
  const side = rng.sign();
  const points: Vec[] = [];
  for (let k = 0; k < hops; k++) {
    const x = CENTER_X + side * (k % 2 === 0 ? -1 : 1) * Math.min(run / 2, 230) + rng.range(-30, 30);
    points.push({ x: Math.max(MIN_X, Math.min(MAX_X, x)), y: bottom - k * rise + rng.range(-20, 20) });
  }
  const last = points[hops - 1] as Vec;
  const goalX = CENTER_X - Math.sign(last.x - CENTER_X || 1) * rng.range(30, 150);
  return { points, goal: { x: goalX, y: last.y - rng.range(GOAL_GAP - 30, GOAL_GAP + 10) } };
}

function clearOfAll(candidate: Planet, others: Planet[]): boolean {
  return others.every((other) => {
    const gap = Math.hypot(candidate.x - other.x, candidate.y - other.y);
    return gap >= planetKeepOut(candidate) + planetKeepOut(other) + 24;
  });
}

function addDecoys(rng: Rng, planets: Planet[], goal: Vec, recipe: Recipe): void {
  let tries = 0;
  const wanted = planets.length + recipe.decoys;
  while (planets.length < wanted && tries++ < 60) {
    const anchor = rng.pick(planets);
    const at = { x: anchor.x + rng.range(-300, 300), y: anchor.y + rng.range(-260, 160) };
    if (at.x < MIN_X || at.x > MAX_X || at.y < 150 || at.y > 1130) continue;
    if (Math.hypot(at.x - goal.x, at.y - goal.y) < 190) continue;
    const decoy = makePlanet(rng, `p${planets.length}`, at, recipe.chapter);
    if (clearOfAll(decoy, planets)) planets.push(decoy);
  }
}

function motionFor(rng: Rng, planet: Planet): PlanetMotion {
  const amplitude = rng.range(45, 85);
  if (rng.chance(0.5)) {
    const horizontal = rng.chance(0.5);
    const dx = horizontal ? amplitude : 0;
    const dy = horizontal ? 0 : amplitude;
    return {
      kind: 'ping',
      ax: round1(planet.x - dx),
      ay: round1(planet.y - dy),
      bx: round1(planet.x + dx),
      by: round1(planet.y + dy),
      period: round1(rng.range(5, 9)),
      phase: round1(rng.range(0, 1)),
    };
  }
  return {
    kind: 'orbit',
    cx: planet.x,
    cy: planet.y,
    radius: round1(amplitude),
    omega: round1(rng.sign() * rng.range(0.35, 0.7)),
    phase: round1(rng.range(0, Math.PI * 2)),
  };
}

function makeMoving(rng: Rng, planets: Planet[], count: number): void {
  const movable = planets.slice(1);
  for (let k = 0; k < count && movable.length > 0; k++) {
    const planet = movable.splice(rng.int(0, movable.length - 1), 1)[0] as Planet;
    const motion = motionFor(rng, planet);
    const at = planetPosition({ ...planet, motion }, 0);
    planet.motion = motion;
    planet.x = round1(at.x);
    planet.y = round1(at.y);
  }
}

/** Places the route, decoys and moving planets. Returns the layout, or null when no valid arrangement was found. */
export function placeLayout(rng: Rng, recipe: Recipe): Layout | null {
  const { points, goal: goalPoint } = chainPoints(rng, recipe.hops);
  const planets = points.map((at, k) => makePlanet(rng, `p${k}`, at, recipe.chapter));
  if (!planets.every((planet, k) => clearOfAll(planet, planets.slice(0, k)))) return null;
  addDecoys(rng, planets, goalPoint, recipe);
  makeMoving(rng, planets, recipe.movingPlanets);
  const goal: Goal = {
    x: round1(goalPoint.x),
    y: round1(goalPoint.y),
    radius: rng.int(...tuningFor(recipe.chapter).portal),
    requiredShards: recipe.requiredShards,
  };
  const start: StartOrbit = { planet: 'p0', angle: round1(rng.range(-Math.PI, Math.PI)), dir: rng.sign() };
  return { planets, goal, start };
}

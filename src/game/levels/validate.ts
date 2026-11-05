import { CAPTURE_MARGIN, ORBIT_GAP, TICK_RATE } from '../simulation/constants';
import { planetPosition, satellitePosition } from '../simulation/motion';
import { buildRuntime, type LevelRuntime } from '../simulation/runtime';
import { chapterOf, LEVEL_COUNT, LEVELS_PER_CHAPTER } from './chapters';
import type { Collectible, Hazard, Level, Planet, Satellite, Vec } from './types';
import { LEVEL_SCHEMA_VERSION, WORLD_HEIGHT, WORLD_WIDTH } from './types';

const EDGE = 24;
const PLANET_STYLES = 6;
/** Ticks sampled when checking moving things (10 s at 60 Hz, a whole number of most cycles). */
const SAMPLE_SPAN = 600;
const SAMPLE_STEP = 20;

/** Distance from a planet's centre inside which nothing hostile may sit: its lane plus the capture ring. */
export function planetKeepOut(planet: Planet): number {
  return planet.radius + ORBIT_GAP + CAPTURE_MARGIN;
}

function inside(point: Vec, margin = EDGE): boolean {
  return point.x >= margin && point.x <= WORLD_WIDTH - margin && point.y >= margin && point.y <= WORLD_HEIGHT - margin;
}

function planetTrack(planet: Planet): Vec[] {
  if (!planet.motion) return [planetPosition(planet, 0)];
  const track: Vec[] = [];
  for (let tick = 0; tick <= SAMPLE_SPAN; tick += SAMPLE_STEP) track.push(planetPosition(planet, tick));
  return track;
}

function minDistance(point: Vec, track: Vec[]): number {
  return Math.min(...track.map((at) => Math.hypot(point.x - at.x, point.y - at.y)));
}

function checkIdentity(level: Level): string[] {
  const problems: string[] = [];
  if (level.schema !== LEVEL_SCHEMA_VERSION) problems.push(`schema ${level.schema} is not ${LEVEL_SCHEMA_VERSION}`);
  if (!Number.isInteger(level.id) || level.id < 1 || level.id > LEVEL_COUNT) problems.push(`id ${level.id} out of range`);
  if (level.chapter !== chapterOf(level.id)) problems.push('chapter does not match id');
  if (level.index !== ((level.id - 1) % LEVELS_PER_CHAPTER) + 1) problems.push('index does not match id');
  if (level.bounds.w !== WORLD_WIDTH || level.bounds.h !== WORLD_HEIGHT) problems.push('bounds are not the world size');
  if (level.name.trim().length === 0) problems.push('name is empty');
  return problems;
}

function outside(value: number, low: number, high: number): boolean {
  return value < low || value > high;
}

function checkPlanetRanges(planet: Planet): string[] {
  const tag = `planet ${planet.id}`;
  const problems: string[] = [];
  if (outside(planet.radius, 24, 64)) problems.push(`${tag}: radius ${planet.radius} out of 24-64`);
  if (planet.influence < planetKeepOut(planet) + 20) problems.push(`${tag}: influence too small`);
  if (outside(planet.orbitSpeed, 80, 220)) problems.push(`${tag}: orbitSpeed out of 80-220`);
  if (outside(planet.gravity, 200, 1200)) problems.push(`${tag}: gravity out of 200-1200`);
  if (!Number.isInteger(planet.style) || outside(planet.style, 0, PLANET_STYLES - 1)) {
    problems.push(`${tag}: style ${planet.style} is not a palette index`);
  }
  return problems;
}

function checkPlanet(planet: Planet, index: number, all: Planet[]): string[] {
  const problems = checkPlanetRanges(planet);
  const tag = `planet ${planet.id}`;
  const track = planetTrack(planet);
  if (!track.every((at) => inside(at, EDGE + planet.radius))) problems.push(`${tag}: leaves the playfield`);
  for (const other of all.slice(index + 1)) {
    const gap = Math.min(...planetTrack(other).map((at) => minDistance(at, track)));
    if (gap < planetKeepOut(planet) + planetKeepOut(other)) problems.push(`${tag} overlaps ${other.id}`);
  }
  return problems;
}

function checkPlanets(level: Level): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  level.planets.forEach((planet, index) => {
    if (ids.has(planet.id)) problems.push(`duplicate planet id ${planet.id}`);
    ids.add(planet.id);
    problems.push(...checkPlanet(planet, index, level.planets));
  });
  if (level.planets.length === 0) problems.push('no planets');
  return problems;
}

function checkStartAndGoal(level: Level): string[] {
  const problems: string[] = [];
  const host = level.planets.find((planet) => planet.id === level.start.planet);
  if (!host) return [`start planet "${level.start.planet}" does not exist`];
  if (host.motion) problems.push('the start planet must be stationary');
  const { goal } = level;
  if (!inside(goal, EDGE + goal.radius)) problems.push('goal is too close to the edge');
  if (goal.radius < 24 || goal.radius > 60) problems.push('goal radius out of 24-60');
  if (Math.hypot(goal.x - host.x, goal.y - host.y) < 200) problems.push('goal is too close to the start');
  for (const planet of level.planets) {
    if (minDistance(goal, planetTrack(planet)) < planet.radius + goal.radius + 20) {
      problems.push(`goal overlaps planet ${planet.id}`);
    }
  }
  const shards = level.collectibles.filter((item) => item.kind === 'shard').length;
  if (goal.requiredShards > shards) problems.push('goal needs more shards than the level has');
  return problems;
}

function pointHazardClearance(hazard: Hazard): { at: Vec; size: number } | null {
  switch (hazard.type) {
    case 'asteroid':
      return { at: hazard, size: hazard.radius + 6 };
    case 'pulse':
      return { at: hazard, size: 20 };
    default:
      return null;
  }
}

function checkHazardGeometry(hazard: Hazard, level: Level): string[] {
  const problems: string[] = [];
  const tag = `${hazard.type} ${hazard.id}`;
  const point = pointHazardClearance(hazard);
  if (point) {
    if (!inside(point.at, 10)) problems.push(`${tag}: outside the playfield`);
    for (const planet of level.planets) {
      if (minDistance(point.at, planetTrack(planet)) < planetKeepOut(planet) + point.size) {
        problems.push(`${tag}: blocks planet ${planet.id}`);
      }
    }
    if (Math.hypot(point.at.x - level.goal.x, point.at.y - level.goal.y) < level.goal.radius + point.size + 10) {
      problems.push(`${tag}: sits on the portal`);
    }
  }
  return problems;
}

function checkTimed(hazard: Hazard): string[] {
  if (hazard.type !== 'laser' && hazard.type !== 'pulse') return [];
  const tag = `${hazard.type} ${hazard.id}`;
  const problems: string[] = [];
  if (hazard.warn < TICK_RATE / 2) problems.push(`${tag}: warning shorter than half a second`);
  if (hazard.on < TICK_RATE / 3) problems.push(`${tag}: firing shorter than a third of a second`);
  if (hazard.warn + hazard.on > hazard.period) problems.push(`${tag}: warn + on exceeds the period`);
  if (hazard.type === 'laser') {
    if (hazard.innerR >= hazard.outerR) problems.push(`${tag}: innerR must be less than outerR`);
    if (hazard.width <= 0 || hazard.width >= Math.PI) problems.push(`${tag}: width out of (0, pi)`);
  }
  return problems;
}

function span(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function checkGate(gate: Extract<Hazard, { type: 'gate' }>, level: Level): string[] {
  const tag = `gate ${gate.id}`;
  const missing = gate.opensWith.filter((id) => !level.collectibles.some((item) => item.id === id));
  const problems = missing.map((id) => `${tag}: opened by unknown collectible ${id}`);
  if (gate.opensWith.length === 0) problems.push(`${tag}: nothing opens it`);
  const length = span(gate.a, gate.b);
  if (outside(length, 40, 420)) problems.push(`${tag}: length ${Math.round(length)} out of 40-420`);
  return problems;
}

function checkWormhole(hole: Extract<Hazard, { type: 'wormhole' }>): string[] {
  const tag = `wormhole ${hole.id}`;
  if (span(hole.a, hole.b) < 120) return [`${tag}: mouths are too close together`];
  if (!inside(hole.a, 10) || !inside(hole.b, 10)) return [`${tag}: a mouth is outside the playfield`];
  return [];
}

function checkLinked(hazard: Hazard, level: Level): string[] {
  switch (hazard.type) {
    case 'satellite':
      return hazard.around && !level.planets.some((p) => p.id === hazard.around)
        ? [`satellite ${hazard.id}: orbits unknown planet ${hazard.around}`]
        : [];
    case 'gate':
      return checkGate(hazard, level);
    case 'wormhole':
      return checkWormhole(hazard);
    default:
      return [];
  }
}

function checkHazards(level: Level): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const hazard of level.hazards) {
    if (ids.has(hazard.id)) problems.push(`duplicate hazard id ${hazard.id}`);
    ids.add(hazard.id);
    problems.push(...checkHazardGeometry(hazard, level), ...checkTimed(hazard), ...checkLinked(hazard, level));
  }
  return problems;
}

function satelliteTrack(rt: LevelRuntime, sat: Satellite): Vec[] {
  const track: Vec[] = [];
  for (let tick = 0; tick <= SAMPLE_SPAN; tick += SAMPLE_STEP) track.push(satellitePosition(rt, sat, tick));
  return track;
}

function checkCollectibleClearance(item: Collectible, level: Level, rt: LevelRuntime): string[] {
  const problems: string[] = [];
  if (!inside(item, 14)) problems.push(`collectible ${item.id}: outside the playfield`);
  for (const planet of level.planets) {
    if (minDistance(item, planetTrack(planet)) < planet.radius + 14) problems.push(`${item.id} is inside a planet`);
  }
  for (const rock of rt.asteroids) {
    if (span(item, rock) < rock.radius + 26) problems.push(`${item.id} touches ${rock.id}`);
  }
  for (const sat of rt.satellites) {
    if (minDistance(item, satelliteTrack(rt, sat)) < sat.radius + 20) problems.push(`${item.id} is on a satellite path`);
  }
  return problems;
}

function checkCollectibles(level: Level): string[] {
  const problems: string[] = [];
  const rt = buildRuntime(level);
  const ids = new Set<string>();
  for (const item of level.collectibles) {
    if (ids.has(item.id)) problems.push(`duplicate collectible id ${item.id}`);
    ids.add(item.id);
    problems.push(...checkCollectibleClearance(item, level, rt));
  }
  return problems;
}

function checkProgress(level: Level): string[] {
  const problems: string[] = [];
  const { solution, par } = level;
  const launches = solution.launchTicks.length;
  if (launches < 1) problems.push('solution has no launches');
  const ticksList = solution.launchTicks;
  const increasing = ticksList.every((tick, i) => Number.isInteger(tick) && tick > (ticksList[i - 1] ?? 0));
  if (!increasing) problems.push('solution launch ticks must be increasing integers');
  if (par.launches < launches) problems.push('par launches is below the verified solution (no 2 stars possible)');
  if (par.seconds < solution.totalTicks / TICK_RATE) problems.push('par seconds is below the verified solution');
  if (solution.shards < level.goal.requiredShards) problems.push('solution does not collect the required shards');
  if (level.tutorialHint !== null && level.tutorialHint.trim().length === 0) problems.push('tutorialHint is blank');
  return problems;
}

/** Every structural problem found in a level; an empty list means the level is well-formed. */
export function validateLevel(level: Level): string[] {
  return [
    ...checkIdentity(level),
    ...checkPlanets(level),
    ...checkStartAndGoal(level),
    ...checkHazards(level),
    ...checkCollectibles(level),
    ...checkProgress(level),
  ];
}

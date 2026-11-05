import type { HazardType, Level } from './types';
import { HAZARD_TYPES } from './types';

const CELL = 60;
const SHORT: Record<HazardType, string> = {
  asteroid: 'ast',
  satellite: 'sat',
  laser: 'las',
  pulse: 'pul',
  inversion: 'inv',
  wormhole: 'wrm',
  gate: 'gat',
};

/** Counts of every mechanic in a level, e.g. "P4|mov1|ast2|sat0|...|S2|R1|L3". Two levels can share one. */
export function mechanicFingerprint(level: Level): string {
  const counts = HAZARD_TYPES.map((type) => `${SHORT[type]}${level.hazards.filter((h) => h.type === type).length}`);
  const moving = level.planets.filter((planet) => planet.motion).length;
  const shards = level.collectibles.filter((item) => item.kind === 'shard').length;
  return [
    `P${level.planets.length}`,
    `mov${moving}`,
    ...counts,
    `S${shards}`,
    `R${level.goal.requiredShards}`,
    `L${level.solution.launchTicks.length}`,
  ].join('|');
}

function cell(x: number, y: number, tag: string): string {
  return `${tag}:${Math.round(x / CELL)},${Math.round(y / CELL)}`;
}

/** The set of coarse grid cells that hold something, tagged by kind: a layout signature for similarity checks. */
export function layoutCells(level: Level): Set<string> {
  const cells = new Set<string>([cell(level.goal.x, level.goal.y, 'goal')]);
  for (const planet of level.planets) cells.add(cell(planet.x, planet.y, 'planet'));
  for (const item of level.collectibles) cells.add(cell(item.x, item.y, item.kind));
  for (const hazard of level.hazards) {
    if ('x' in hazard) cells.add(cell(hazard.x, hazard.y, hazard.type));
    else if ('cx' in hazard) cells.add(cell(hazard.cx, hazard.cy, hazard.type));
    else if ('a' in hazard) cells.add(cell(hazard.a.x, hazard.a.y, hazard.type));
  }
  return cells;
}

/** Jaccard similarity of two layouts, 0 (nothing in common) to 1 (identical). */
export function layoutSimilarity(a: Level, b: Level): number {
  const left = layoutCells(a);
  const right = layoutCells(b);
  let shared = 0;
  for (const key of left) if (right.has(key)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Exact layout identity: positions rounded to whole units, in a stable order. */
export function layoutSignature(level: Level): string {
  const round = (n: number): number => Math.round(n);
  const parts = [
    ...level.planets.map((p) => `P${round(p.x)},${round(p.y)},${round(p.radius)}`),
    ...level.hazards.map((h) => `${h.type}:${h.id}`),
    `G${round(level.goal.x)},${round(level.goal.y)}`,
    ...level.collectibles.map((c) => `C${round(c.x)},${round(c.y)}`),
  ];
  return parts.join(';');
}

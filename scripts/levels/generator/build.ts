import type { Hazard, Level, Solution } from '../../../src/game/levels/types';
import { LEVEL_SCHEMA_VERSION, WORLD_HEIGHT, WORLD_WIDTH } from '../../../src/game/levels/types';
import { validateLevel } from '../../../src/game/levels/validate';
import { verifySolution } from '../../../src/game/levels/verify';
import { replayLaunches } from '../../../src/game/simulation/flight';
import { buildRuntime } from '../../../src/game/simulation/runtime';
import { shardCount } from '../../../src/game/simulation/state';
import { DEFAULT_SOLVER, solveLevel, type SolverOptions } from '../../../src/game/tools/solver';
import { addCollectibles } from './collect';
import { buildFeature, type FeatureContext } from './features';
import { samplePath } from './path';
import { placeLayout } from './placement';
import type { Recipe } from './recipes';
import { makeRng, seedFor, type Rng } from './rng';

export interface BuildStats {
  attempts: number;
  launches: number;
  minWindow: number;
  nodes: number;
}

export interface Built {
  level: Level;
  stats: BuildStats;
}

const NO_SOLUTION: Solution = { launchTicks: [], totalTicks: 0, shards: 0, minWindow: 0, solver: 'pending' };

function solverOptions(recipe: Recipe): SolverOptions {
  return { ...DEFAULT_SOLVER, maxLaunches: 8, minWindow: recipe.minWindow, maxNodes: 500, beam: 30 };
}

function draft(recipe: Recipe, seed: number, rng: Rng): Level | null {
  const layout = placeLayout(rng, recipe);
  if (!layout) return null;
  return {
    schema: LEVEL_SCHEMA_VERSION,
    id: recipe.id,
    chapter: recipe.chapter,
    index: recipe.index,
    name: recipe.name,
    seed,
    bounds: { w: WORLD_WIDTH, h: WORLD_HEIGHT },
    start: layout.start,
    // The plain layout is solved before shards exist, so its portal must be open; the requirement is applied after.
    goal: { ...layout.goal, requiredShards: 0 },
    planets: layout.planets,
    hazards: [],
    collectibles: [],
    par: { launches: 1, seconds: 1 },
    tutorialHint: recipe.tutorialHint,
    solution: NO_SOLUTION,
  };
}

function addHazards(ctx: FeatureContext, recipe: Recipe): Hazard[] | null {
  for (const feature of recipe.features) {
    for (let n = 0; n < feature.count; n++) {
      const hazard = buildFeature(ctx, feature.kind);
      if (!hazard) return null;
      ctx.hazards.push(hazard);
    }
  }
  return ctx.hazards;
}

/** Does the hazard-free route still win? If it does, the hazards changed nothing and the level teaches nothing. */
function hazardsMatter(baseline: Solution, withHazards: Level): boolean {
  return !replayLaunches(buildRuntime(withHazards), baseline.launchTicks).won;
}

function usesEveryWormhole(level: Level, solution: Solution): boolean {
  const holes = level.hazards.filter((hazard) => hazard.type === 'wormhole').map((hazard) => hazard.id);
  if (holes.length === 0) return true;
  const { events } = replayLaunches(buildRuntime(level), solution.launchTicks);
  const used = new Set(events.flatMap((event) => (event.type === 'teleport' ? [event.wormholeId] : [])));
  return holes.every((id) => used.has(id));
}

function finish(level: Level, solution: Solution): Level {
  const launches = solution.launchTicks.length;
  const seconds = Math.ceil((solution.totalTicks / 60) * 1.7 + 6);
  return { ...level, par: { launches: launches + (level.chapter <= 2 ? 2 : 1), seconds }, solution };
}

interface Attempt {
  level: Level;
  solution: Solution;
  nodes: number;
}

const rejects: Record<string, number> = {};

/** Counts why candidates are thrown away, so a recipe that cannot be satisfied says what is blocking it. */
function reject(why: string): null {
  rejects[why] = (rejects[why] ?? 0) + 1;
  return null;
}

export function rejectReport(): string {
  return Object.entries(rejects)
    .sort((a, b) => b[1] - a[1])
    .map(([why, n]) => `${why}: ${n}`)
    .join(', ');
}

export function resetRejectReport(): void {
  for (const key of Object.keys(rejects)) delete rejects[key];
}

function solveWithHazards(recipe: Recipe, base: Level, baseline: Solution, rng: Rng): Attempt | null {
  const ctx: FeatureContext = { rng, level: base, path: samplePath(base, baseline.launchTicks), hazards: [] };
  const hazards = addHazards(ctx, recipe);
  if (!hazards) return reject('no room to place a hazard');
  const level = { ...base, hazards: hazards.slice() };
  const solved = solveLevel(level, solverOptions(recipe));
  if (!solved.solution) return reject('no solution with the hazards');
  if (solved.solution.launchTicks.length < recipe.minLaunches) return reject('route too short');
  if (hazards.length > 0 && !hazardsMatter(baseline, level)) return reject('hazards change nothing');
  if (!usesEveryWormhole(level, solved.solution)) return reject('wormhole unused');
  return { level, solution: solved.solution, nodes: solved.nodes };
}

function attempt(recipe: Recipe, seed: number): Attempt | null {
  const rng = makeRng(seed);
  const base = draft(recipe, seed, rng);
  if (!base) return reject('layout failed');
  const baseline = solveLevel(base, solverOptions(recipe));
  if (!baseline.solution) return reject('plain layout unsolvable');
  if (recipe.features.length === 0 && baseline.solution.launchTicks.length < recipe.minLaunches) {
    return reject('route too short');
  }
  const solved =
    recipe.features.length > 0
      ? solveWithHazards(recipe, base, baseline.solution, rng)
      : { level: base, solution: baseline.solution, nodes: baseline.nodes };
  if (!solved) return null;
  const withItems = addCollectibles(
    { rng, level: solved.level, path: samplePath(solved.level, solved.solution.launchTicks), hazards: [] },
    recipe.gates,
    recipe.optionalShards,
  );
  if (!withItems) return reject('no room for shards or gates');
  const locked = { ...withItems, goal: { ...withItems.goal, requiredShards: recipe.requiredShards } };
  const solution = recordSolution(locked, solved.solution);
  return solution ? { level: locked, solution, nodes: solved.nodes } : reject('route fails after shards or gates');
}

/** Replays the route on the finished level (gates and shards included) and records what it really does. */
function recordSolution(level: Level, route: Solution): Solution | null {
  const rt = buildRuntime(level);
  const { won, state } = replayLaunches(rt, route.launchTicks);
  if (!won) return null;
  return { ...route, totalTicks: state.tick, shards: shardCount(rt, state) };
}

export function buildLevel(recipe: Recipe, isDistinct: (level: Level) => boolean, maxAttempts = 160): Built | null {
  resetRejectReport();
  for (let n = 0; n < maxAttempts; n++) {
    const result = attempt(recipe, seedFor(recipe.id, n));
    if (!result) continue;
    const level = finish(result.level, result.solution);
    const problems = validateLevel(level);
    if (problems.length > 0) {
      reject(`invalid: ${problems[0]?.replace(/\b[a-z]\d+\b/g, 'X')}`);
      continue;
    }
    if (!verifySolution(level).ok) {
      reject('verification failed');
      continue;
    }
    if (!isDistinct(level)) {
      reject('too similar to another level');
      continue;
    }
    const { solution } = level;
    const launches = solution.launchTicks.length;
    return { level, stats: { attempts: n + 1, launches, minWindow: solution.minWindow, nodes: result.nodes } };
  }
  return null;
}

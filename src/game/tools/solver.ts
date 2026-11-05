import type { Level, Solution } from '../levels/types';
import { FLIGHT_TIMEOUT_TICKS, TICK_RATE } from '../simulation/constants';
import { flyUntilDone, outcomeOf } from '../simulation/flight';
import { buildRuntime, orbitRadiusOf, type LevelRuntime } from '../simulation/runtime';
import { cloneState, createInitialState, isFinished, shardCount } from '../simulation/state';
import { stepSim } from '../simulation/step';
import type { SimState } from '../simulation/types';

export interface SolverOptions {
  maxLaunches: number;
  /** A launch only counts when this many consecutive release ticks all lead to the same result. */
  minWindow: number;
  maxNodes: number;
  /** Nodes kept per depth, nearest the portal first. */
  beam: number;
}

export const DEFAULT_SOLVER: SolverOptions = { maxLaunches: 7, minWindow: 5, maxNodes: 600, beam: 40 };

export interface SolverResult {
  solution: Solution | null;
  nodes: number;
}

interface Candidate {
  launchTick: number;
  window: number;
  end: SimState;
  goal: boolean;
}

export interface Node {
  state: SimState;
  trace: number[];
  window: number;
}

/** One trial release: where the flight ended (`key`) and the state it ended in. */
interface Probe {
  key: string;
  launchTick: number;
  end: SimState;
}

function isDynamic(rt: LevelRuntime): boolean {
  const timed = rt.satellites.length + rt.lasers.length + rt.pulses.length;
  return timed > 0 || rt.planets.some((planet) => planet.motion);
}

/** How many ticks of waiting to try: a full lap of the current orbit, or longer when things move. */
function waitBudget(rt: LevelRuntime, state: SimState): number {
  const host = state.ship.planetId ? rt.planetById.get(state.ship.planetId) : undefined;
  if (!host) return 0;
  const lap = Math.ceil(((Math.PI * 2 * orbitRadiusOf(host)) / host.orbitSpeed) * TICK_RATE) + 2;
  return Math.min(480, isDynamic(rt) ? Math.max(lap, 300) : lap);
}

function probeRelease(rt: LevelRuntime, waiting: SimState): Probe | null {
  const probe = cloneState(waiting);
  const launchTick = probe.tick + 1;
  stepSim(rt, probe, true);
  flyUntilDone(rt, probe, FLIGHT_TIMEOUT_TICKS + 2);
  const outcome = outcomeOf(probe);
  if (outcome.kind === 'goal') return { key: 'goal', launchTick, end: probe };
  if (outcome.kind === 'capture') return { key: `p:${outcome.planetId}`, launchTick, end: probe };
  return null;
}

function toCandidate(run: Probe[]): Candidate {
  const middle = run[Math.floor(run.length / 2)] as Probe;
  return { launchTick: middle.launchTick, window: run.length, end: middle.end, goal: middle.key === 'goal' };
}

/** Tries every release tick for one wait, groups consecutive ticks with the same result and keeps the wide groups. */
export function expandNode(rt: LevelRuntime, node: Node, minWindow: number): Candidate[] {
  const waiting = cloneState(node.state);
  const budget = waitBudget(rt, waiting);
  const candidates: Candidate[] = [];
  let run: Probe[] = [];
  const flush = (): void => {
    if (run.length >= minWindow) candidates.push(toCandidate(run));
    run = [];
  };
  for (let k = 0; k <= budget && !isFinished(waiting); k++) {
    const hit = probeRelease(rt, waiting);
    if (!hit || run[0]?.key !== hit.key) flush();
    if (hit) run.push(hit);
    stepSim(rt, waiting, false);
  }
  flush();
  return candidates;
}

function stateKey(rt: LevelRuntime, state: SimState): string {
  const bucket = isDynamic(rt) ? Math.floor(state.tick / 12) : 0;
  return `${state.ship.planetId}|${state.collected.slice().sort().join(',')}|${bucket}`;
}

function distanceToGoal(rt: LevelRuntime, state: SimState): number {
  return Math.hypot(state.ship.x - rt.level.goal.x, state.ship.y - rt.level.goal.y);
}

function toSolution(rt: LevelRuntime, node: Node, win: Candidate): Solution {
  return {
    launchTicks: [...node.trace, win.launchTick],
    totalTicks: win.end.tick,
    shards: shardCount(rt, win.end),
    minWindow: Math.min(node.window, win.window),
    solver: 'window-bfs-1',
  };
}

function childOf(node: Node, cand: Candidate): Node {
  return {
    state: cand.end,
    trace: [...node.trace, cand.launchTick],
    window: Math.min(node.window, cand.window),
  };
}

interface Search {
  rt: LevelRuntime;
  options: SolverOptions;
  seen: Set<string>;
  nodes: number;
}

interface DepthResult {
  best: Solution | null;
  next: Node[];
  budgetHit: boolean;
}

function visit(search: Search, node: Node, result: DepthResult): void {
  for (const cand of expandNode(search.rt, node, search.options.minWindow)) {
    if (cand.goal) {
      const found = toSolution(search.rt, node, cand);
      if (!result.best || found.minWindow > result.best.minWindow) result.best = found;
      continue;
    }
    const key = stateKey(search.rt, cand.end);
    if (search.seen.has(key)) continue;
    search.seen.add(key);
    result.next.push(childOf(node, cand));
  }
}

function searchDepth(search: Search, frontier: Node[]): DepthResult {
  const result: DepthResult = { best: null, next: [], budgetHit: false };
  for (const node of frontier) {
    if (search.nodes >= search.options.maxNodes) {
      result.budgetHit = true;
      break;
    }
    search.nodes += 1;
    visit(search, node, result);
  }
  return result;
}

/** Breadth-first search over launches: the first depth that reaches the portal gives the fewest-launch route found. */
export function solveLevel(level: Level, options: SolverOptions = DEFAULT_SOLVER): SolverResult {
  const rt = buildRuntime(level);
  const root: Node = { state: createInitialState(rt), trace: [], window: Infinity };
  const search: Search = { rt, options, seen: new Set([stateKey(rt, root.state)]), nodes: 0 };
  let frontier: Node[] = [root];
  for (let depth = 1; depth <= options.maxLaunches && frontier.length > 0; depth++) {
    const result = searchDepth(search, frontier);
    if (result.best || result.budgetHit) return { solution: result.best, nodes: search.nodes };
    result.next.sort((a, b) => distanceToGoal(rt, a.state) - distanceToGoal(rt, b.state));
    frontier = result.next.slice(0, options.beam);
  }
  return { solution: null, nodes: search.nodes };
}

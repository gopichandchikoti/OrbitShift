import type { Vec } from '../levels/types';
import type { LevelRuntime } from './runtime';
import { cloneState, createInitialState, isFinished } from './state';
import { stepSim } from './step';
import type { FlightOutcome, SimEvent, SimState } from './types';

export interface Prediction {
  /** Sampled positions of the flight, starting at the ship. */
  points: Vec[];
  outcome: FlightOutcome;
  /** Ticks the predicted flight lasted. */
  ticks: number;
}

export function outcomeOf(state: SimState): FlightOutcome {
  const { ship } = state;
  if (ship.mode === 'won') return { kind: 'goal' };
  if (ship.mode === 'dead') return { kind: 'death', reason: state.death ?? 'lost' };
  if (ship.mode === 'orbit' && ship.planetId) return { kind: 'capture', planetId: ship.planetId };
  return { kind: 'open' };
}

/** Where to record the flight path: every `stride`-th tick is appended to `points`. */
export interface PathSampler {
  points: Vec[];
  stride: number;
}

/** Runs the ship forward from a launch until it lands, wins, dies or `maxTicks` pass. Mutates `state`. */
export function flyUntilDone(rt: LevelRuntime, state: SimState, maxTicks: number, sampler?: PathSampler): number {
  let ticks = 0;
  while (state.ship.mode === 'flight' && ticks < maxTicks) {
    stepSim(rt, state, false);
    ticks += 1;
    if (sampler && ticks % sampler.stride === 0) sampler.points.push({ x: state.ship.x, y: state.ship.y });
  }
  return ticks;
}

/**
 * Predicts the flight if the player released on the very next step. It uses the same `stepSim` as the real game, so the
 * only way it can differ from the real flight is a different release tick.
 */
export function predictLaunch(rt: LevelRuntime, from: SimState, maxTicks = 150, stride = 3): Prediction {
  const probe = cloneState(from);
  const points: Vec[] = [{ x: probe.ship.x, y: probe.ship.y }];
  stepSim(rt, probe, true);
  points.push({ x: probe.ship.x, y: probe.ship.y });
  const ticks = flyUntilDone(rt, probe, maxTicks, { points, stride }) + 1;
  points.push({ x: probe.ship.x, y: probe.ship.y });
  return { points, outcome: outcomeOf(probe), ticks };
}

export interface ReplayResult {
  won: boolean;
  state: SimState;
  events: SimEvent[];
}

/** Replays a recorded run: `launchTicks` are the ticks (state.tick after the step) on which the player released. */
export function replayLaunches(rt: LevelRuntime, launchTicks: readonly number[], maxTicks = 20000): ReplayResult {
  const state = createInitialState(rt);
  const events: SimEvent[] = [];
  let next = 0;
  while (!isFinished(state) && state.tick < maxTicks) {
    const release = launchTicks[next] === state.tick + 1;
    if (release) next += 1;
    events.push(...stepSim(rt, state, release));
  }
  return { won: state.ship.mode === 'won', state, events };
}

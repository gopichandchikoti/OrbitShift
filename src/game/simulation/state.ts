import { planetPosition } from './motion';
import { orbitRadiusOf, type LevelRuntime } from './runtime';
import type { ShipState, SimState } from './types';

export function cloneState(state: SimState): SimState {
  return { ...state, ship: { ...state.ship }, collected: state.collected.slice() };
}

/** Puts the ship on the level's start orbit at tick 0. */
export function createInitialState(rt: LevelRuntime): SimState {
  const { start } = rt.level;
  const host = rt.planetById.get(start.planet);
  if (!host) throw new Error(`Level ${rt.level.id}: start planet "${start.planet}" does not exist`);
  const at = planetPosition(host, 0);
  const radius = orbitRadiusOf(host);
  const ship: ShipState = {
    mode: 'orbit',
    x: at.x + Math.cos(start.angle) * radius,
    y: at.y + Math.sin(start.angle) * radius,
    vx: 0,
    vy: 0,
    planetId: host.id,
    angle: start.angle,
    dir: start.dir,
    flightTicks: 0,
    graceId: null,
    graceTicks: 0,
    wormholeTicks: 0,
  };
  return { tick: 0, ship, collected: [], launches: 0, death: null };
}

/** Shards (not switches) collected so far. */
export function shardCount(rt: LevelRuntime, state: SimState): number {
  return state.collected.filter((id) => rt.collectibleById.get(id)?.kind === 'shard').length;
}

export function isFinished(state: SimState): boolean {
  return state.ship.mode === 'dead' || state.ship.mode === 'won';
}

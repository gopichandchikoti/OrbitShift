import type { Collectible, Hazard, Level, ShieldGate, Vec } from '../../../src/game/levels/types';
import { planetKeepOut } from '../../../src/game/levels/validate';
import { satellitePosition } from '../../../src/game/simulation/motion';
import { buildRuntime } from '../../../src/game/simulation/runtime';
import { segmentDistance } from '../../../src/game/simulation/collision';
import { freeSamples, type FeatureContext } from './features';
import type { PathSample } from './path';
import { round1 } from './rng';

const MIN_SEPARATION = 70;

function clearOfRocksAndSatellites(level: Level, at: Vec): boolean {
  const rt = buildRuntime(level);
  if (rt.asteroids.some((rock) => Math.hypot(at.x - rock.x, at.y - rock.y) < rock.radius + 34)) return false;
  return rt.satellites.every((sat) => {
    for (let tick = 0; tick <= 600; tick += 20) {
      const pos = satellitePosition(rt, sat, tick);
      if (Math.hypot(at.x - pos.x, at.y - pos.y) < sat.radius + 30) return false;
    }
    return true;
  });
}

function farFromOthers(items: Collectible[], gates: ShieldGate[], at: Vec): boolean {
  if (items.some((item) => Math.hypot(at.x - item.x, at.y - item.y) < MIN_SEPARATION)) return false;
  return gates.every((gate) => segmentDistance(at.x, at.y, gate.a, gate.b) > 40);
}

function shardAt(id: string, sample: PathSample): Collectible {
  return { id, kind: 'shard', x: round1(sample.x), y: round1(sample.y) };
}

function gateAcross(ctx: FeatureContext, sample: PathSample, opener: string, id: string): ShieldGate | null {
  const half = ctx.rng.range(62, 88);
  const a = { x: round1(sample.x + sample.ty * half), y: round1(sample.y - sample.tx * half) };
  const b = { x: round1(sample.x - sample.ty * half), y: round1(sample.y + sample.tx * half) };
  const planetsClear = ctx.level.planets.every((planet) => {
    const toSegment = segmentDistance(planet.x, planet.y, a, b);
    const toCentre = Math.hypot(sample.x - planet.x, sample.y - planet.y);
    return Math.min(toSegment, toCentre) > planetKeepOut(planet) + (planet.motion ? 130 : 12);
  });
  const inside = [a, b].every((p) => p.x > 20 && p.x < 700 && p.y > 20 && p.y < 1260);
  return planetsClear && inside ? { type: 'gate', id, a, b, opensWith: [opener] } : null;
}

function placeGatePairs(ctx: FeatureContext, free: PathSample[], count: number): Level | null {
  const items: Collectible[] = [];
  const gates: ShieldGate[] = [];
  for (let g = 0; g < count; g++) {
    const early = free.slice(0, Math.floor(free.length * 0.55)).filter((s) => clearOfRocksAndSatellites(ctx.level, s));
    const shardSample = early.length > 0 ? ctx.rng.pick(early) : null;
    if (!shardSample || !farFromOthers(items, gates, shardSample)) return null;
    const later = free.filter((s) => s.tick > shardSample.tick + 75 && farFromOthers(items, gates, s));
    const shard = shardAt(`k${g + 1}`, shardSample);
    const gate = later.length > 0 ? gateAcross(ctx, ctx.rng.pick(later), shard.id, `g${g + 1}`) : null;
    if (!gate) return null;
    items.push(shard);
    gates.push(gate);
  }
  return { ...ctx.level, collectibles: items, hazards: [...ctx.level.hazards, ...gates] };
}

function placeLooseShards(ctx: FeatureContext, free: PathSample[], base: Level, count: number): Collectible[] | null {
  const items = base.collectibles.slice();
  const gates = base.hazards.filter((h): h is ShieldGate => h.type === 'gate');
  for (let n = 0; n < count; n++) {
    const choices = free.filter((s) => farFromOthers(items, gates, s) && clearOfRocksAndSatellites(base, s));
    if (choices.length === 0) return null;
    items.push(shardAt(`k${items.length + 1}`, ctx.rng.pick(choices)));
  }
  return items;
}

/**
 * Adds the level's shards and gates along the verified route, so each is reachable by the recorded solution.
 * Required shards come with a gate each: the gate sits later on the route and opens when its shard is collected.
 */
export function addCollectibles(ctx: FeatureContext, gates: number, optional: number): Level | null {
  const free = freeSamples(ctx, 24);
  if (free.length < 12) return null;
  const withGates = gates > 0 ? placeGatePairs(ctx, free, gates) : ctx.level;
  if (!withGates) return null;
  const items = placeLooseShards(ctx, free, withGates, optional);
  return items ? { ...withGates, collectibles: items } : null;
}

export function gatesOf(hazards: Hazard[]): ShieldGate[] {
  return hazards.filter((hazard): hazard is ShieldGate => hazard.type === 'gate');
}

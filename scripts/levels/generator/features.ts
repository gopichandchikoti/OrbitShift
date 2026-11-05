import type { Hazard, Level, Planet, Vec } from '../../../src/game/levels/types';
import { planetKeepOut } from '../../../src/game/levels/validate';
import { planetPosition } from '../../../src/game/simulation/motion';
import type { FeatureKind } from './recipes';
import { round1, type Rng } from './rng';
import type { PathSample } from './path';

export interface FeatureContext {
  rng: Rng;
  level: Level;
  path: PathSample[];
  hazards: Hazard[];
}

const TAU = Math.PI * 2;

function nextId(ctx: FeatureContext, prefix: string): string {
  return `${prefix}${ctx.hazards.filter((hazard) => hazard.id.startsWith(prefix)).length + 1}`;
}

function planetClearance(planet: Planet, at: Vec, margin: number): boolean {
  const ground = planetPosition(planet, 0);
  const swing = planet.motion ? 130 : 0;
  return Math.hypot(at.x - ground.x, at.y - ground.y) >= planetKeepOut(planet) + margin + swing;
}

/** Route samples that sit well away from every planet and from the portal: safe places to put a hazard. */
export function freeSamples(ctx: FeatureContext, margin: number): PathSample[] {
  const { planets, goal } = ctx.level;
  return ctx.path.filter(
    (sample) =>
      planets.every((planet) => planetClearance(planet, sample, margin)) &&
      Math.hypot(sample.x - goal.x, sample.y - goal.y) > goal.radius + margin + 30,
  );
}

function pickSample(ctx: FeatureContext, margin: number): PathSample | null {
  const free = freeSamples(ctx, margin);
  return free.length > 0 ? ctx.rng.pick(free) : null;
}

function offsetFrom(sample: PathSample, distance: number): Vec {
  return { x: sample.x - sample.ty * distance, y: sample.y + sample.tx * distance };
}

function asteroid(ctx: FeatureContext): Hazard | null {
  const sample = pickSample(ctx, 40);
  if (!sample) return null;
  const at = offsetFrom(sample, ctx.rng.range(-20, 20));
  return {
    type: 'asteroid',
    id: nextId(ctx, 'a'),
    x: round1(at.x),
    y: round1(at.y),
    radius: ctx.rng.int(17, 27),
    seed: ctx.rng.int(1, 99999),
  };
}

function satellite(ctx: FeatureContext): Hazard | null {
  const { rng, level } = ctx;
  const host = rng.pick(level.planets.slice(level.planets.length > 2 ? 1 : 0));
  return {
    type: 'satellite',
    id: nextId(ctx, 's'),
    around: host.id,
    cx: host.x,
    cy: host.y,
    orbit: round1(planetKeepOut(host) + rng.range(24, 58)),
    omega: round1(rng.sign() * rng.range(0.9, 1.6)),
    phase: round1(rng.range(0, TAU)),
    radius: 11,
  };
}

function laser(ctx: FeatureContext): Hazard | null {
  const { rng } = ctx;
  const sample = pickSample(ctx, 30);
  if (!sample) return null;
  const inner = rng.int(70, 108);
  const outer = inner + rng.int(32, 46);
  const pivot = offsetFrom(sample, rng.sign() * ((inner + outer) / 2));
  if (pivot.x < 40 || pivot.x > 680 || pivot.y < 40 || pivot.y > 1240) return null;
  return {
    type: 'laser',
    id: nextId(ctx, 'l'),
    cx: round1(pivot.x),
    cy: round1(pivot.y),
    innerR: inner,
    outerR: outer,
    width: round1(rng.range(0.55, 0.95)),
    omega: round1(rng.sign() * rng.range(0.45, 0.85)),
    phase: round1(rng.range(0, TAU)),
    period: rng.pick([240, 270, 300]),
    warn: 66,
    on: rng.pick([70, 90]),
  };
}

function pulse(ctx: FeatureContext): Hazard | null {
  const { rng } = ctx;
  const sample = pickSample(ctx, 50);
  if (!sample) return null;
  const at = offsetFrom(sample, rng.sign() * rng.range(45, 85));
  return {
    type: 'pulse',
    id: nextId(ctx, 'u'),
    x: round1(at.x),
    y: round1(at.y),
    radius: rng.int(120, 150),
    strength: rng.int(750, 1000),
    period: rng.pick([270, 300, 330]),
    warn: 70,
    on: 80,
  };
}

function inversion(ctx: FeatureContext): Hazard | null {
  const { rng, level } = ctx;
  const pulled = ctx.path.filter((sample) =>
    level.planets.some((planet) => {
      const gap = Math.hypot(sample.x - planet.x, sample.y - planet.y);
      return !planet.motion && gap > planetKeepOut(planet) + 30 && gap < planet.influence - 20;
    }),
  );
  if (pulled.length === 0) return null;
  const sample = rng.pick(pulled);
  return {
    type: 'inversion',
    id: nextId(ctx, 'i'),
    x: round1(sample.x),
    y: round1(sample.y),
    radius: rng.int(62, 92),
  };
}

function wormhole(ctx: FeatureContext): Hazard | null {
  const { rng } = ctx;
  const free = freeSamples(ctx, 40);
  const hops = Math.max(...free.map((sample) => sample.hop), 0);
  const early = free.filter((sample) => sample.hop === 0);
  const late = free.filter((sample) => sample.hop >= Math.max(1, hops));
  if (early.length === 0 || late.length === 0) return null;
  const from = rng.pick(early);
  const to = rng.pick(late);
  const exit = offsetFrom(to, rng.range(-90, 90));
  if (Math.hypot(exit.x - from.x, exit.y - from.y) < 160) return null;
  return {
    type: 'wormhole',
    id: nextId(ctx, 'w'),
    a: { x: round1(from.x), y: round1(from.y) },
    b: { x: round1(exit.x), y: round1(exit.y) },
    radius: 26,
    rotate: round1(rng.pick([0, 0, Math.PI / 2, -Math.PI / 2, Math.PI / 4])),
    speedScale: 1,
  };
}

const BUILDERS: Record<FeatureKind, (ctx: FeatureContext) => Hazard | null> = {
  asteroid,
  satellite,
  laser,
  pulse,
  inversion,
  wormhole,
};

export function buildFeature(ctx: FeatureContext, kind: FeatureKind): Hazard | null {
  return BUILDERS[kind](ctx);
}

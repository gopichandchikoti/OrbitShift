/**
 * Runtime schema for the level contract (zod). It is a dev/CI tool: only the check script and tests import it, so it
 * is never part of the game bundle. `z.ZodType<Level>` makes the compiler prove that the schema and the TypeScript
 * type in ./types.ts describe the same shape.
 */
import { z } from 'zod';
import type { Hazard, Level, PlanetMotion } from './types';

const num = z.number().finite();
const vec = z.object({ x: num, y: num }).strict();
const id = z.string().min(1).max(24);

const motion: z.ZodType<PlanetMotion> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('orbit'), cx: num, cy: num, radius: num.positive(), omega: num, phase: num }).strict(),
  z
    .object({ kind: z.literal('ping'), ax: num, ay: num, bx: num, by: num, period: num.positive(), phase: num })
    .strict(),
]);

const planet = z
  .object({
    id,
    x: num,
    y: num,
    radius: num.positive(),
    gravity: num.positive(),
    influence: num.positive(),
    orbitSpeed: num.positive(),
    style: z.number().int(),
    motion: motion.optional(),
  })
  .strict();

const ticks = z.number().int().positive();

const hazard: z.ZodType<Hazard> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('asteroid'), id, x: num, y: num, radius: num.positive(), seed: z.number().int() }).strict(),
  z
    .object({
      type: z.literal('satellite'),
      id,
      around: id.optional(),
      cx: num,
      cy: num,
      orbit: num.positive(),
      omega: num,
      phase: num,
      radius: num.positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal('laser'),
      id,
      cx: num,
      cy: num,
      innerR: num.positive(),
      outerR: num.positive(),
      width: num.positive(),
      omega: num,
      phase: num,
      period: ticks,
      warn: ticks,
      on: ticks,
    })
    .strict(),
  z
    .object({
      type: z.literal('pulse'),
      id,
      x: num,
      y: num,
      radius: num.positive(),
      strength: num.positive(),
      period: ticks,
      warn: ticks,
      on: ticks,
    })
    .strict(),
  z.object({ type: z.literal('inversion'), id, x: num, y: num, radius: num.positive() }).strict(),
  z
    .object({
      type: z.literal('wormhole'),
      id,
      a: vec,
      b: vec,
      radius: num.positive(),
      rotate: num,
      speedScale: num.positive(),
    })
    .strict(),
  z.object({ type: z.literal('gate'), id, a: vec, b: vec, opensWith: z.array(id) }).strict(),
]);

export const levelSchema: z.ZodType<Level> = z
  .object({
    schema: z.literal(1),
    id: z.number().int(),
    chapter: z.number().int(),
    index: z.number().int(),
    name: z.string(),
    seed: z.number().int(),
    bounds: z.object({ w: num, h: num }).strict(),
    start: z.object({ planet: id, angle: num, dir: z.union([z.literal(1), z.literal(-1)]) }).strict(),
    goal: z.object({ x: num, y: num, radius: num.positive(), requiredShards: z.number().int().min(0) }).strict(),
    planets: z.array(planet),
    hazards: z.array(hazard),
    collectibles: z.array(z.object({ id, kind: z.enum(['shard', 'switch']), x: num, y: num }).strict()),
    par: z.object({ launches: z.number().int().positive(), seconds: num.positive() }).strict(),
    tutorialHint: z.string().nullable(),
    solution: z
      .object({
        launchTicks: z.array(ticks),
        totalTicks: ticks,
        shards: z.number().int().min(0),
        minWindow: z.number().int().min(0),
        solver: z.string(),
      })
      .strict(),
  })
  .strict();

export interface Rng {
  next(): number;
  range(low: number, high: number): number;
  int(low: number, high: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  sign(): 1 | -1;
}

/** mulberry32: a tiny, well-distributed seeded generator, so a level's seed reproduces it exactly. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (low: number, high: number): number => low + next() * (high - low);
  return {
    next,
    range,
    int: (low, high) => Math.floor(range(low, high + 1)),
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
    chance: (probability) => next() < probability,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** Mixes a level id and an attempt number into one 32-bit seed. */
export function seedFor(levelId: number, attempt: number): number {
  return (Math.imul(levelId, 0x9e3779b1) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

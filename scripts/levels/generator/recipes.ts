import { levelId } from '../../../src/game/levels/chapters';

export type FeatureKind = 'asteroid' | 'satellite' | 'laser' | 'pulse' | 'inversion' | 'wormhole';

export interface Feature {
  kind: FeatureKind;
  count: number;
}

/** Everything the layout builder and the acceptance test need to know about one level. */
export interface Recipe {
  id: number;
  chapter: number;
  index: number;
  name: string;
  tutorialHint: string | null;
  /** Planets on the intended route, start included. */
  hops: number;
  decoys: number;
  movingPlanets: number;
  features: Feature[];
  /** Gates, each opened by its own shard. */
  gates: number;
  /** Shards the portal needs. */
  requiredShards: number;
  optionalShards: number;
  minLaunches: number;
  /** Every launch in the verified route must tolerate at least this many ticks of timing error. */
  minWindow: number;
}

const NAMES: readonly (readonly string[])[] = [
  ['Lift', 'Handoff', 'Second Wind', 'Slingshot', 'Open Water', 'Long Arc', 'Quiet Zone', 'Three Hops', 'Tide Line', 'Home Stretch'],
  ['Binary', 'Tug of War', 'Fork', 'Saddle Point', 'Lagrange', 'Counterweight', 'Crosswind', 'Pair Bond', 'Triple Point', 'Eclipse'],
  ['Picket', 'Patrol', 'Gap Year', 'Tollgate', 'Orbit Lane', 'Escort', 'Crossfire', 'Relay', 'Convoy', 'Blockade'],
  ['First Sweep', 'Slow Burn', 'Lighthouse', 'Scanline', 'Turnstile', 'Pendulum', 'Afterimage', 'Spotlight', 'Strobe', 'Aperture'],
  ['Drift', 'Tidal Lock', 'Elliptic', 'Wanderer', 'Pursuit', 'Carousel', 'Lead the Target', 'Ferry', 'Mirage', 'Perihelion'],
  ['Flip Side', 'Inverse Square', 'Backwash', 'Negative Space', 'Bounce', 'Mirrorball', 'Repel Lane', 'Antipode', 'Rebound', 'Zero Point'],
  ['Heartbeat', 'Shockwave', 'Ripple', 'Bellows', 'Surge', 'Offbeat', 'Pressure Door', 'Breakwater', 'Resonance', 'Aftershock'],
  ['Pinch', 'Seam', 'Fold', 'Bridge', 'Keyhole', 'Turnaround', 'Skew', 'Throughline', 'Origami', 'Hairpin'],
  ['First Key', 'Lockstep', 'Vault', 'Two Keys', 'Cipher', 'Tumbler', 'Combination', 'Warden', 'Strongbox', 'Skeleton Key'],
  ['Clockwork', 'Escapement', 'Gearbox', 'Flywheel', 'Regulator', 'Piston', 'Governor', 'Assembly', 'Linkage', 'Overdrive'],
  ['Shakedown', 'Long Haul', 'Fuel Economy', 'Glide Path', 'Switchback', 'Deep Run', 'Light Touch', 'Marathon', 'Narrow Margin', 'Flagship'],
  ['Horizon', 'Redshift', 'Accretion', 'Photon Ring', 'Tidal Wave', 'Singularity', 'Ergosphere', 'Spaghettify', 'Last Light', 'Event Horizon'],
];

const HINTS: Record<number, string> = {
  1: 'Hold to aim, release to launch. The dotted line shows where you will fly.',
  2: 'Land on a planet to orbit it, then launch again.',
  11: 'Several worlds pull at once. The preview already includes every pull.',
  21: 'Satellites are lethal. Launch in the gap between passes.',
  31: 'A dashed beam is a warning. It fires when the outline turns solid.',
  41: 'Planets move. The preview follows them, so release when it lands.',
  51: 'Inside the dashed zone, gravity pushes instead of pulls.',
  61: 'Pulses shove you away. Watch the ring tighten before it fires.',
  71: 'Enter one wormhole mouth and leave by the other, still moving.',
  81: 'Collect every shard to open the portal. Gates open with their shard.',
  91: 'Several hazards run together. Read each one on its own.',
  101: 'Par launches earn the second star. Fewer launches, cleaner routes.',
  111: 'No new rules. Trust the preview.',
};

const FAMILIES: readonly FeatureKind[] = ['asteroid', 'satellite', 'laser', 'pulse', 'inversion', 'wormhole'];

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

function intro(index: number, cap: number): number {
  return clamp(1 + Math.floor((index - 1) / 4), 1, cap);
}

function rotate(index: number, shift: number): FeatureKind {
  return FAMILIES[(index + shift) % FAMILIES.length] as FeatureKind;
}

/** One wormhole pair per level: the route has to use every pair, and two is more than most layouts can honour. */
function capWormholes(features: Feature[]): Feature[] {
  return features.map((feature) => (feature.kind === 'wormhole' ? { ...feature, count: 1 } : feature));
}

/** The hazards a level carries. Chapters 1-9 teach one family each; 10-12 mix families by a fixed rotation. */
function featuresFor(chapter: number, index: number): Feature[] {
  return capWormholes(rawFeaturesFor(chapter, index));
}

const one = (kind: FeatureKind, count = 1): Feature => ({ kind, count });

/** Hazards per chapter, as a function of the level's index (1-10) within it. */
const FEATURE_RULES: Record<number, (index: number) => Feature[]> = {
  2: (i) => (i >= 5 ? [one('asteroid', intro(i - 4, 2))] : []),
  3: (i) => [one('satellite', intro(i, 3)), ...(i >= 7 ? [one('asteroid')] : [])],
  4: (i) => [one('laser', intro(i, 2))],
  5: (i) => (i >= 6 ? [one('asteroid')] : []),
  6: (i) => [one('inversion', intro(i, 2))],
  7: (i) => [one('pulse', intro(i, 2))],
  8: (i) => [one('wormhole'), ...(i >= 7 ? [one('asteroid')] : [])],
  9: (i) => (i >= 6 ? [one('asteroid', i >= 9 ? 2 : 1)] : []),
  10: (i) => [one(rotate(i, 0), intro(i, 2)), one(rotate(i, 2))].filter((f) => f.kind !== 'wormhole' || i > 4),
  11: (i) => [one(rotate(i, 1), intro(i, 2)), one(rotate(i, 3))],
  12: (i) => [one(rotate(i, 0), intro(i, 2)), one(rotate(i, 1)), one(rotate(i, 3))],
};

function rawFeaturesFor(chapter: number, index: number): Feature[] {
  return FEATURE_RULES[chapter]?.(index) ?? [];
}

function gatesFor(chapter: number, index: number): number {
  if (chapter === 9) return index >= 4 ? 2 : 1;
  if (chapter === 10) return index % 3 === 0 ? 1 : 0;
  if (chapter === 11) return index % 2 === 0 ? 1 : 0;
  return chapter === 12 && index >= 5 ? 1 : 0;
}

function movingFor(chapter: number, index: number): number {
  if (chapter === 5) return intro(index, 3);
  if (chapter === 9) return index >= 8 ? 1 : 0;
  if (chapter === 10) return index >= 5 ? 1 : 0;
  if (chapter === 11) return index % 3 === 0 ? 1 : 0;
  return chapter === 12 ? clamp(Math.floor(index / 4), 0, 2) : 0;
}

/**
 * Smallest timing window (ticks) every launch of the verified route must allow. A longer shot has a narrower window,
 * so a higher requirement forces the route to hop between planets instead of skipping them. Hazards add their own
 * timing pressure, so the requirement relaxes as they arrive.
 */
function windowFor(chapter: number): number {
  if (chapter <= 2) return 12;
  if (chapter === 3) return 10;
  if (chapter <= 6) return 8;
  return chapter <= 9 ? 6 : 5;
}

/** Planets on the route. Level 1 is a single shot; each chapter and each fourth level asks for one more hop. */
function hopsFor(id: number, chapter: number, index: number): number {
  if (id === 1) return 1;
  return clamp(2 + Math.floor(chapter / 4) + Math.floor(index / 4), 2, 6);
}

/**
 * Launches a route must need. With five or more planets the solver can legitimately skip one, so the expectation
 * eases by a launch: asking for more would only select layouts where the geometry happens to forbid every shortcut.
 */
function minLaunchesFor(hops: number): number {
  if (hops <= 2) return hops;
  return hops <= 4 ? hops - 1 : 3;
}

export function recipeFor(chapter: number, index: number): Recipe {
  const hops = hopsFor(levelId(chapter, index), chapter, index);
  const gates = gatesFor(chapter, index);
  const requiredShards = gates > 0 ? gates : 0;
  return {
    id: levelId(chapter, index),
    chapter,
    index,
    name: (NAMES[chapter - 1] as readonly string[])[index - 1] as string,
    tutorialHint: HINTS[levelId(chapter, index)] ?? null,
    hops,
    decoys: chapter === 2 ? 1 + Math.floor(index / 3) : chapter >= 3 ? Math.floor(index / 5) : index >= 6 ? 1 : 0,
    movingPlanets: movingFor(chapter, index),
    features: featuresFor(chapter, index),
    gates,
    requiredShards,
    optionalShards: 1 + (index % 3 === 0 ? 1 : 0),
    minLaunches: minLaunchesFor(hops),
    minWindow: windowFor(chapter),
  };
}

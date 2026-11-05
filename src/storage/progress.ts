import { newlyEarned } from '../game/achievements';
import { LEVEL_COUNT } from '../game/levels/chapters';
import type { Stars } from '../game/levels/stars';
import {
  emptyProgress,
  recordOf,
  unlockedUpTo,
  type LevelRecord,
  type Progress,
} from './progress-model';
import { SaveSlot, type SaveSpec } from './save-slot';
import type { KeyValueStore } from './store';

export const PROGRESS_VERSION = 1;
export const PROGRESS_KEY = 'orbit-shift.progress';

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function sanitizeRecord(raw: unknown): LevelRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const stars = data.stars;
  if (stars !== 1 && stars !== 2 && stars !== 3) return null;
  const bestTicks = count(data.bestTicks);
  if (bestTicks < 1) return null;
  return { stars, bestTicks, bestLaunches: Math.max(1, count(data.bestLaunches)), bestShards: count(data.bestShards) };
}

function sanitizeLevels(raw: unknown): Progress['levels'] {
  const levels: Progress['levels'] = {};
  if (typeof raw !== 'object' || raw === null) return levels;
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(key);
    const record = sanitizeRecord(value);
    if (Number.isInteger(id) && id >= 1 && id <= LEVEL_COUNT && record) levels[String(id)] = record;
  }
  return levels;
}

function sanitizeAchievements(raw: unknown): Progress['achievements'] {
  const earned: Progress['achievements'] = {};
  if (typeof raw !== 'object' || raw === null) return earned;
  for (const [id, at] of Object.entries(raw)) if (typeof at === 'number' && Number.isFinite(at)) earned[id] = at;
  return earned;
}

export function sanitizeProgress(raw: unknown): Progress | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const stats = (typeof data.stats === 'object' && data.stats !== null ? data.stats : {}) as Record<string, unknown>;
  const last = count(data.lastLevel);
  return {
    levels: sanitizeLevels(data.levels),
    achievements: sanitizeAchievements(data.achievements),
    stats: { restarts: count(stats.restarts), deaths: count(stats.deaths), launches: count(stats.launches) },
    lastLevel: last >= 1 && last <= LEVEL_COUNT ? last : 1,
    tutorialDone: data.tutorialDone === true,
  };
}

export interface CompletionInput {
  levelId: number;
  stars: Stars;
  ticks: number;
  launches: number;
  shards: number;
}

export interface CompletionResult {
  firstClear: boolean;
  improved: { stars: boolean; time: boolean; launches: boolean };
  achievements: string[];
  /** The next level, when this clear just unlocked it. */
  unlocked: number | null;
}

/** Keeps the best of every measure separately, so a worse replay never erases a better earlier one. */
function mergeRecord(previous: LevelRecord | undefined, input: CompletionInput): LevelRecord {
  return {
    stars: Math.max(previous?.stars ?? 1, input.stars) as Stars,
    bestTicks: Math.min(previous?.bestTicks ?? Infinity, input.ticks),
    bestLaunches: Math.min(previous?.bestLaunches ?? Infinity, input.launches),
    bestShards: Math.max(previous?.bestShards ?? 0, input.shards),
  };
}

function improvements(previous: LevelRecord | undefined, record: LevelRecord): CompletionResult['improved'] {
  if (!previous) return { stars: true, time: true, launches: true };
  return {
    stars: record.stars > previous.stars,
    time: record.bestTicks < previous.bestTicks,
    launches: record.bestLaunches < previous.bestLaunches,
  };
}

/** Owns the player's progress. Every change is written straight away, so a completed level survives a kill. */
export class ProgressStore {
  private readonly slot: SaveSlot<Progress>;
  private progress: Progress;
  readonly recovered: boolean;

  constructor(
    store: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {
    const spec: SaveSpec<Progress> = {
      key: PROGRESS_KEY,
      version: PROGRESS_VERSION,
      defaults: emptyProgress,
      migrate: (data) => data,
      validate: sanitizeProgress,
    };
    this.slot = new SaveSlot(store, spec);
    const loaded = this.slot.load();
    this.progress = loaded.value;
    this.recovered = loaded.recovered;
  }

  get(): Progress {
    return this.progress;
  }

  recordCompletion(input: CompletionInput): CompletionResult {
    const before = unlockedUpTo(this.progress);
    const previous = recordOf(this.progress, input.levelId);
    const record = mergeRecord(previous, input);
    this.progress.levels[String(input.levelId)] = record;
    this.progress.lastLevel = input.levelId;
    this.progress.stats.launches += input.launches;
    const achievements = this.award();
    const after = unlockedUpTo(this.progress);
    return {
      firstClear: previous === undefined,
      improved: improvements(previous, record),
      achievements,
      unlocked: after > before ? after : null,
    };
  }

  noteRestart(): string[] {
    this.progress.stats.restarts += 1;
    return this.award();
  }

  noteDeath(): void {
    this.progress.stats.deaths += 1;
    this.slot.save(this.progress);
  }

  setLastLevel(id: number): void {
    this.progress.lastLevel = id;
    this.slot.save(this.progress);
  }

  markTutorialDone(): void {
    if (this.progress.tutorialDone) return;
    this.progress.tutorialDone = true;
    this.slot.save(this.progress);
  }

  /** Erases every record. The caller is responsible for asking the player to confirm first. */
  reset(): void {
    this.slot.clear();
    this.progress = emptyProgress();
  }

  private award(): string[] {
    const earned = newlyEarned(this.progress);
    for (const id of earned) this.progress.achievements[id] = this.now();
    this.slot.save(this.progress);
    return earned;
  }
}

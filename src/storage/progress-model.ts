import { CHAPTER_COUNT, LEVEL_COUNT, LEVELS_PER_CHAPTER, levelId } from '../game/levels/chapters';
import type { Stars } from '../game/levels/stars';

export interface LevelRecord {
  stars: Stars;
  bestTicks: number;
  bestLaunches: number;
  bestShards: number;
}

export interface ProgressStats {
  restarts: number;
  deaths: number;
  launches: number;
}

export interface Progress {
  /** Keyed by level id as a string (JSON object keys are strings). */
  levels: Record<string, LevelRecord>;
  /** Achievement id -> when it was unlocked (ms since the epoch). */
  achievements: Record<string, number>;
  stats: ProgressStats;
  /** Level most recently opened, so "Continue" can return to it. */
  lastLevel: number;
  /** True once the player has launched on the first level. */
  tutorialDone: boolean;
}

export function emptyProgress(): Progress {
  return {
    levels: {},
    achievements: {},
    stats: { restarts: 0, deaths: 0, launches: 0 },
    lastLevel: 1,
    tutorialDone: false,
  };
}

export function recordOf(progress: Progress, id: number): LevelRecord | undefined {
  return progress.levels[String(id)];
}

export function isCompleted(progress: Progress, id: number): boolean {
  return recordOf(progress, id) !== undefined;
}

/** The highest level the player may open: one past the unbroken run of completed levels from level 1. */
export function unlockedUpTo(progress: Progress): number {
  let id = 1;
  while (id < LEVEL_COUNT && isCompleted(progress, id)) id += 1;
  return id;
}

export function isUnlocked(progress: Progress, id: number): boolean {
  return id >= 1 && id <= unlockedUpTo(progress);
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.levels).reduce((sum, record) => sum + record.stars, 0);
}

export function totalShards(progress: Progress): number {
  return Object.values(progress.levels).reduce((sum, record) => sum + record.bestShards, 0);
}

export function completedCount(progress: Progress): number {
  return Object.keys(progress.levels).length;
}

function chapterRecords(progress: Progress, chapter: number): (LevelRecord | undefined)[] {
  return Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => recordOf(progress, levelId(chapter, i + 1)));
}

export function chapterCleared(progress: Progress, chapter: number): boolean {
  return chapterRecords(progress, chapter).every((record) => record !== undefined);
}

export function chapterPerfect(progress: Progress, chapter: number): boolean {
  return chapterRecords(progress, chapter).every((record) => record?.stars === 3);
}

export function chapterStars(progress: Progress, chapter: number): number {
  return chapterRecords(progress, chapter).reduce((sum, record) => sum + (record?.stars ?? 0), 0);
}

export function chapterUnlocked(progress: Progress, chapter: number): boolean {
  return chapter >= 1 && chapter <= CHAPTER_COUNT && isUnlocked(progress, levelId(chapter, 1));
}

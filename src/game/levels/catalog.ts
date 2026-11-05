import { LEVEL_COUNT, LEVELS_PER_CHAPTER } from './chapters';
import { CHAPTER_01 } from './data/chapter-01';
import { CHAPTER_02 } from './data/chapter-02';
import { CHAPTER_03 } from './data/chapter-03';
import { CHAPTER_04 } from './data/chapter-04';
import { CHAPTER_05 } from './data/chapter-05';
import { CHAPTER_06 } from './data/chapter-06';
import { CHAPTER_07 } from './data/chapter-07';
import { CHAPTER_08 } from './data/chapter-08';
import { CHAPTER_09 } from './data/chapter-09';
import { CHAPTER_10 } from './data/chapter-10';
import { CHAPTER_11 } from './data/chapter-11';
import { CHAPTER_12 } from './data/chapter-12';
import type { Level } from './types';

/** All 120 levels in play order: chapter 1 level 1 first, chapter 12 level 10 last. */
export const LEVELS: readonly Level[] = [
  ...CHAPTER_01,
  ...CHAPTER_02,
  ...CHAPTER_03,
  ...CHAPTER_04,
  ...CHAPTER_05,
  ...CHAPTER_06,
  ...CHAPTER_07,
  ...CHAPTER_08,
  ...CHAPTER_09,
  ...CHAPTER_10,
  ...CHAPTER_11,
  ...CHAPTER_12,
];

export function levelById(id: number): Level | undefined {
  return LEVELS[id - 1];
}

export function levelsOfChapter(chapter: number): readonly Level[] {
  return LEVELS.slice((chapter - 1) * LEVELS_PER_CHAPTER, chapter * LEVELS_PER_CHAPTER);
}

export { LEVEL_COUNT };

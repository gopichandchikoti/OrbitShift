import type { HazardType } from './types';

export interface ChapterInfo {
  id: number;
  name: string;
  /** One-line description shown on the chapter card. */
  focus: string;
  /** The hazard family this chapter introduces, if any. */
  introduces: HazardType | 'moving-planet' | null;
}

export const LEVELS_PER_CHAPTER = 10;
export const CHAPTER_COUNT = 12;
export const LEVEL_COUNT = CHAPTER_COUNT * LEVELS_PER_CHAPTER;

export const CHAPTERS: readonly ChapterInfo[] = [
  { id: 1, name: 'First Orbit', focus: 'Launch, capture and reach the portal.', introduces: null },
  { id: 2, name: 'Twin Suns', focus: 'Several wells pull at once. Pick your route.', introduces: 'asteroid' },
  { id: 3, name: 'Satellite Alley', focus: 'Time your launch around orbiting satellites.', introduces: 'satellite' },
  { id: 4, name: 'Laser Observatory', focus: 'Read the warning, then cross the sweeping beam.', introduces: 'laser' },
  { id: 5, name: 'Wandering Worlds', focus: 'Planets drift. Aim where they will be.', introduces: 'moving-planet' },
  { id: 6, name: 'Reverse Gravity', focus: 'Inside the marked zones, pulls become pushes.', introduces: 'inversion' },
  { id: 7, name: 'Pulse Fields', focus: 'Emitters shove you away on a rhythm.', introduces: 'pulse' },
  { id: 8, name: 'Folded Space', focus: 'Wormholes carry your momentum across the map.', introduces: 'wormhole' },
  { id: 9, name: 'Locked Constellations', focus: 'Collect shards to open gates and the portal.', introduces: 'gate' },
  { id: 10, name: 'Orbital Machines', focus: 'Several hazards run together. Stay precise.', introduces: null },
  { id: 11, name: 'Starship Trials', focus: 'Long routes that reward efficient launches.', introduces: null },
  { id: 12, name: 'Event Horizon', focus: 'Everything you have learned, at once.', introduces: null },
];

export function chapterOf(levelId: number): number {
  return Math.ceil(levelId / LEVELS_PER_CHAPTER);
}

export function levelId(chapter: number, index: number): number {
  return (chapter - 1) * LEVELS_PER_CHAPTER + index;
}

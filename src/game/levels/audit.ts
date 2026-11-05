import { CHAPTERS, CHAPTER_COUNT, LEVELS_PER_CHAPTER, LEVEL_COUNT } from './chapters';
import { layoutSignature, layoutSimilarity, mechanicFingerprint } from './fingerprint';
import { validateLevel } from './validate';
import { verifySolution } from './verify';
import type { HazardType, Level } from './types';

/** Two levels whose layouts overlap more than this are treated as copies of each other. */
export const MAX_LAYOUT_SIMILARITY = 0.55;
/** Each chapter must offer at least this many distinct mechanic combinations. */
export const MIN_FINGERPRINTS_PER_CHAPTER = 7;

export type MechanicFamily = HazardType | 'moving-planet';

export const REQUIRED_FAMILIES: readonly MechanicFamily[] = [
  'asteroid',
  'satellite',
  'laser',
  'moving-planet',
  'inversion',
  'pulse',
  'wormhole',
  'gate',
];

export function familiesOf(level: Level): Set<MechanicFamily> {
  const families = new Set<MechanicFamily>(level.hazards.map((hazard) => hazard.type));
  if (level.planets.some((planet) => planet.motion)) families.add('moving-planet');
  return families;
}

function auditEach(levels: readonly Level[], schemaProblems: (level: Level) => string[]): string[] {
  const problems: string[] = [];
  levels.forEach((level, index) => {
    const tag = `Level ${level.id} (${level.name})`;
    if (level.id !== index + 1) problems.push(`${tag}: out of order, expected id ${index + 1}`);
    for (const problem of schemaProblems(level)) problems.push(`${tag}: schema: ${problem}`);
    for (const problem of validateLevel(level)) problems.push(`${tag}: ${problem}`);
    for (const problem of verifySolution(level).problems) problems.push(`${tag}: solution: ${problem}`);
  });
  return problems;
}

function auditDistinct(levels: readonly Level[]): string[] {
  const problems: string[] = [];
  const names = new Set<string>();
  const signatures = new Map<string, number>();
  for (const level of levels) {
    if (names.has(level.name)) problems.push(`Level ${level.id}: duplicate name "${level.name}"`);
    names.add(level.name);
    const signature = layoutSignature(level);
    const twin = signatures.get(signature);
    if (twin !== undefined) problems.push(`Level ${level.id}: identical layout to level ${twin}`);
    signatures.set(signature, level.id);
  }
  for (let a = 0; a < levels.length; a++) {
    for (let b = a + 1; b < levels.length; b++) {
      const similarity = layoutSimilarity(levels[a] as Level, levels[b] as Level);
      if (similarity >= MAX_LAYOUT_SIMILARITY) {
        problems.push(`Levels ${levels[a]?.id} and ${levels[b]?.id} are too alike (${similarity.toFixed(2)})`);
      }
    }
  }
  return problems;
}

function chapterLevels(levels: readonly Level[], chapter: number): Level[] {
  return levels.filter((level) => level.chapter === chapter);
}

function auditChapters(levels: readonly Level[]): string[] {
  const problems: string[] = [];
  for (const info of CHAPTERS) {
    const inChapter = chapterLevels(levels, info.id);
    if (inChapter.length !== LEVELS_PER_CHAPTER) problems.push(`Chapter ${info.id}: ${inChapter.length} levels`);
    const prints = new Set(inChapter.map(mechanicFingerprint));
    if (prints.size < MIN_FINGERPRINTS_PER_CHAPTER) {
      problems.push(`Chapter ${info.id}: only ${prints.size} distinct mechanic combinations`);
    }
    // Chapter 2 introduces asteroids only from its fifth level; every other themed chapter uses its family throughout.
    if (info.introduces && info.id !== 2) {
      const missing = inChapter.filter((level) => !familiesOf(level).has(info.introduces as MechanicFamily));
      for (const level of missing) problems.push(`Level ${level.id}: chapter ${info.id} should feature ${info.introduces}`);
    }
  }
  return problems;
}

function auditFamilies(levels: readonly Level[]): string[] {
  const seen = new Set<MechanicFamily>();
  levels.forEach((level) => familiesOf(level).forEach((family) => seen.add(family)));
  return REQUIRED_FAMILIES.filter((family) => !seen.has(family)).map((family) => `No level uses ${family}`);
}

/**
 * Every structural and behavioural problem in a catalogue; an empty list means it passes. `schemaProblems` is injected
 * so the runtime schema (zod) stays out of the game bundle.
 */
export function auditLevels(levels: readonly Level[], schemaProblems: (level: Level) => string[] = () => []): string[] {
  const problems: string[] = [];
  if (levels.length !== LEVEL_COUNT) problems.push(`Expected ${LEVEL_COUNT} levels, found ${levels.length}`);
  if (CHAPTERS.length !== CHAPTER_COUNT) problems.push(`Expected ${CHAPTER_COUNT} chapters`);
  return [
    ...problems,
    ...auditEach(levels, schemaProblems),
    ...auditDistinct(levels),
    ...auditChapters(levels),
    ...auditFamilies(levels),
  ];
}

export interface ChapterSummary {
  chapter: number;
  name: string;
  meanLaunches: number;
  meanPlanets: number;
  meanHazards: number;
  meanWindowMs: number;
  fingerprints: number;
}

/** One line of numbers per chapter, to show how difficulty is meant to rise. */
export function summarise(levels: readonly Level[]): ChapterSummary[] {
  return CHAPTERS.map((info) => {
    const inChapter = chapterLevels(levels, info.id);
    const mean = (pick: (level: Level) => number): number =>
      inChapter.reduce((sum, level) => sum + pick(level), 0) / Math.max(1, inChapter.length);
    return {
      chapter: info.id,
      name: info.name,
      meanLaunches: mean((level) => level.solution.launchTicks.length),
      meanPlanets: mean((level) => level.planets.length),
      meanHazards: mean((level) => level.hazards.length),
      meanWindowMs: mean((level) => (level.solution.minWindow / 60) * 1000),
      fingerprints: new Set(inChapter.map(mechanicFingerprint)).size,
    };
  });
}

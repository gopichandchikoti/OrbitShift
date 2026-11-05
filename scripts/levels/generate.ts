/**
 * Builds the level catalogue.
 *
 *   npm run levels:generate                 # all 12 chapters
 *   npm run levels:generate -- --chapter 3  # one chapter (the others are only read, for the similarity check)
 *   npm run levels:generate -- --from 7     # chapter 7 onward
 *   npm run levels:generate -- --dry        # report only, write nothing
 *
 * A candidate becomes a level only if the solver finds a replayable route that meets the recipe's launch count and
 * timing window, the hazards actually change that route, the layout is structurally valid and it is not a near copy of
 * a level already accepted.
 */
import { CHAPTER_COUNT, LEVELS_PER_CHAPTER } from '../../src/game/levels/chapters';
import { layoutSignature, layoutSimilarity } from '../../src/game/levels/fingerprint';
import type { Level } from '../../src/game/levels/types';
import { buildLevel, rejectReport } from './generator/build';
import { recipeFor } from './generator/recipes';
import { readChapter, writeChapter } from './files';

const MAX_SIMILARITY = 0.55;

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

async function loadOthers(skip: number[]): Promise<Level[]> {
  const others: Level[] = [];
  for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter++) {
    if (!skip.includes(chapter)) others.push(...(await readChapter(chapter)));
  }
  return others;
}

function describe(level: Level, attempts: number, ms: number): string {
  const kinds = [...new Set(level.hazards.map((hazard) => hazard.type))].join(',') || '-';
  const moving = level.planets.filter((planet) => planet.motion).length;
  return [
    `L${String(level.id).padStart(3)} ${level.name.padEnd(16)}`,
    `planets ${level.planets.length}${moving ? `(${moving} moving)` : ''}`.padEnd(18),
    `launches ${level.solution.launchTicks.length}`,
    `window ${String(level.solution.minWindow).padStart(2)}`,
    `shards ${level.solution.shards}/${level.collectibles.length}`,
    `tries ${String(attempts).padStart(2)}`,
    `${String(ms).padStart(5)}ms`,
    kinds,
  ].join('  ');
}

async function generateChapter(chapter: number, accepted: Level[]): Promise<Level[] | null> {
  const made: Level[] = [];
  for (let index = 1; index <= LEVELS_PER_CHAPTER; index++) {
    const recipe = recipeFor(chapter, index);
    const started = Date.now();
    const isDistinct = (candidate: Level): boolean =>
      [...accepted, ...made].every(
        (other) =>
          layoutSignature(other) !== layoutSignature(candidate) && layoutSimilarity(other, candidate) < MAX_SIMILARITY,
      );
    const built = buildLevel(recipe, isDistinct);
    if (!built) {
      console.log(`L${recipe.id} ${recipe.name}: NO VALID LEVEL after the attempt budget.`);
      console.log(`  rejected because -> ${rejectReport()}`);
      return null;
    }
    made.push(built.level);
    console.log(describe(built.level, built.stats.attempts, Date.now() - started));
  }
  return made;
}

async function main(): Promise<void> {
  const only = argument('chapter');
  const from = Number(argument('from') ?? 1);
  const all = Array.from({ length: CHAPTER_COUNT }, (_, i) => i + 1);
  const chapters = only ? [Number(only)] : all.filter((chapter) => chapter >= from);
  const dry = process.argv.includes('--dry');
  const accepted = await loadOthers(chapters);
  let failed = false;
  for (const chapter of chapters) {
    const levels = await generateChapter(chapter, accepted);
    if (!levels) {
      failed = true;
      break;
    }
    accepted.push(...levels);
    if (!dry) writeChapter(chapter, levels);
  }
  process.exit(failed ? 1 : 0);
}

await main();

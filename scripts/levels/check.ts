/**
 * Validates the whole level catalogue: runtime schema, geometry, replay of every recorded solution, distinctness, the
 * chapter themes and that all eight mechanic families appear. `npm run build` runs it, so a broken level cannot ship.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditLevels, summarise } from '../../src/game/levels/audit';
import { LEVELS } from '../../src/game/levels/catalog';
import { levelSchema } from '../../src/game/levels/schema';

function schemaProblems(level: unknown): string[] {
  const result = levelSchema.safeParse(level);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

function manualCount(): number {
  const file = join(process.cwd(), 'qa', 'manual-playthroughs.json');
  if (!existsSync(file)) return 0;
  const entries = Object.values(JSON.parse(readFileSync(file, 'utf8')) as Record<string, { status?: string }>);
  return entries.filter((entry) => entry.status === 'passed').length;
}

const problems = auditLevels(LEVELS, schemaProblems);
const summary = summarise(LEVELS);
console.log('Chapter                  launches  planets  hazards  window(ms)  mechanic combos');
for (const row of summary) {
  console.log(
    `${String(row.chapter).padStart(2)} ${row.name.padEnd(22)} ${row.meanLaunches.toFixed(1).padStart(7)} ` +
      `${row.meanPlanets.toFixed(1).padStart(8)} ${row.meanHazards.toFixed(1).padStart(8)} ` +
      `${row.meanWindowMs.toFixed(0).padStart(10)} ${String(row.fingerprints).padStart(10)}/10`,
  );
}
console.log(`\n${LEVELS.length} levels checked. Manually play-tested by a person: ${manualCount()}/${LEVELS.length}.`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems.slice(0, 60)) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Catalogue OK: schema, geometry, solution replay, distinctness and chapter themes all pass.');

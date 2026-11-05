import { replayLaunches } from '../simulation/flight';
import { buildRuntime } from '../simulation/runtime';
import { shardCount } from '../simulation/state';
import { starsFor, type Stars } from './stars';
import type { Level } from './types';

export interface SolutionCheck {
  ok: boolean;
  problems: string[];
  stars: Stars | null;
}

/** Replays the level's recorded launch ticks through the real simulation and checks it ends in a 3-star win. */
export function verifySolution(level: Level): SolutionCheck {
  const rt = buildRuntime(level);
  const { won, state } = replayLaunches(rt, level.solution.launchTicks);
  const problems: string[] = [];
  if (!won) {
    const ended = `ended ${state.ship.mode}, ${state.death ?? 'alive'}`;
    return { ok: false, problems: [`replay did not win (${ended})`], stars: null };
  }
  const { solution } = level;
  if (state.tick !== solution.totalTicks) problems.push(`replay took ${state.tick} ticks, recorded ${solution.totalTicks}`);
  if (state.launches !== solution.launchTicks.length) problems.push('replay used a different number of launches');
  if (shardCount(rt, state) !== solution.shards) problems.push('replay collected a different number of shards');
  const stars = starsFor(level.par, state.launches, state.tick);
  if (stars !== 3) problems.push(`the recorded solution earns ${stars} stars, not 3`);
  return { ok: problems.length === 0, problems, stars };
}

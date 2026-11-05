import type { DeathReason } from './simulation/types';

export interface DeathInfo {
  /** Short, plain-language headline. Never relies on colour. */
  title: string;
  /** One actionable sentence. */
  tip: string;
}

export const DEATHS: Record<DeathReason, DeathInfo> = {
  crash: { title: 'Hit a planet', tip: 'Arrive slower, or aim at the glowing ring around the planet instead of its core.' },
  asteroid: { title: 'Hit an asteroid', tip: 'The dotted preview bends around nothing. Release when it clears the rock.' },
  satellite: { title: 'Hit a satellite', tip: 'Satellites circle on a fixed rhythm. Let one pass, then launch.' },
  laser: { title: 'Caught by a beam', tip: 'A dashed outline is the warning. The beam fires when the outline turns solid.' },
  gate: { title: 'Blocked by a gate', tip: 'Gates stay shut until their shard is collected. Find the shard first.' },
  'out-of-bounds': { title: 'Left the sector', tip: 'Anything past the edge of the field is lost. Aim back toward the planets.' },
  lost: { title: 'Lost in space', tip: 'Drifting too long ends the run. Aim for a planet ring or the portal.' },
};

export function describeDeath(reason: DeathReason | null): DeathInfo {
  return DEATHS[reason ?? 'lost'];
}

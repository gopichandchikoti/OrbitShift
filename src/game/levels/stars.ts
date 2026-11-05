import { TICK_RATE } from '../simulation/constants';
import type { Par } from './types';

export type Stars = 1 | 2 | 3;

/**
 * 1 star for finishing, 2 for finishing within the launch par, 3 for also finishing within the time par.
 * `ticks` are simulation ticks (60 per second), so the time is game time and pausing never costs a star.
 */
export function starsFor(par: Par, launches: number, ticks: number): Stars {
  if (launches > par.launches) return 1;
  return ticks / TICK_RATE <= par.seconds ? 3 : 2;
}

export function formatTime(ticks: number): string {
  const seconds = ticks / TICK_RATE;
  const whole = Math.floor(seconds);
  const tenths = Math.floor((seconds - whole) * 10);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${tenths}`;
}

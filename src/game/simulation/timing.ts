import { DT, MAX_CATCHUP_STEPS } from './constants';

/**
 * Turns variable render frame times into whole fixed simulation steps. The simulation therefore advances at 60 Hz of
 * *game time* on a 30, 60, 120 or 144 Hz display alike; `alpha` lets the renderer interpolate the leftover fraction.
 */
export class FixedStepper {
  private accumulated = 0;

  /** Adds elapsed wall time (milliseconds) and returns how many fixed steps to run now. */
  advance(elapsedMs: number): number {
    // A long stall (tab hidden, debugger) must not trigger a burst of catch-up steps: cap it.
    const seconds = Math.min(Math.max(elapsedMs, 0) / 1000, MAX_CATCHUP_STEPS * DT);
    this.accumulated += seconds;
    const steps = Math.floor(this.accumulated / DT + 1e-9);
    this.accumulated -= steps * DT;
    return steps;
  }

  /** Fraction (0..1) of the next step already elapsed. */
  get alpha(): number {
    return Math.min(Math.max(this.accumulated / DT, 0), 1);
  }

  /** Drops any partial step; call on resume so paused time is never replayed. */
  reset(): void {
    this.accumulated = 0;
  }
}

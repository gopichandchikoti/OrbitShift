import type { CompletionInput } from '../storage/progress';
import type { ControlMode } from '../storage/settings';
import { starsFor, type Stars } from './levels/stars';
import type { Level } from './levels/types';
import { predictLaunch, type Prediction } from './simulation/flight';
import { buildRuntime, type LevelRuntime } from './simulation/runtime';
import { cloneState, createInitialState, isFinished, shardCount } from './simulation/state';
import { stepSim } from './simulation/step';
import { FixedStepper } from './simulation/timing';
import type { SimEvent, SimState } from './simulation/types';

/** How far ahead the aiming preview looks, in ticks (2.5 s of flight). */
const PREVIEW_TICKS = 150;

/**
 * One attempt at one level: the simulation, the fixed-step clock and the aim/launch input state machine. It knows
 * nothing about Phaser or the DOM, so everything the player can do is testable without a browser.
 */
export class PlaySession {
  readonly rt: LevelRuntime;
  state: SimState;
  paused = false;
  /**
   * Development tool: release ticks to replay automatically (the level's recorded solution). Used by the dev
   * inspector and the browser tests to finish a level without frame-perfect human input; normal play leaves it null.
   */
  autopilot: readonly number[] | null = null;
  /** True while the player is aiming: the preview path is shown and releasing (or tapping again) launches. */
  aiming = false;
  private readonly stepper = new FixedStepper();
  private pendingLaunch = false;
  private cachedPreview: { tick: number; value: Prediction } | null = null;

  constructor(
    readonly level: Level,
    private controlMode: ControlMode = 'hold',
  ) {
    this.rt = buildRuntime(level);
    this.state = createInitialState(this.rt);
  }

  setControlMode(mode: ControlMode): void {
    if (mode !== this.controlMode) this.aiming = false;
    this.controlMode = mode;
  }

  /** Pointer down or key down. In tap mode this is the whole gesture: the first tap aims, the second launches. */
  press(): void {
    if (this.paused || this.finished) return;
    if (this.controlMode === 'hold') {
      this.aiming = true;
      return;
    }
    if (this.aiming) this.pendingLaunch = true;
    this.aiming = !this.aiming;
  }

  /** Pointer up or key up. Only meaningful in hold mode, where letting go is the launch. */
  release(): void {
    if (this.controlMode !== 'hold' || !this.aiming) return;
    this.aiming = false;
    if (!this.paused && !this.finished) this.pendingLaunch = true;
  }

  /** Advances by elapsed wall-clock time. Returns every event the simulation produced. */
  update(elapsedMs: number): SimEvent[] {
    if (this.paused) return [];
    const events: SimEvent[] = [];
    const steps = this.stepper.advance(elapsedMs);
    for (let i = 0; i < steps && !this.finished; i++) {
      const scripted = this.autopilot?.includes(this.state.tick + 1) === true;
      const launch = (this.pendingLaunch || scripted) && this.state.ship.mode === 'orbit';
      this.pendingLaunch = false;
      events.push(...stepSim(this.rt, this.state, launch));
    }
    return events;
  }

  pause(): void {
    this.paused = true;
    this.aiming = false;
    this.pendingLaunch = false;
  }

  /** Resuming drops any partial step so paused time is never replayed. */
  resume(): void {
    this.paused = false;
    this.stepper.reset();
  }

  restart(): void {
    this.state = createInitialState(this.rt);
    this.aiming = false;
    this.pendingLaunch = false;
    this.paused = false;
    this.cachedPreview = null;
    this.stepper.reset();
  }

  get finished(): boolean {
    return isFinished(this.state);
  }

  get won(): boolean {
    return this.state.ship.mode === 'won';
  }

  /** Fraction of the next step already elapsed, for smooth rendering on faster displays. */
  get alpha(): number {
    return this.stepper.alpha;
  }

  get shards(): number {
    return shardCount(this.rt, this.state);
  }

  /** The predicted flight if the player let go right now, or null when not aiming from an orbit. */
  get preview(): Prediction | null {
    if (!this.aiming || this.state.ship.mode !== 'orbit' || this.finished) return null;
    if (this.cachedPreview?.tick !== this.state.tick) {
      const value = predictLaunch(this.rt, cloneState(this.state), PREVIEW_TICKS);
      this.cachedPreview = { tick: this.state.tick, value };
    }
    return this.cachedPreview.value;
  }

  get stars(): Stars | null {
    return this.won ? starsFor(this.level.par, this.state.launches, this.state.tick) : null;
  }

  /** What to record when the level is won; null while still playing or after a loss. */
  completion(): CompletionInput | null {
    const stars = this.stars;
    if (stars === null) return null;
    return {
      levelId: this.level.id,
      stars,
      ticks: this.state.tick,
      launches: this.state.launches,
      shards: this.shards,
    };
  }
}

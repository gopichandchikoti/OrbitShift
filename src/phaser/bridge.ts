import type { PlaySession } from '../game/session';
import type { SimEvent } from '../game/simulation/types';

export interface RenderPrefs {
  reducedMotion: boolean;
  highContrast: boolean;
}

/**
 * The seam between the DOM application and the Phaser stage. The app writes the fields; the stage reads them every
 * frame. Keeping it a plain object means neither side needs to know how the other is built.
 */
export interface StageBridge {
  /** What to draw: the level being played, or the menu's ambient demo. */
  session: PlaySession;
  /** True while a real level is on screen (the ambient demo does not take input or show hazards' warnings). */
  playing: boolean;
  prefs: RenderPrefs;
  /** Development inspector: simulation speed multiplier and collision outlines. */
  timeScale: number;
  debug: boolean;
  /** Called with the events of each frame's simulation steps (sound, haptics, results). */
  onEvents(events: readonly SimEvent[], session: PlaySession): void;
  /** The pointer (finger or mouse) went down or up on the playfield. */
  onPointer(down: boolean): void;
}

export const BRIDGE_KEY = 'bridge';

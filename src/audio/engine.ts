export interface AudioLevels {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export type ContextFactory = () => AudioContext | null;

/** The browser's AudioContext, or null where Web Audio does not exist (old browsers, some test environments). */
export function defaultContextFactory(): AudioContext | null {
  type Ctor = typeof AudioContext;
  const scope = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

/**
 * Owns the Web Audio context and the two volume buses. Browsers only allow audio after a user gesture, so the context
 * is created lazily by `unlock()`; until then every call is a quiet no-op. A context that the system suspends or
 * interrupts (phone call, app switch) is resumed the next time the game asks for it.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private levels: AudioLevels = { musicVolume: 0.6, sfxVolume: 0.8, muted: false };
  private tried = false;

  constructor(private readonly factory: ContextFactory = defaultContextFactory) {}

  get context(): AudioContext | null {
    return this.ctx;
  }

  get sfxOut(): AudioNode | null {
    return this.sfx;
  }

  get musicOut(): AudioNode | null {
    return this.music;
  }

  /** Call from a pointer or key handler. Creates the context on first use and resumes it if it was suspended. */
  unlock(): void {
    if (!this.ctx && !this.tried) this.build();
    this.resume();
  }

  private build(): void {
    this.tried = true;
    this.ctx = this.factory();
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyLevels();
  }

  setLevels(levels: AudioLevels): void {
    this.levels = levels;
    this.applyLevels();
  }

  private applyLevels(): void {
    if (!this.ctx || !this.master || !this.sfx || !this.music) return;
    const now = this.ctx.currentTime;
    // A short ramp instead of a jump avoids audible clicks when a slider moves.
    this.master.gain.setTargetAtTime(this.levels.muted ? 0 : 1, now, 0.02);
    this.sfx.gain.setTargetAtTime(this.levels.sfxVolume, now, 0.02);
    this.music.gain.setTargetAtTime(this.levels.musicVolume * 0.55, now, 0.05);
  }

  resume(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
  }

  /** Pauses all sound, for example when the app goes to the background. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }
}

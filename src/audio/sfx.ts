import type { AudioEngine } from './engine';
import { midi, noise, tone } from './synth';

export type SfxName =
  | 'launch'
  | 'capture'
  | 'shard'
  | 'gate'
  | 'teleport'
  | 'fail'
  | 'win'
  | 'click'
  | 'back'
  | 'pause'
  | 'star';

type Voice = (ctx: AudioContext, out: AudioNode) => void;

const VOICES: Record<SfxName, Voice> = {
  launch: (ctx, out) => {
    noise(ctx, out, { duration: 0.3, gain: 0.32, filter: 'bandpass', freq: 380, freqEnd: 2000 });
    tone(ctx, out, { type: 'sine', freq: 200, freqEnd: 560, duration: 0.24, gain: 0.22 });
  },
  capture: (ctx, out) => {
    tone(ctx, out, { type: 'triangle', freq: midi(72), duration: 0.34, gain: 0.26 });
    tone(ctx, out, { type: 'triangle', freq: midi(79), delay: 0.09, duration: 0.42, gain: 0.22 });
  },
  shard: (ctx, out) => {
    tone(ctx, out, { type: 'sine', freq: midi(83), duration: 0.12, gain: 0.24 });
    tone(ctx, out, { type: 'sine', freq: midi(90), delay: 0.07, duration: 0.2, gain: 0.22 });
  },
  gate: (ctx, out) => {
    tone(ctx, out, { type: 'sine', freq: 280, freqEnd: 940, duration: 0.34, gain: 0.26 });
    noise(ctx, out, { duration: 0.2, gain: 0.12, filter: 'highpass', freq: 3000 });
  },
  teleport: (ctx, out) => {
    tone(ctx, out, { type: 'sine', freq: 330, freqEnd: 660, duration: 0.28, gain: 0.2 });
    tone(ctx, out, { type: 'sine', freq: 335, freqEnd: 900, duration: 0.28, gain: 0.16 });
  },
  fail: (ctx, out) => {
    tone(ctx, out, { type: 'sawtooth', freq: 190, freqEnd: 48, duration: 0.5, gain: 0.26 });
    noise(ctx, out, { duration: 0.5, gain: 0.34, filter: 'lowpass', freq: 1100, freqEnd: 120 });
  },
  win: (ctx, out) => {
    [72, 76, 79, 84].forEach((note, i) =>
      tone(ctx, out, { type: 'triangle', freq: midi(note), delay: i * 0.1, duration: 0.5, gain: 0.26 }),
    );
    tone(ctx, out, { type: 'sine', freq: midi(60), duration: 0.9, gain: 0.18, attack: 0.1 });
  },
  click: (ctx, out) => tone(ctx, out, { type: 'square', freq: 660, duration: 0.05, gain: 0.07 }),
  back: (ctx, out) => tone(ctx, out, { type: 'square', freq: 440, freqEnd: 300, duration: 0.07, gain: 0.07 }),
  pause: (ctx, out) => tone(ctx, out, { type: 'sine', freq: 330, freqEnd: 220, duration: 0.12, gain: 0.16 }),
  star: (ctx, out) => tone(ctx, out, { type: 'sine', freq: midi(88), duration: 0.28, gain: 0.2 }),
};

/** Plays named sound effects through the engine's SFX bus. Does nothing until the engine has been unlocked. */
export class Sfx {
  constructor(private readonly engine: AudioEngine) {}

  play(name: SfxName): void {
    const ctx = this.engine.context;
    const out = this.engine.sfxOut;
    if (!ctx || !out || ctx.state !== 'running') return;
    VOICES[name](ctx, out);
  }
}

export const SFX_NAMES = Object.keys(VOICES) as SfxName[];

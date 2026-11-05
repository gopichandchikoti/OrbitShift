import type { AudioEngine } from './engine';
import { midi, tone } from './synth';

/** Four slow chords (root MIDI notes and chord tones), repeated forever: an open, unresolved, night-sky mood. */
const CHORDS: readonly (readonly number[])[] = [
  [57, 64, 67, 71],
  [53, 60, 64, 69],
  [48, 55, 59, 64],
  [55, 62, 66, 71],
];
const CHORD_SECONDS = 8;
/** A-minor pentatonic, for the occasional bell. */
const BELLS = [76, 79, 81, 84, 88];
const LOOKAHEAD = 1.2;
const POLL_MS = 300;

/**
 * Generative ambient music: a soft pad that changes chord every eight seconds, and sparse bell notes. Nothing is
 * recorded, so there is no asset to download or license. A look-ahead scheduler queues notes slightly early so the
 * timing is sample-accurate even when the JavaScript thread is busy.
 */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextChordAt = 0;
  private nextBellAt = 0;
  private chord = 0;
  private seed = 7;

  constructor(private readonly engine: AudioEngine) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    const ctx = this.engine.context;
    this.nextChordAt = ctx ? ctx.currentTime + 0.1 : 0;
    this.nextBellAt = this.nextChordAt + 2;
    this.timer = setInterval(() => this.schedule(), POLL_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Queues every pad chord and bell that starts within the look-ahead window. */
  schedule(): void {
    const ctx = this.engine.context;
    const out = this.engine.musicOut;
    if (!ctx || !out || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (this.nextChordAt < horizon) {
      this.playChord(ctx, out, this.nextChordAt - ctx.currentTime);
      this.nextChordAt += CHORD_SECONDS;
      this.chord = (this.chord + 1) % CHORDS.length;
    }
    while (this.nextBellAt < horizon) {
      const note = BELLS[Math.floor(this.random() * BELLS.length)] as number;
      tone(ctx, out, { type: 'sine', freq: midi(note), delay: this.nextBellAt - ctx.currentTime, duration: 2.6, gain: 0.07 });
      this.nextBellAt += 1.6 + this.random() * 2.8;
    }
  }

  private playChord(ctx: AudioContext, out: AudioNode, delay: number): void {
    for (const note of CHORDS[this.chord] as readonly number[]) {
      tone(ctx, out, {
        type: 'triangle',
        freq: midi(note),
        delay: Math.max(0, delay),
        duration: CHORD_SECONDS + 1.5,
        gain: 0.05,
        attack: 2.5,
      });
    }
  }
}

/** Small building blocks for synthesised sound. Every voice cleans itself up when its envelope ends. */

export interface ToneSpec {
  type: OscillatorType;
  freq: number;
  /** If set, the pitch glides to this frequency over the tone's length. */
  freqEnd?: number;
  /** Seconds after "now" at which the tone starts. */
  delay?: number;
  duration: number;
  gain: number;
  attack?: number;
}

export interface NoiseSpec {
  delay?: number;
  duration: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
}

let noiseBuffer: AudioBuffer | null = null;
let noiseOwner: BaseAudioContext | null = null;

function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseOwner === ctx) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 1.2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  noiseBuffer = buffer;
  noiseOwner = ctx;
  return buffer;
}

/** One oscillator with an attack/decay envelope, glided pitch, connected to `out`. */
export function tone(ctx: AudioContext, out: AudioNode, spec: ToneSpec): void {
  const start = ctx.currentTime + (spec.delay ?? 0);
  const end = start + spec.duration;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, start);
  if (spec.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(spec.freqEnd, 1), end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(spec.gain, start + (spec.attack ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(out);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** A burst of filtered noise: wind, rumble, sparkle. */
export function noise(ctx: AudioContext, out: AudioNode, spec: NoiseSpec): void {
  const start = ctx.currentTime + (spec.delay ?? 0);
  const end = start + spec.duration;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = getNoise(ctx);
  filter.type = spec.filter;
  filter.frequency.setValueAtTime(spec.freq, start);
  if (spec.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(spec.freqEnd, 20), end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(spec.gain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(start);
  source.stop(end + 0.02);
}

/** Frequency of a MIDI note number. */
export function midi(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

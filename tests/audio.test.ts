import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, defaultContextFactory } from '../src/audio/engine';
import { Music } from '../src/audio/music';
import { SFX_NAMES, Sfx } from '../src/audio/sfx';
import { midi, noise, tone } from '../src/audio/synth';
import { FakeAudioContext, FakeNode, asContext } from './helpers/fake-audio';

function unlocked() {
  const ctx = new FakeAudioContext();
  const engine = new AudioEngine(() => asContext(ctx));
  engine.unlock();
  return { ctx, engine };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AudioEngine', () => {
  it('makes no context until the first user gesture', () => {
    const engine = new AudioEngine(() => asContext(new FakeAudioContext()));
    expect(engine.context).toBeNull();
    expect(engine.sfxOut).toBeNull();
    engine.resume();
    engine.suspend();
    engine.setLevels({ musicVolume: 1, sfxVolume: 1, muted: false });
    expect(engine.context).toBeNull();
  });

  it('builds the graph on unlock and starts the context', () => {
    const { ctx, engine } = unlocked();
    expect(ctx.state).toBe('running');
    const [master, sfx, music] = ctx.gains;
    expect(ctx.gains).toHaveLength(3);
    expect(engine.sfxOut).toBe(sfx);
    expect(engine.musicOut).toBe(music);
    expect(sfx?.connections).toContain(master);
    expect(music?.connections).toContain(master);
    expect(master?.connections).toContain(ctx.destination);
  });

  it('applies volumes and mute to the right buses', () => {
    const { ctx, engine } = unlocked();
    engine.setLevels({ musicVolume: 0.5, sfxVolume: 0.25, muted: false });
    const [master, sfx, music] = ctx.gains;
    expect(sfx?.gain.target).toBeCloseTo(0.25, 6);
    expect(music?.gain.target).toBeCloseTo(0.275, 6);
    expect(master?.gain.target).toBe(1);
    engine.setLevels({ musicVolume: 0.5, sfxVolume: 0.25, muted: true });
    expect(master?.gain.target).toBe(0);
  });

  it('resumes a context the system suspended, and can suspend it again', async () => {
    const { ctx, engine } = unlocked();
    engine.suspend();
    await Promise.resolve();
    expect(ctx.state).toBe('suspended');
    engine.unlock();
    await Promise.resolve();
    expect(ctx.state).toBe('running');
  });

  it('stays silent, without retrying, when Web Audio is unavailable', () => {
    const factory = vi.fn(() => null);
    const engine = new AudioEngine(factory);
    engine.unlock();
    engine.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(engine.context).toBeNull();
    expect(() => new Sfx(engine).play('launch')).not.toThrow();
  });

  it('finds no AudioContext under Node, and survives a constructor that throws', () => {
    expect(defaultContextFactory()).toBeNull();
    vi.stubGlobal('AudioContext', class {
      constructor() {
        throw new Error('blocked');
      }
    });
    expect(defaultContextFactory()).toBeNull();
  });

  it('creates a real-looking context when one exists, falling back to the webkit name', () => {
    class Stub {
      readonly options: unknown;
      constructor(options: unknown) {
        this.options = options;
      }
    }
    vi.stubGlobal('webkitAudioContext', Stub);
    expect(defaultContextFactory()).toBeInstanceOf(Stub);
  });
});

describe('synth', () => {
  it('converts MIDI notes to frequencies', () => {
    expect(midi(69)).toBeCloseTo(440, 6);
    expect(midi(81)).toBeCloseTo(880, 6);
  });

  it('builds an enveloped, gliding tone that stops itself', () => {
    const { ctx, engine } = unlocked();
    tone(asContext(ctx), engine.sfxOut as unknown as AudioNode, {
      type: 'sine', freq: 300, freqEnd: 600, duration: 0.2, gain: 0.3,
    });
    const osc = ctx.oscillators[0] as FakeNode;
    expect(osc.type).toBe('sine');
    expect(osc.frequency.ramps).toEqual(['exp']);
    expect(osc.stopped).toBeGreaterThan(osc.started ?? 0);
  });

  it('shares one noise buffer between voices on the same context', () => {
    const { ctx, engine } = unlocked();
    const out = engine.sfxOut as unknown as AudioNode;
    noise(asContext(ctx), out, { duration: 0.1, gain: 0.2, filter: 'lowpass', freq: 800, freqEnd: 100 });
    noise(asContext(ctx), out, { duration: 0.1, gain: 0.2, filter: 'highpass', freq: 3000 });
    expect(ctx.buffersCreated).toBe(1);
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.filters[0]?.frequency.ramps).toEqual(['exp']);
  });
});

describe('Sfx', () => {
  it('is silent before the engine is unlocked and while the context is suspended', () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(() => asContext(ctx));
    new Sfx(engine).play('launch');
    expect(ctx.oscillators).toHaveLength(0);
    engine.unlock();
    ctx.state = 'suspended';
    new Sfx(engine).play('launch');
    expect(ctx.oscillators).toHaveLength(0);
  });

  it.each(SFX_NAMES)('plays "%s" by building voices on the SFX bus', (name) => {
    const { ctx, engine } = unlocked();
    new Sfx(engine).play(name);
    expect(ctx.oscillators.length + ctx.sources.length).toBeGreaterThan(0);
    const sfxBus = engine.sfxOut;
    const feeds = ctx.gains.slice(3).some((gain) => gain.connections.includes(sfxBus));
    expect(feeds).toBe(true);
  });
});

describe('Music', () => {
  it('queues a pad chord and bells, one chord every eight seconds, and stops cleanly', () => {
    vi.useFakeTimers();
    const { ctx, engine } = unlocked();
    const music = new Music(engine);
    music.start();
    music.start();
    expect(music.running).toBe(true);
    const first = ctx.oscillators.length;
    expect(first).toBeGreaterThanOrEqual(4);
    ctx.currentTime = 20;
    vi.advanceTimersByTime(400);
    expect(ctx.oscillators.length).toBeGreaterThan(first + 4);
    music.stop();
    const stopped = ctx.oscillators.length;
    ctx.currentTime = 60;
    vi.advanceTimersByTime(2000);
    expect(ctx.oscillators.length).toBe(stopped);
    expect(music.running).toBe(false);
  });

  it('schedules nothing while the context is not running', () => {
    vi.useFakeTimers();
    const { ctx, engine } = unlocked();
    ctx.state = 'suspended';
    const music = new Music(engine);
    music.start();
    expect(ctx.oscillators).toHaveLength(0);
    music.stop();
  });
});

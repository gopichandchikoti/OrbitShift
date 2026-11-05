import { AudioEngine } from '../audio/engine';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Haptics, createHapticsBackend } from '../platform/haptics';
import { createDefaultLifecycle, type Lifecycle } from '../platform/lifecycle';
import { ProgressStore } from '../storage/progress';
import { SettingsStore } from '../storage/settings';
import { createDefaultStore, type KeyValueStore } from '../storage/store';

/** Everything the application depends on, built once. Tests build the same shape from fakes. */
export interface Services {
  settings: SettingsStore;
  progress: ProgressStore;
  engine: AudioEngine;
  sfx: Sfx;
  music: Music;
  haptics: Haptics;
  lifecycle: Lifecycle;
  /** False when storage was blocked, so this session's progress will not be kept. */
  persistent: boolean;
  /** Leaves the app (Android only; a browser tab cannot close itself). */
  exit: () => void;
}

export interface ServiceOverrides {
  store?: KeyValueStore;
  engine?: AudioEngine;
  lifecycle?: Lifecycle;
  haptics?: Haptics;
  exit?: () => void;
  systemReducedMotion?: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function createServices(overrides: ServiceOverrides = {}): Services {
  const stored = overrides.store ? { store: overrides.store, persistent: true } : createDefaultStore();
  const settings = new SettingsStore(stored.store, overrides.systemReducedMotion ?? prefersReducedMotion());
  const engine = overrides.engine ?? new AudioEngine();
  return {
    settings,
    progress: new ProgressStore(stored.store),
    engine,
    sfx: new Sfx(engine),
    music: new Music(engine),
    haptics: overrides.haptics ?? new Haptics(createHapticsBackend(), () => settings.get().haptics),
    lifecycle: overrides.lifecycle ?? createDefaultLifecycle(),
    persistent: stored.persistent,
    exit: overrides.exit ?? (() => undefined),
  };
}

import { SaveSlot, type SaveSpec } from './save-slot';
import type { KeyValueStore } from './store';

export type ControlMode = 'hold' | 'tap';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  haptics: boolean;
  /** Replaces camera shake and large motion with fades. Defaults to the operating system's preference. */
  reducedMotion: boolean;
  highContrast: boolean;
  /** 'hold': press to aim, release to launch. 'tap': tap once to aim, tap again to launch. */
  controlMode: ControlMode;
}

export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = 'orbit-shift.settings';

export function defaultSettings(systemReducedMotion = false): Settings {
  return {
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false,
    haptics: true,
    reducedMotion: systemReducedMotion,
    highContrast: false,
    controlMode: 'hold',
  };
}

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mode(value: unknown, fallback: ControlMode): ControlMode {
  return value === 'tap' || value === 'hold' ? value : fallback;
}

/** Field-by-field: one bad field falls back to its default instead of discarding every other setting. */
export function sanitizeSettings(raw: unknown, fallback: Settings): Settings | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  return {
    musicVolume: volume(data.musicVolume, fallback.musicVolume),
    sfxVolume: volume(data.sfxVolume, fallback.sfxVolume),
    muted: flag(data.muted, fallback.muted),
    haptics: flag(data.haptics, fallback.haptics),
    reducedMotion: flag(data.reducedMotion, fallback.reducedMotion),
    highContrast: flag(data.highContrast, fallback.highContrast),
    controlMode: mode(data.controlMode, fallback.controlMode),
  };
}

export type SettingsListener = (settings: Settings) => void;

/** Holds the live settings, saves every change, and tells listeners (audio, renderer, DOM theme) about it. */
export class SettingsStore {
  private readonly slot: SaveSlot<Settings>;
  private readonly listeners = new Set<SettingsListener>();
  private current: Settings;
  readonly recovered: boolean;

  constructor(store: KeyValueStore, systemReducedMotion = false) {
    const defaults = defaultSettings(systemReducedMotion);
    const spec: SaveSpec<Settings> = {
      key: SETTINGS_KEY,
      version: SETTINGS_VERSION,
      defaults: () => defaults,
      migrate: (data) => data,
      validate: (data) => sanitizeSettings(data, defaults),
    };
    this.slot = new SaveSlot(store, spec);
    const loaded = this.slot.load();
    this.current = loaded.value;
    this.recovered = loaded.recovered;
  }

  get(): Settings {
    return this.current;
  }

  update(patch: Partial<Settings>): Settings {
    this.current = sanitizeSettings({ ...this.current, ...patch }, this.current) ?? this.current;
    this.slot.save(this.current);
    this.listeners.forEach((listener) => listener(this.current));
    return this.current;
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

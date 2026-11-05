import type { KeyValueStore } from './store';

export interface SaveSpec<T> {
  /** Storage key; the backup copy lives under `${key}.backup`. */
  key: string;
  /** Version the code writes today. Older saves are migrated, newer ones are refused. */
  version: number;
  defaults: () => T;
  /** Brings `data` saved at `fromVersion` up to the current shape. */
  migrate: (data: unknown, fromVersion: number) => unknown;
  /** Returns a clean value, or null when the data cannot be trusted. */
  validate: (data: unknown) => T | null;
}

export type LoadSource = 'primary' | 'backup' | 'defaults';

export interface LoadResult<T> {
  value: T;
  source: LoadSource;
  /** True when a corrupt or unreadable primary save was replaced by the backup or by defaults. */
  recovered: boolean;
  /** True when the value came from an older save version. */
  migrated: boolean;
}

interface Envelope {
  version: number;
  data: unknown;
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { version, data } = parsed as Record<string, unknown>;
    return typeof version === 'number' && Number.isInteger(version) ? { version, data } : null;
  } catch {
    return null;
  }
}

/**
 * One versioned save with a rolling backup. A write first copies the current good save to the backup key, so a write
 * that is interrupted or a save that later fails validation can always fall back to the previous good one.
 */
export class SaveSlot<T> {
  constructor(
    private readonly store: KeyValueStore,
    private readonly spec: SaveSpec<T>,
  ) {}

  private read(key: string): { value: T; migrated: boolean } | null {
    const envelope = parseEnvelope(this.store.get(key));
    if (!envelope || envelope.version > this.spec.version || envelope.version < 1) return null;
    const data = envelope.version === this.spec.version ? envelope.data : this.safeMigrate(envelope);
    const value = this.spec.validate(data);
    return value === null ? null : { value, migrated: envelope.version !== this.spec.version };
  }

  private safeMigrate(envelope: Envelope): unknown {
    try {
      return this.spec.migrate(envelope.data, envelope.version);
    } catch {
      return null;
    }
  }

  load(): LoadResult<T> {
    const hadPrimary = this.store.get(this.spec.key) !== null;
    const primary = this.read(this.spec.key);
    if (primary) return { ...primary, source: 'primary', recovered: false };
    const backup = this.read(`${this.spec.key}.backup`);
    if (backup) return { ...backup, source: 'backup', recovered: hadPrimary };
    return { value: this.spec.defaults(), source: 'defaults', recovered: hadPrimary, migrated: false };
  }

  /** Writes the value. Returns false if storage refused it (the in-memory value is still valid for this session). */
  save(value: T): boolean {
    const previous = this.store.get(this.spec.key);
    if (previous !== null && this.read(this.spec.key)) this.store.set(`${this.spec.key}.backup`, previous);
    return this.store.set(this.spec.key, JSON.stringify({ version: this.spec.version, data: value }));
  }

  clear(): void {
    this.store.remove(this.spec.key);
    this.store.remove(`${this.spec.key}.backup`);
  }
}

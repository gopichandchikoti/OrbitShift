/** The only storage surface the game depends on, so browsers, the Android WebView and tests can all supply one. */
export interface KeyValueStore {
  get(key: string): string | null;
  /** Returns false when the value could not be stored (quota, private mode, blocked storage). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): boolean {
    this.values.set(key, value);
    return true;
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

/** localStorage with every access guarded: it can throw when blocked, full, or disabled (private windows, previews). */
export class LocalStore implements KeyValueStore {
  constructor(private readonly storage: Storage) {}

  get(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): boolean {
    try {
      this.storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // Nothing to remove if storage is unavailable.
    }
  }
}

/**
 * The best store available: localStorage when it works, otherwise memory, so the game still plays (without saving)
 * instead of crashing when storage is blocked.
 */
export function createDefaultStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const probe = '__orbit-shift-probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return { store: new LocalStore(window.localStorage), persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

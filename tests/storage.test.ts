import { describe, expect, it, vi } from 'vitest';
import { SaveSlot, type SaveSpec } from '../src/storage/save-slot';
import { LocalStore, MemoryStore, createDefaultStore } from '../src/storage/store';

class ThrowingStorage {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('quota');
  }
  removeItem(): void {
    throw new Error('blocked');
  }
}

interface Doc {
  n: number;
}

function spec(overrides: Partial<SaveSpec<Doc>> = {}): SaveSpec<Doc> {
  return {
    key: 'doc',
    version: 2,
    defaults: () => ({ n: 0 }),
    migrate: (data, from) => (from === 1 ? { n: Number((data as { old: number }).old) } : data),
    validate: (data) => {
      const n = (data as { n?: unknown } | null)?.n;
      return typeof n === 'number' ? { n } : null;
    },
    ...overrides,
  };
}

describe('stores', () => {
  it('keeps values in memory', () => {
    const store = new MemoryStore();
    expect(store.get('a')).toBeNull();
    expect(store.set('a', '1')).toBe(true);
    expect(store.get('a')).toBe('1');
    store.remove('a');
    expect(store.get('a')).toBeNull();
  });

  it('never throws when localStorage is blocked', () => {
    const store = new LocalStore(new ThrowingStorage() as unknown as Storage);
    expect(store.get('a')).toBeNull();
    expect(store.set('a', '1')).toBe(false);
    expect(() => store.remove('a')).not.toThrow();
  });

  it('falls back to memory when localStorage is unavailable', () => {
    const { store, persistent } = createDefaultStore();
    expect(persistent).toBe(false);
    expect(store.set('k', 'v')).toBe(true);
  });

  it('uses localStorage when it works', () => {
    const backing = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => backing.get(k) ?? null,
        setItem: (k: string, v: string) => void backing.set(k, v),
        removeItem: (k: string) => void backing.delete(k),
      },
    });
    const { store, persistent } = createDefaultStore();
    expect(persistent).toBe(true);
    store.set('x', '9');
    expect(backing.get('x')).toBe('9');
    vi.unstubAllGlobals();
  });
});

describe('SaveSlot', () => {
  it('round-trips a value', () => {
    const slot = new SaveSlot(new MemoryStore(), spec());
    expect(slot.save({ n: 7 })).toBe(true);
    expect(slot.load()).toMatchObject({ value: { n: 7 }, source: 'primary', recovered: false, migrated: false });
  });

  it('returns defaults when nothing was ever saved, without calling it a recovery', () => {
    expect(new SaveSlot(new MemoryStore(), spec()).load()).toMatchObject({
      value: { n: 0 },
      source: 'defaults',
      recovered: false,
    });
  });

  it('keeps the previous good save as a backup and recovers from it when the primary is corrupt', () => {
    const store = new MemoryStore();
    const slot = new SaveSlot(store, spec());
    slot.save({ n: 1 });
    slot.save({ n: 2 });
    store.set('doc', '{not json');
    expect(slot.load()).toMatchObject({ value: { n: 1 }, source: 'backup', recovered: true });
  });

  it('falls back to defaults when primary and backup are both unusable', () => {
    const store = new MemoryStore();
    store.set('doc', 'garbage');
    store.set('doc.backup', JSON.stringify({ version: 2, data: { n: 'x' } }));
    expect(new SaveSlot(store, spec()).load()).toMatchObject({ value: { n: 0 }, source: 'defaults', recovered: true });
  });

  it('does not overwrite a good backup with a corrupt primary', () => {
    const store = new MemoryStore();
    const slot = new SaveSlot(store, spec());
    slot.save({ n: 1 });
    slot.save({ n: 2 });
    store.set('doc', 'garbage');
    slot.save({ n: 3 });
    expect(JSON.parse(store.get('doc.backup') ?? '{}').data).toEqual({ n: 1 });
  });

  it('migrates an older version forward', () => {
    const store = new MemoryStore();
    store.set('doc', JSON.stringify({ version: 1, data: { old: 41 } }));
    expect(new SaveSlot(store, spec()).load()).toMatchObject({ value: { n: 41 }, migrated: true, source: 'primary' });
  });

  it('treats a throwing migration as a corrupt save', () => {
    const store = new MemoryStore();
    store.set('doc', JSON.stringify({ version: 1, data: null }));
    const slot = new SaveSlot(store, spec({ migrate: () => { throw new Error('bad'); } }));
    expect(slot.load()).toMatchObject({ source: 'defaults', recovered: true });
  });

  it('refuses a save written by a newer version of the game', () => {
    const store = new MemoryStore();
    store.set('doc', JSON.stringify({ version: 3, data: { n: 5 } }));
    expect(new SaveSlot(store, spec()).load().source).toBe('defaults');
  });

  it.each(['null', '"text"', '[1]', '{"version":"2","data":{"n":1}}', '{"version":0,"data":{"n":1}}'])(
    'rejects the malformed envelope %s',
    (raw) => {
      const store = new MemoryStore();
      store.set('doc', raw);
      expect(new SaveSlot(store, spec()).load().source).toBe('defaults');
    },
  );

  it('reports a refused write', () => {
    const slot = new SaveSlot(new LocalStore(new ThrowingStorage() as unknown as Storage), spec());
    expect(slot.save({ n: 1 })).toBe(false);
  });

  it('clears both copies', () => {
    const store = new MemoryStore();
    const slot = new SaveSlot(store, spec());
    slot.save({ n: 1 });
    slot.save({ n: 2 });
    slot.clear();
    expect(store.get('doc')).toBeNull();
    expect(store.get('doc.backup')).toBeNull();
  });
});

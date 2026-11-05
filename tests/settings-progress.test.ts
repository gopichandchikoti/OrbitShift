import { describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENTS, achievementById, newlyEarned } from '../src/game/achievements';
import { starsFor, formatTime } from '../src/game/levels/stars';
import {
  chapterCleared,
  chapterPerfect,
  chapterStars,
  chapterUnlocked,
  completedCount,
  emptyProgress,
  isUnlocked,
  totalShards,
  totalStars,
  unlockedUpTo,
} from '../src/storage/progress-model';
import { PROGRESS_KEY, ProgressStore, sanitizeProgress, type CompletionInput } from '../src/storage/progress';
import { SETTINGS_KEY, SettingsStore, defaultSettings, sanitizeSettings } from '../src/storage/settings';
import { MemoryStore } from '../src/storage/store';

const clear = (levelId: number, extra: Partial<Omit<CompletionInput, 'levelId'>> = {}): CompletionInput => ({
  levelId,
  stars: 1,
  ticks: 600,
  launches: 2,
  shards: 1,
  ...extra,
});

describe('settings', () => {
  it('starts from defaults and honours the system reduced-motion preference', () => {
    expect(new SettingsStore(new MemoryStore()).get()).toEqual(defaultSettings(false));
    expect(new SettingsStore(new MemoryStore(), true).get().reducedMotion).toBe(true);
  });

  it('persists changes across a restart', () => {
    const backing = new MemoryStore();
    new SettingsStore(backing).update({ musicVolume: 0.2, controlMode: 'tap', highContrast: true });
    const reloaded = new SettingsStore(backing).get();
    expect(reloaded).toMatchObject({ musicVolume: 0.2, controlMode: 'tap', highContrast: true });
  });

  it('clamps volumes and ignores values of the wrong type', () => {
    const store = new SettingsStore(new MemoryStore());
    store.update({ musicVolume: 5, sfxVolume: -3 });
    expect(store.get()).toMatchObject({ musicVolume: 1, sfxVolume: 0 });
    store.update({ muted: 'yes' as unknown as boolean, controlMode: 'swipe' as unknown as 'hold' });
    expect(store.get()).toMatchObject({ muted: false, controlMode: 'hold' });
  });

  it('keeps good fields when one field in the save is bad', () => {
    const backing = new MemoryStore();
    backing.set(SETTINGS_KEY, JSON.stringify({ version: 1, data: { musicVolume: 'loud', sfxVolume: 0.1, muted: true } }));
    expect(new SettingsStore(backing).get()).toMatchObject({ musicVolume: 0.6, sfxVolume: 0.1, muted: true });
  });

  it('rejects non-object data', () => {
    expect(sanitizeSettings(null, defaultSettings())).toBeNull();
    expect(sanitizeSettings([1], defaultSettings())).toBeNull();
  });

  it('notifies subscribers until they unsubscribe', () => {
    const store = new SettingsStore(new MemoryStore());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.update({ haptics: false });
    off();
    store.update({ haptics: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ haptics: false });
  });

  it('flags a recovered save', () => {
    const backing = new MemoryStore();
    backing.set(SETTINGS_KEY, 'garbage');
    expect(new SettingsStore(backing).recovered).toBe(true);
  });
});

describe('progress', () => {
  it('unlocks the next level when a level is cleared', () => {
    const store = new ProgressStore(new MemoryStore());
    expect(unlockedUpTo(store.get())).toBe(1);
    const result = store.recordCompletion(clear(1));
    expect(result).toMatchObject({ firstClear: true, unlocked: 2 });
    expect(isUnlocked(store.get(), 2)).toBe(true);
    expect(isUnlocked(store.get(), 3)).toBe(false);
  });

  it('keeps the best stars, time, launches and shards separately', () => {
    const store = new ProgressStore(new MemoryStore());
    store.recordCompletion(clear(1, { stars: 2, ticks: 500, launches: 3, shards: 2 }));
    const worse = store.recordCompletion(clear(1, { stars: 1, ticks: 900, launches: 4, shards: 1 }));
    expect(worse.firstClear).toBe(false);
    expect(worse.improved).toEqual({ stars: false, time: false, launches: false });
    const better = store.recordCompletion(clear(1, { stars: 3, ticks: 400, launches: 2, shards: 2 }));
    expect(better.improved).toEqual({ stars: true, time: true, launches: true });
    expect(store.get().levels['1']).toEqual({ stars: 3, bestTicks: 400, bestLaunches: 2, bestShards: 2 });
  });

  it('does not report an unlock when replaying an old level', () => {
    const store = new ProgressStore(new MemoryStore());
    store.recordCompletion(clear(1));
    expect(store.recordCompletion(clear(1)).unlocked).toBeNull();
  });

  it('survives a restart: the completed level is on disk immediately', () => {
    const backing = new MemoryStore();
    new ProgressStore(backing).recordCompletion(clear(1, { stars: 3 }));
    const reopened = new ProgressStore(backing).get();
    expect(reopened.levels['1']?.stars).toBe(3);
    expect(reopened.lastLevel).toBe(1);
  });

  it('awards each achievement once, at the time of the clear', () => {
    const store = new ProgressStore(new MemoryStore(), () => 1234);
    const first = store.recordCompletion(clear(1, { stars: 3 }));
    expect(first.achievements).toEqual(expect.arrayContaining(['liftoff', 'three-stars']));
    expect(store.get().achievements.liftoff).toBe(1234);
    expect(store.recordCompletion(clear(1, { stars: 3 })).achievements).toEqual([]);
  });

  it('counts restarts and awards the persistence achievement at 25', () => {
    const store = new ProgressStore(new MemoryStore());
    let earned: string[] = [];
    for (let i = 0; i < 25; i++) earned = store.noteRestart();
    expect(earned).toEqual(['persistent']);
    expect(store.noteRestart()).toEqual([]);
    store.noteDeath();
    expect(store.get().stats).toMatchObject({ restarts: 26, deaths: 1 });
  });

  it('remembers the last level and the tutorial', () => {
    const backing = new MemoryStore();
    const store = new ProgressStore(backing);
    store.setLastLevel(14);
    store.markTutorialDone();
    store.markTutorialDone();
    const reopened = new ProgressStore(backing).get();
    expect(reopened).toMatchObject({ lastLevel: 14, tutorialDone: true });
  });

  it('resets everything only when asked', () => {
    const backing = new MemoryStore();
    const store = new ProgressStore(backing);
    store.recordCompletion(clear(1));
    store.reset();
    expect(store.get()).toEqual(emptyProgress());
    expect(new ProgressStore(backing).get()).toEqual(emptyProgress());
  });

  it('recovers from a corrupt save instead of crashing', () => {
    const backing = new MemoryStore();
    backing.set(PROGRESS_KEY, '{oops');
    const store = new ProgressStore(backing);
    expect(store.recovered).toBe(true);
    expect(store.get()).toEqual(emptyProgress());
  });

  it('drops invalid level records and out-of-range ids but keeps the valid ones', () => {
    const cleaned = sanitizeProgress({
      levels: {
        '1': { stars: 3, bestTicks: 300, bestLaunches: 2, bestShards: 1 },
        '2': { stars: 9, bestTicks: 300, bestLaunches: 2, bestShards: 1 },
        '3': { stars: 1, bestTicks: 0, bestLaunches: 2, bestShards: 1 },
        '999': { stars: 1, bestTicks: 10, bestLaunches: 1, bestShards: 0 },
        '4': 'nope',
        x: { stars: 1, bestTicks: 10, bestLaunches: 1, bestShards: 0 },
      },
      achievements: { liftoff: 5, bad: 'x' },
      stats: { restarts: -4, deaths: 2.7, launches: 'a' },
      lastLevel: 500,
      tutorialDone: 'yes',
    });
    expect(Object.keys(cleaned?.levels ?? {})).toEqual(['1']);
    expect(cleaned).toMatchObject({
      achievements: { liftoff: 5 },
      stats: { restarts: 0, deaths: 2, launches: 0 },
      lastLevel: 1,
      tutorialDone: false,
    });
    expect(sanitizeProgress(null)).toBeNull();
    expect(sanitizeProgress({})).toMatchObject({ levels: {}, lastLevel: 1 });
  });
});

describe('progress queries and achievements', () => {
  function chapterOneDone(stars: 1 | 2 | 3) {
    const progress = emptyProgress();
    for (let id = 1; id <= 10; id++) {
      progress.levels[String(id)] = { stars, bestTicks: 100, bestLaunches: 2, bestShards: 2 };
    }
    return progress;
  }

  it('summarises stars, shards and chapters', () => {
    const progress = chapterOneDone(3);
    expect(totalStars(progress)).toBe(30);
    expect(totalShards(progress)).toBe(20);
    expect(completedCount(progress)).toBe(10);
    expect(chapterCleared(progress, 1)).toBe(true);
    expect(chapterCleared(progress, 2)).toBe(false);
    expect(chapterPerfect(progress, 1)).toBe(true);
    expect(chapterStars(progress, 1)).toBe(30);
    expect(chapterUnlocked(progress, 2)).toBe(true);
    expect(chapterUnlocked(progress, 3)).toBe(false);
    expect(chapterUnlocked(progress, 13)).toBe(false);
  });

  it('does not unlock past a gap', () => {
    const progress = emptyProgress();
    progress.levels['3'] = { stars: 1, bestTicks: 1, bestLaunches: 1, bestShards: 0 };
    expect(unlockedUpTo(progress)).toBe(1);
  });

  it('caps unlocking at the last level', () => {
    const progress = emptyProgress();
    const record = { stars: 1 as const, bestTicks: 1, bestLaunches: 1, bestShards: 0 };
    for (let id = 1; id <= 120; id++) progress.levels[String(id)] = record;
    expect(unlockedUpTo(progress)).toBe(120);
    expect(newlyEarned(progress)).toContain('full-orbit');
  });

  it('has unique achievement ids and a chapter achievement for every chapter', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let c = 1; c <= 12; c++) expect(achievementById(`chapter-${c}`)).toBeDefined();
    expect(achievementById('nope')).toBeUndefined();
  });

  it('awards chapter and star-count achievements from progress alone', () => {
    const earned = newlyEarned(chapterOneDone(3));
    expect(earned).toEqual(expect.arrayContaining(['chapter-1', 'perfect-chapter', 'stars-30', 'liftoff']));
    expect(earned).not.toContain('chapter-2');
    // 10 levels x 2 shards = 20, which is below the 25-shard threshold.
    expect(earned).not.toContain('shards-25');
  });
});

describe('stars and time', () => {
  const par = { launches: 3, seconds: 20 };

  it('awards 1, 2 or 3 stars from launches and time', () => {
    expect(starsFor(par, 4, 600)).toBe(1);
    expect(starsFor(par, 3, 60 * 25)).toBe(2);
    expect(starsFor(par, 3, 60 * 20)).toBe(3);
    expect(starsFor(par, 1, 60 * 5)).toBe(3);
  });

  it('formats game time as m:ss.t', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(60 * 65 + 30)).toBe('1:05.5');
  });
});

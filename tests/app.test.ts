// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRESS_KEY } from '../src/storage/progress';
import { SETTINGS_KEY } from '../src/storage/settings';
import { createRig, progressWithClears, type Rig } from './helpers/app-rig';

let rig: Rig;

beforeEach(() => {
  vi.useFakeTimers();
  rig = createRig();
});

afterEach(() => {
  vi.useRealTimers();
});

const startLevelOne = (): void => {
  rig.click(/^Play/);
  rig.frames(5);
};

describe('start up and menu', () => {
  it('shows the menu with a Play button and zeroed progress', () => {
    expect(rig.app.currentRoute.name).toBe('menu');
    expect(rig.text()).toContain('Levels 0/120');
    expect(rig.button(/^Play/).textContent).toContain('Level 1');
    expect(rig.bridge.playing).toBe(false);
  });

  it('applies saved settings to the page and the playfield', () => {
    const saved = createRig({
      store: (() => {
        const s = rig.store;
        s.set(SETTINGS_KEY, JSON.stringify({ version: 1, data: { highContrast: true, reducedMotion: true } }));
        return s;
      })(),
    });
    expect(document.documentElement.dataset.contrast).toBe('high');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(saved.bridge.prefs).toEqual({ reducedMotion: true, highContrast: true });
  });

  it('warns when storage is blocked and when a corrupt save was recovered', () => {
    const blocked = createRig({ persistent: false });
    expect(blocked.ui.root.querySelector('.toasts')?.textContent).toContain('will not be saved');
    const store = rig.store;
    store.set(PROGRESS_KEY, '{garbage');
    const recovered = createRig({ store });
    expect(recovered.ui.root.querySelector('.toasts')?.textContent).toContain('restored from a backup');
  });

  it('resumes from the first unfinished level', () => {
    const seeded = rig.store;
    seeded.set(PROGRESS_KEY, progressWithClears(4));
    const resumed = createRig({ store: seeded });
    expect(resumed.button(/^Continue/).textContent).toContain('Level 5');
    resumed.click(/^Continue/);
    expect(resumed.app.flow.session?.level.id).toBe(5);
  });

  it('unlocks audio and starts the music on the first gesture', () => {
    expect(rig.audio.state).toBe('suspended');
    rig.click('Chapters');
    expect(rig.audio.state).toBe('running');
    rig.app.click();
    expect(rig.audio.oscillators.length).toBeGreaterThan(0);
  });
});

describe('navigation', () => {
  it('walks menu > chapters > levels and back with the Back control', () => {
    rig.click('Chapters');
    expect(rig.text()).toContain('12 chapters');
    rig.click(/^Chapter 1(?!\d)/);
    expect(rig.text()).toContain('First Orbit');
    rig.click('Back');
    expect(rig.app.currentRoute.name).toBe('chapters');
    rig.app.back();
    expect(rig.app.currentRoute.name).toBe('menu');
  });

  it('opens how to play, achievements, credits and settings, and returns from each', () => {
    for (const label of ['How to play', 'Achievements', 'Credits', 'Settings']) {
      rig.click(label);
      expect(rig.app.currentRoute.name).not.toBe('menu');
      rig.app.back();
      expect(rig.app.currentRoute.name).toBe('menu');
    }
  });

  it('exits the app when Back is pressed on the menu', () => {
    rig.fire('back');
    expect(rig.exit).toHaveBeenCalledTimes(1);
  });

  it('explains a locked chapter and a locked level instead of opening them', () => {
    rig.click('Chapters');
    rig.click(/^Chapter 2(?!\d)/);
    expect(document.getElementById('live')?.textContent).toMatch(/locked/i);
    expect(rig.app.currentRoute.name).toBe('chapters');
    rig.click(/^Chapter 1(?!\d)/);
    rig.click(/^Level 2,/);
    expect(document.getElementById('live')?.textContent).toMatch(/locked/i);
    expect(rig.app.currentRoute.name).toBe('levels');
  });

  it('opens an unlocked level from the list', () => {
    rig.click('Chapters');
    rig.click(/^Chapter 1(?!\d)/);
    rig.click(/^Level 1,/);
    expect(rig.app.flow.session?.level.id).toBe(1);
    expect(rig.bridge.playing).toBe(true);
  });
});

describe('playing a level', () => {
  it('starts with the HUD, a hint and the preview-driven aim and launch', () => {
    startLevelOne();
    expect(rig.ui.root.querySelector('.hud')).not.toBeNull();
    expect(rig.ui.root.querySelector('.hud__hint')).not.toBeNull();
    expect(rig.text()).toContain('L1');
    rig.app.press();
    expect(rig.app.flow.session?.aiming).toBe(true);
    rig.app.release();
    rig.frames(3);
    expect(rig.app.flow.session?.state.launches).toBe(1);
    expect(rig.ui.root.querySelector('.hud__hint')).toBeNull();
    expect(rig.services.progress.get().tutorialDone).toBe(true);
    expect(rig.haptic).toHaveBeenCalledWith('light');
  });

  it('ignores the pointer when no level is running or a dialog is open', () => {
    rig.bridge.onPointer(true);
    expect(rig.app.flow.session).toBeNull();
    startLevelOne();
    rig.app.flow.pause();
    rig.bridge.onPointer(true);
    expect(rig.app.flow.session?.aiming).toBe(false);
  });

  it('feeds pointer events from the stage into aim and launch', () => {
    startLevelOne();
    rig.bridge.onPointer(true);
    expect(rig.app.flow.session?.aiming).toBe(true);
    rig.bridge.onPointer(false);
    rig.frames(2);
    expect(rig.app.flow.session?.state.launches).toBe(1);
  });

  it('updates the readouts as time passes', () => {
    startLevelOne();
    rig.frames(120);
    vi.advanceTimersByTime(300);
    expect(rig.ui.root.querySelector('.hud')?.textContent).toMatch(/0:0[1-9]\.\d|0:02/);
  });

  it('pauses, shows the dialog, freezes time and resumes', () => {
    startLevelOne();
    rig.click('Pause');
    expect(rig.app.dialogs.top).toBe('pause');
    const tick = rig.app.flow.session?.state.tick;
    rig.frames(30);
    expect(rig.app.flow.session?.state.tick).toBe(tick);
    rig.click('Resume');
    expect(rig.app.dialogs.top).toBeNull();
    rig.frames(5);
    expect(rig.app.flow.session?.state.tick).toBeGreaterThan(tick ?? 0);
  });

  it('toggles pause with the P key action and restarts with R', () => {
    startLevelOne();
    rig.frames(60);
    rig.app.togglePause();
    expect(rig.app.dialogs.top).toBe('pause');
    rig.app.togglePause();
    expect(rig.app.dialogs.top).toBeNull();
    rig.app.restart();
    expect(rig.app.flow.session?.state.tick).toBe(0);
    rig.app.togglePause();
    rig.app.restart();
    expect(rig.app.dialogs.top).toBeNull();
  });

  it('pauses itself when the app goes to the background and does not resume by itself', () => {
    startLevelOne();
    rig.fire('background');
    expect(rig.app.flow.session?.paused).toBe(true);
    rig.fire('foreground');
    expect(rig.app.flow.session?.paused).toBe(true);
    expect(rig.app.dialogs.top).toBe('pause');
  });

  it('Back pauses a running level, and Back again resumes it', () => {
    startLevelOne();
    rig.app.back();
    expect(rig.app.dialogs.top).toBe('pause');
    rig.app.back();
    expect(rig.app.dialogs.top).toBeNull();
    expect(rig.app.flow.session?.paused).toBe(false);
  });

  it('restart clears the attempt, counts it, and awards the persistence achievement at 25', () => {
    startLevelOne();
    for (let i = 0; i < 25; i++) rig.app.restart();
    expect(rig.services.progress.get().stats.restarts).toBe(25);
    expect(rig.ui.root.querySelector('.toasts')?.textContent).toContain('One More Try');
  });

  it('mutes and unmutes with the keyboard action and announces it', () => {
    rig.app.toggleMute();
    expect(rig.services.settings.get().muted).toBe(true);
    expect(document.getElementById('live')?.textContent).toBe('Sound off');
    rig.app.toggleMute();
    expect(document.getElementById('live')?.textContent).toBe('Sound on');
  });

  it('opens settings over a paused level and returns to the pause menu', () => {
    startLevelOne();
    rig.click('Pause');
    rig.click('Settings');
    expect(rig.app.dialogs.top).toBe('settings');
    expect(rig.app.flow.session).not.toBeNull();
    rig.app.back();
    expect(rig.app.dialogs.top).toBe('pause');
  });

  it('goes to the level list from the pause menu', () => {
    startLevelOne();
    rig.click('Pause');
    rig.click('Level select');
    expect(rig.app.currentRoute).toEqual({ name: 'levels', chapter: 1 });
    expect(rig.app.flow.session).toBeNull();
    expect(rig.bridge.playing).toBe(false);
    rig.app.back();
    expect(rig.app.currentRoute.name).toBe('chapters');
  });
});

describe('losing', () => {
  function lose(): void {
    startLevelOne();
    for (let wait = 0; wait < 400 && !rig.app.flow.session?.finished; wait += 40) {
      rig.app.restart();
      rig.frames(wait);
      rig.app.press();
      rig.app.release();
      rig.frames(900);
      if (rig.app.flow.session?.state.death) break;
    }
    vi.advanceTimersByTime(1000);
  }

  it('shows the loss dialog with Retry focused, then retries', () => {
    lose();
    expect(rig.app.flow.session?.state.death).not.toBeNull();
    expect(rig.app.dialogs.top).toBe('fail');
    expect(document.activeElement?.textContent).toContain('Retry');
    expect(rig.services.progress.get().stats.deaths).toBeGreaterThan(0);
    rig.click(/^Retry/);
    expect(rig.app.dialogs.top).toBeNull();
    expect(rig.app.flow.session?.state.tick).toBe(0);
  });

  it('Back from the loss dialog goes to the level list', () => {
    lose();
    rig.app.back();
    expect(rig.app.currentRoute.name).toBe('levels');
  });

  it('shortens the wait before the loss dialog when reduced motion is on', () => {
    rig.services.settings.update({ reducedMotion: true });
    startLevelOne();
    rig.app.press();
    rig.app.release();
    for (let i = 0; i < 1200 && !rig.app.flow.session?.finished; i++) rig.frame();
    if (rig.app.flow.session?.state.death) {
      vi.advanceTimersByTime(300);
      expect(rig.app.dialogs.top).toBe('fail');
    }
  });
});

describe('winning', () => {
  it('saves the clear at once, then offers the next level', () => {
    startLevelOne();
    rig.solve();
    expect(rig.app.flow.session?.won).toBe(true);
    const saved = JSON.parse(rig.store.get(PROGRESS_KEY) ?? '{}');
    expect(saved.data.levels['1'].stars).toBe(3);
    expect(rig.app.dialogs.top).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(rig.app.dialogs.top).toBe('win');
    expect(rig.text()).toContain('Level clear');
    expect(rig.text()).toContain('Liftoff');
    rig.click('Next level');
    expect(rig.app.flow.session?.level.id).toBe(2);
    expect(rig.haptic).toHaveBeenCalledWith('success');
  });

  it('replays the level from the win dialog', () => {
    startLevelOne();
    rig.solve();
    vi.advanceTimersByTime(1000);
    rig.click('Replay');
    expect(rig.app.flow.session?.state.tick).toBe(0);
  });

  it('offers a way back to the list after the final level', () => {
    rig.store.set(PROGRESS_KEY, progressWithClears(119));
    const last = createRig({ store: rig.store });
    last.click(/^Continue/);
    expect(last.app.flow.session?.level.id).toBe(120);
    last.solve();
    vi.advanceTimersByTime(1000);
    expect(last.text()).toContain('Back to levels');
    last.click('Back to levels');
    expect(last.app.currentRoute.name).toBe('levels');
  });

  it('Back from the win dialog goes to the level list', () => {
    startLevelOne();
    rig.solve();
    vi.advanceTimersByTime(1000);
    rig.app.back();
    expect(rig.app.currentRoute.name).toBe('levels');
  });

  it('does not show a stale dialog if the player left the level first', () => {
    startLevelOne();
    rig.solve();
    expect(rig.app.flow.session?.won).toBe(true);
    rig.app.flow.stop();
    vi.advanceTimersByTime(2000);
    expect(rig.app.dialogs.isOpen).toBe(false);
  });
});

describe('settings and progress controls', () => {
  it('changes settings from the screen and keeps them', () => {
    rig.click('Settings');
    rig.click(/Mute all sound/);
    rig.click(/High contrast/);
    rig.click('Tap twice');
    const current = rig.services.settings.get();
    expect(current).toMatchObject({ muted: true, highContrast: true, controlMode: 'tap' });
    expect(document.documentElement.dataset.contrast).toBe('high');
    const slider = rig.ui.root.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider).not.toBeNull();
    if (slider) {
      slider.value = '35';
      slider.dispatchEvent(new Event('input'));
      slider.dispatchEvent(new Event('change'));
    }
    expect(rig.services.settings.get().musicVolume).toBeCloseTo(0.35, 5);
  });

  it('applies a control-mode change to a level that is running', () => {
    startLevelOne();
    rig.app.press();
    rig.services.settings.update({ controlMode: 'tap' });
    expect(rig.app.flow.session?.aiming).toBe(false);
  });

  it('asks before erasing progress; cancel keeps it, confirm erases it', () => {
    rig.store.set(PROGRESS_KEY, progressWithClears(3));
    const seeded = createRig({ store: rig.store });
    seeded.click('Settings');
    seeded.click(/Reset progress/);
    expect(seeded.app.dialogs.top).toBe('confirm');
    seeded.click('Cancel');
    expect(seeded.services.progress.get().levels['3']).toBeDefined();
    seeded.click(/Reset progress/);
    seeded.app.back();
    expect(seeded.app.dialogs.top).toBeNull();
    seeded.click(/Reset progress/);
    seeded.click('Erase everything');
    expect(seeded.services.progress.get().levels['3']).toBeUndefined();
    expect(seeded.ui.root.querySelector('.toasts')?.textContent).toContain('Progress erased');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Haptics, createHapticsBackend, type HapticsBackend } from '../src/platform/haptics';
import { createLifecycle, type DocumentLike, type NativeApp } from '../src/platform/lifecycle';

afterEach(() => vi.unstubAllGlobals());

describe('Haptics', () => {
  it('does nothing when switched off or when the device has no backend', () => {
    const play = vi.fn();
    new Haptics({ play }, () => false).play('light');
    expect(play).not.toHaveBeenCalled();
    const none = new Haptics(null, () => true);
    expect(none.available).toBe(false);
    expect(() => none.play('heavy')).not.toThrow();
  });

  it('plays when enabled and swallows backend errors', () => {
    const play = vi.fn();
    const haptics = new Haptics({ play }, () => true);
    haptics.play('medium');
    expect(play).toHaveBeenCalledWith('medium');
    expect(haptics.available).toBe(true);
    const broken: HapticsBackend = { play: () => { throw new Error('motor'); } };
    expect(() => new Haptics(broken, () => true).play('light')).not.toThrow();
  });

  it('uses navigator.vibrate on the web when it exists', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const backend = createHapticsBackend();
    backend?.play('heavy');
    backend?.play('success');
    expect(vibrate).toHaveBeenNthCalledWith(1, 45);
    expect(vibrate).toHaveBeenNthCalledWith(2, [14, 40, 14]);
  });

  it('has no backend where vibration is unsupported or there is no navigator', () => {
    vi.stubGlobal('navigator', {});
    expect(createHapticsBackend()).toBeNull();
    vi.stubGlobal('navigator', undefined);
    expect(createHapticsBackend()).toBeNull();
  });
});

function fakeDocument() {
  const listeners = new Map<string, (() => void)[]>();
  const doc: DocumentLike & { visibilityState: string; emit(type: string): void } = {
    visibilityState: 'visible',
    addEventListener: (type, listener) => void listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: () => undefined,
    emit: (type) => (listeners.get(type) ?? []).forEach((listener) => listener()),
  };
  return doc;
}

describe('createLifecycle', () => {
  it('reports hiding and showing the page', () => {
    const doc = fakeDocument();
    const lifecycle = createLifecycle(doc, null);
    const away = vi.fn();
    const back = vi.fn();
    lifecycle.onBackground(away);
    lifecycle.onForeground(back);
    doc.visibilityState = 'hidden';
    doc.emit('visibilitychange');
    doc.visibilityState = 'visible';
    doc.emit('visibilitychange');
    doc.emit('pagehide');
    expect(away).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('stops calling a callback after it unsubscribes', () => {
    const doc = fakeDocument();
    const lifecycle = createLifecycle(doc, null);
    const callback = vi.fn();
    const off = lifecycle.onBackground(callback);
    off();
    doc.emit('pagehide');
    expect(callback).not.toHaveBeenCalled();
  });

  it('forwards the Android app state and back button', () => {
    const handlers: Record<string, (state: { isActive?: boolean }) => void> = {};
    const native: NativeApp = {
      addListener: (event, listener) => {
        handlers[event] = listener;
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    };
    const lifecycle = createLifecycle(fakeDocument(), native);
    const away = vi.fn();
    const back = vi.fn();
    const pressed = vi.fn();
    lifecycle.onBackground(away);
    lifecycle.onForeground(back);
    lifecycle.onBack(pressed);
    handlers.appStateChange?.({ isActive: false });
    handlers.appStateChange?.({ isActive: true });
    handlers.backButton?.({});
    expect(away).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    expect(pressed).toHaveBeenCalledTimes(1);
  });
});

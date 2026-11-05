import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export type Unsubscribe = () => void;

/** What the game needs to know about the app being sent away, brought back, or asked to go "back". */
export interface Lifecycle {
  onBackground(callback: () => void): Unsubscribe;
  onForeground(callback: () => void): Unsubscribe;
  /** Android back button (or its equivalent). */
  onBack(callback: () => void): Unsubscribe;
}

/** The slice of Document the lifecycle needs, so it can be tested without a browser. */
export interface DocumentLike {
  readonly visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface NativeApp {
  addListener(
    event: 'appStateChange' | 'backButton',
    listener: (state: { isActive?: boolean }) => void,
  ): Promise<{ remove(): Promise<void> }>;
}

class Hub {
  private readonly groups: Record<'background' | 'foreground' | 'back', Set<() => void>> = {
    background: new Set(),
    foreground: new Set(),
    back: new Set(),
  };

  fire(group: keyof Hub['groups']): void {
    for (const callback of [...this.groups[group]]) callback();
  }

  add(group: keyof Hub['groups'], callback: () => void): Unsubscribe {
    this.groups[group].add(callback);
    return () => this.groups[group].delete(callback);
  }
}

/**
 * Browser visibility plus, in the Android app, Capacitor's app-state and back-button events. The game pauses on
 * "background" and never resumes by itself: the player chooses when to continue.
 */
export function createLifecycle(doc: DocumentLike, native: NativeApp | null): Lifecycle {
  const hub = new Hub();
  doc.addEventListener('visibilitychange', () => hub.fire(doc.visibilityState === 'hidden' ? 'background' : 'foreground'));
  doc.addEventListener('pagehide', () => hub.fire('background'));
  if (native) {
    void native.addListener('appStateChange', (state) => hub.fire(state.isActive ? 'foreground' : 'background'));
    void native.addListener('backButton', () => hub.fire('back'));
  }
  return {
    onBackground: (callback) => hub.add('background', callback),
    onForeground: (callback) => hub.add('foreground', callback),
    onBack: (callback) => hub.add('back', callback),
  };
}

export function createDefaultLifecycle(): Lifecycle {
  return createLifecycle(document, Capacitor.isNativePlatform() ? (App as unknown as NativeApp) : null);
}

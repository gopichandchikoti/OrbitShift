import { Capacitor } from '@capacitor/core';
import { Haptics as NativeHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success';

export interface HapticsBackend {
  play(kind: HapticKind): void;
}

const VIBRATE_MS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 45,
  success: [14, 40, 14],
};

const IMPACT: Record<Exclude<HapticKind, 'success'>, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

function nativeBackend(): HapticsBackend {
  return {
    play: (kind) => {
      const request =
        kind === 'success'
          ? NativeHaptics.notification({ type: NotificationType.Success })
          : NativeHaptics.impact({ style: IMPACT[kind] });
      // A device without a vibration motor rejects; that is not worth reporting to the player.
      void request.catch(() => undefined);
    },
  };
}

function webBackend(nav: Navigator): HapticsBackend | null {
  if (typeof nav.vibrate !== 'function') return null;
  return { play: (kind) => void nav.vibrate(VIBRATE_MS[kind]) };
}

/** The best haptic backend here: the native plugin in the Android app, `navigator.vibrate` on the web, else none. */
export function createHapticsBackend(): HapticsBackend | null {
  if (Capacitor.isNativePlatform()) return nativeBackend();
  return typeof navigator === 'undefined' ? null : webBackend(navigator);
}

/** Plays haptic feedback only when the player has it switched on and the device can do it. */
export class Haptics {
  constructor(
    private readonly backend: HapticsBackend | null,
    private readonly enabled: () => boolean,
  ) {}

  get available(): boolean {
    return this.backend !== null;
  }

  play(kind: HapticKind): void {
    if (!this.backend || !this.enabled()) return;
    try {
      this.backend.play(kind);
    } catch {
      // Feedback is a nicety: never let it interrupt play.
    }
  }
}

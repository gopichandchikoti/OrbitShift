import type { Progress } from '../storage/progress-model';
import type { SettingsStore } from '../storage/settings';

/** Everything a screen may ask the application to do. Screens never touch the game or storage directly. */
export interface UiActions {
  play(levelId: number): void;
  continueGame(): void;
  openChapters(): void;
  openLevels(chapter: number): void;
  openSettings(): void;
  openHowTo(): void;
  openAchievements(): void;
  openCredits(): void;
  back(): void;
  resetProgress(): void;
  /** Small interface sounds; screens do not know about the audio engine. */
  click(): void;
  confirm(options: ConfirmOptions): void;
  announce(text: string): void;
}

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}

export interface UiContext {
  actions: UiActions;
  progress: () => Progress;
  settings: SettingsStore;
  hapticsAvailable: boolean;
}

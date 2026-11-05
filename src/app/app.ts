import { ATTRACT_LEVEL } from '../game/levels/attract';
import { PlaySession } from '../game/session';
import type { StageBridge } from '../phaser/bridge';
import type { Settings } from '../storage/settings';
import type { ConfirmOptions, UiActions, UiContext } from '../ui/context';
import { confirmDialog } from '../ui/dialogs';
import type { UiLayer } from '../ui/layer';
import { applyPalette, paletteFor } from '../ui/palette';
import { achievementsScreen, creditsScreen } from '../ui/screens/lists';
import { chaptersScreen, levelsScreen } from '../ui/screens/chapters';
import { howToScreen } from '../ui/screens/howto';
import { continueTarget, menuScreen } from '../ui/screens/menu';
import { settingsScreen } from '../ui/screens/settings';
import { DialogStack, type DialogKind } from './dialog-stack';
import { PlayFlow } from './play-flow';
import type { Services } from './services';

export type Route =
  | { name: 'menu' }
  | { name: 'chapters' }
  | { name: 'levels'; chapter: number }
  | { name: 'settings' }
  | { name: 'howto' }
  | { name: 'achievements' }
  | { name: 'credits' }
  | { name: 'play'; levelId: number };

export interface AppDeps {
  services: Services;
  ui: UiLayer;
  bridge: StageBridge;
}

/** Wires storage, sound, screens and the playfield together. It never touches Phaser: only the bridge object. */
export class App implements UiActions {
  readonly dialogs: DialogStack;
  readonly flow: PlayFlow;
  private readonly services: Services;
  private readonly ui: UiLayer;
  private readonly bridge: StageBridge;
  private readonly idle = new PlaySession(ATTRACT_LEVEL);
  private route: Route = { name: 'menu' };
  private history: Route[] = [];

  constructor(deps: AppDeps) {
    this.services = deps.services;
    this.ui = deps.ui;
    this.bridge = deps.bridge;
    this.dialogs = new DialogStack(this.ui);
    this.bridge.session = this.idle;
    this.flow = new PlayFlow({
      ui: this.ui,
      bridge: this.bridge,
      services: this.services,
      dialogs: this.dialogs,
      idleSession: () => this.idle,
      hooks: {
        play: (id) => this.play(id),
        toLevels: (chapter) => this.jumpToLevels(chapter),
        openSettings: () => this.openSettings(),
      },
    });
    this.bridge.onEvents = (events, session) => this.flow.onEvents(events, session);
    this.bridge.onPointer = (down) => this.pointer(down);
  }

  get context(): UiContext {
    return {
      actions: this,
      progress: () => this.services.progress.get(),
      settings: this.services.settings,
      hapticsAvailable: this.services.haptics.available,
    };
  }

  get currentRoute(): Route {
    return this.route;
  }

  start(): void {
    const { settings, lifecycle } = this.services;
    this.applySettings(settings.get());
    settings.subscribe((next) => this.applySettings(next));
    lifecycle.onBackground(() => this.sendAway());
    lifecycle.onForeground(() => this.services.engine.resume());
    lifecycle.onBack(() => this.back());
    if (!this.services.persistent) this.ui.toast('Storage is blocked here, so progress will not be saved.', 7000);
    if (this.services.progress.recovered) this.ui.toast('Your save could not be read and was restored from a backup.', 7000);
    this.render();
  }

  private applySettings(settings: Settings): void {
    const root = document.documentElement;
    root.dataset.contrast = settings.highContrast ? 'high' : 'standard';
    root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    applyPalette(root, paletteFor(settings.highContrast));
    this.services.engine.setLevels(settings);
    this.bridge.prefs.reducedMotion = settings.reducedMotion;
    this.bridge.prefs.highContrast = settings.highContrast;
    this.flow.session?.setControlMode(settings.controlMode);
  }

  /** First gesture of any kind: browsers only allow sound after one. */
  unlockAudio(): void {
    this.services.engine.unlock();
    this.services.music.start();
  }

  private sendAway(): void {
    this.flow.pause();
    this.services.engine.suspend();
  }

  private pointer(down: boolean): void {
    if (!this.flow.canAim) return;
    this.unlockAudio();
    if (down) this.flow.press();
    else this.flow.release();
  }

  // ---- navigation -------------------------------------------------------------------------------------------

  private go(route: Route): void {
    if (this.route.name !== 'play') this.history.push(this.route);
    this.route = route;
    this.render();
  }

  private jumpToLevels(chapter: number): void {
    this.history = [{ name: 'menu' }, { name: 'chapters' }];
    this.route = { name: 'levels', chapter };
    this.render();
  }

  private render(): void {
    const route = this.route;
    if (route.name === 'play') {
      this.flow.start(route.levelId);
      return;
    }
    if (this.flow.active) this.flow.stop();
    this.ui.show(this.screenFor(route));
  }

  private screenFor(route: Exclude<Route, { name: 'play' }>): HTMLElement {
    const ctx = this.context;
    switch (route.name) {
      case 'menu':
        return menuScreen(ctx);
      case 'chapters':
        return chaptersScreen(ctx);
      case 'levels':
        return levelsScreen(ctx, route.chapter);
      case 'settings':
        return settingsScreen(ctx);
      case 'howto':
        return howToScreen(ctx);
      case 'achievements':
        return achievementsScreen(ctx);
      case 'credits':
        return creditsScreen(ctx);
    }
  }

  // ---- UiActions --------------------------------------------------------------------------------------------

  play(levelId: number): void {
    this.unlockAudio();
    this.history.push(this.route.name === 'play' ? { name: 'menu' } : this.route);
    this.route = { name: 'play', levelId };
    this.render();
  }

  continueGame(): void {
    this.play(continueTarget(this.context));
  }

  openChapters(): void {
    this.go({ name: 'chapters' });
  }

  openLevels(chapter: number): void {
    this.go({ name: 'levels', chapter });
  }

  openSettings(): void {
    if (this.flow.active) {
      const element = settingsScreen(this.context);
      this.dialogs.open('settings', { element, focus: element.querySelector<HTMLElement>('button, input') ?? element });
      return;
    }
    this.go({ name: 'settings' });
  }

  openHowTo(): void {
    this.go({ name: 'howto' });
  }

  openAchievements(): void {
    this.go({ name: 'achievements' });
  }

  openCredits(): void {
    this.go({ name: 'credits' });
  }

  click(): void {
    this.unlockAudio();
    this.services.sfx.play('click');
  }

  announce(text: string): void {
    this.ui.announce(text);
  }

  confirm(options: ConfirmOptions): void {
    const handle = confirmDialog(options, () => this.dialogs.close('confirm'));
    this.dialogs.open('confirm', handle);
  }

  resetProgress(): void {
    this.services.progress.reset();
    this.ui.toast('Progress erased.');
    this.render();
  }

  /** Back button, Escape, or the Android back gesture: do the sensible thing for wherever the player is. */
  back(): void {
    const top = this.dialogs.top;
    if (top) {
      this.closeTop(top);
      return;
    }
    if (this.flow.active) {
      this.flow.pause();
      return;
    }
    const previous = this.history.pop();
    if (!previous) {
      this.services.exit();
      return;
    }
    this.route = previous;
    this.render();
  }

  private closeTop(kind: DialogKind): void {
    if (kind === 'pause') this.flow.resume();
    else if (kind === 'fail' || kind === 'win') this.flow.toLevels();
    else this.dialogs.close(kind);
  }

  // ---- keyboard shortcuts -------------------------------------------------------------------------------------

  togglePause(): void {
    if (!this.flow.active) return;
    if (this.dialogs.top === 'pause') this.flow.resume();
    else if (!this.dialogs.isOpen) this.flow.pause();
  }

  restart(): void {
    if (this.flow.active && this.dialogs.top !== 'confirm' && this.dialogs.top !== 'settings') this.flow.restart();
  }

  toggleMute(): void {
    const { settings } = this.services;
    const muted = !settings.get().muted;
    settings.update({ muted });
    this.ui.announce(muted ? 'Sound off' : 'Sound on');
  }

  /** Can the playfield be controlled with the keyboard right now? */
  get canAim(): boolean {
    return this.flow.canAim;
  }

  press(): void {
    this.unlockAudio();
    this.flow.press();
  }

  release(): void {
    this.flow.release();
  }
}

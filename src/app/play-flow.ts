import { achievementById } from '../game/achievements';
import { chapterOf } from '../game/levels/chapters';
import { levelById } from '../game/levels/catalog';
import { LEVEL_COUNT } from '../game/levels/chapters';
import { PlaySession } from '../game/session';
import type { SimEvent } from '../game/simulation/types';
import type { StageBridge } from '../phaser/bridge';
import { confirmDialog, failDialog, pauseDialog, winDialog, type DialogHandle } from '../ui/dialogs';
import { createHud, type Hud } from '../ui/hud';
import type { UiLayer } from '../ui/layer';
import type { DialogKind, DialogStack } from './dialog-stack';
import type { Services } from './services';

/** Delay between losing or winning and the dialog appearing, so the burst and the shake can be seen. */
const FAIL_DELAY_MS = 650;
const WIN_DELAY_MS = 800;
const HUD_REFRESH_MS = 100;
const HINT_MS = 12000;

export interface PlayHooks {
  play(levelId: number): void;
  toLevels(chapter: number): void;
  openSettings(): void;
}

export interface PlayDeps {
  ui: UiLayer;
  bridge: StageBridge;
  services: Services;
  dialogs: DialogStack;
  hooks: PlayHooks;
  /** Draws the menu's ambient scene again after leaving a level. */
  idleSession: () => PlaySession;
}

/** Runs one level at a time: starts it, reacts to what happens, saves the result and offers what comes next. */
export class PlayFlow {
  session: PlaySession | null = null;
  private hud: Hud | null = null;
  private timers: number[] = [];
  private hudTimer: number | null = null;

  constructor(private readonly deps: PlayDeps) {}

  get active(): boolean {
    return this.session !== null;
  }

  get canAim(): boolean {
    return this.session !== null && !this.session.paused && !this.session.finished && !this.deps.dialogs.isOpen;
  }

  start(levelId: number): void {
    const level = levelById(levelId);
    if (!level) return;
    this.teardown();
    const { ui, bridge, services } = this.deps;
    const session = new PlaySession(level, services.settings.get().controlMode);
    this.session = session;
    bridge.session = session;
    bridge.playing = true;
    this.hud = createHud(level, () => this.pause());
    this.hud.element.tabIndex = -1;
    ui.show(this.hud.element, this.hud.element);
    services.progress.setLastLevel(levelId);
    ui.announce(`Level ${levelId}, ${level.name}.${level.tutorialHint ? ` ${level.tutorialHint}` : ''}`);
    this.hudTimer = window.setInterval(() => this.refresh(), HUD_REFRESH_MS);
    if (level.tutorialHint) this.later(HINT_MS, () => this.hud?.dismissHint());
  }

  /** Leaves the level: cancels timers and shows the menu's ambient scene again. */
  stop(): void {
    this.teardown();
    this.deps.bridge.session = this.deps.idleSession();
    this.deps.bridge.playing = false;
  }

  private teardown(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
    if (this.hudTimer !== null) window.clearInterval(this.hudTimer);
    this.hudTimer = null;
    this.deps.dialogs.closeAll();
    this.hud = null;
    this.session = null;
  }

  private later(ms: number, action: () => void): void {
    this.timers.push(window.setTimeout(action, ms));
  }

  private refresh(): void {
    if (this.session) this.hud?.update(this.session);
  }

  press(): void {
    if (this.canAim) this.session?.press();
  }

  release(): void {
    if (this.canAim) this.session?.release();
  }

  pause(): void {
    const { session } = this;
    if (!session || session.finished || session.paused) return;
    session.pause();
    this.deps.services.sfx.play('pause');
    this.openDialog('pause', pauseDialog(session.level, {
      resume: () => this.resume(),
      restart: () => this.restart(),
      settings: () => this.deps.hooks.openSettings(),
      levels: () => this.toLevels(),
    }));
  }

  resume(): void {
    this.deps.dialogs.close('pause');
    this.session?.resume();
  }

  restart(): void {
    const { session } = this;
    if (!session) return;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
    this.deps.dialogs.closeAll();
    session.restart();
    this.deps.bridge.session = session;
    const earned = this.deps.services.progress.noteRestart();
    for (const id of earned) this.deps.ui.toast(`Achievement: ${achievementById(id)?.title ?? id}`);
    this.deps.ui.announce('Restarted.');
    this.refresh();
  }

  toLevels(): void {
    const level = this.session?.level;
    this.stop();
    this.deps.hooks.toLevels(level ? chapterOf(level.id) : 1);
  }

  /** Called by the stage with the events of each frame. */
  onEvents(events: readonly SimEvent[], session: PlaySession): void {
    if (session !== this.session) return;
    for (const event of events) this.handle(event, session);
    this.refresh();
  }

  private handle(event: SimEvent, session: PlaySession): void {
    const { sfx, haptics, progress } = this.deps.services;
    switch (event.type) {
      case 'launch':
        sfx.play('launch');
        haptics.play('light');
        progress.markTutorialDone();
        this.hud?.dismissHint();
        break;
      case 'capture':
        sfx.play('capture');
        haptics.play('light');
        break;
      case 'collect':
        sfx.play('shard');
        haptics.play('light');
        break;
      case 'gate-open':
        sfx.play('gate');
        haptics.play('medium');
        break;
      case 'teleport':
        sfx.play('teleport');
        haptics.play('light');
        break;
      case 'death':
        this.lose(session);
        break;
      case 'win':
        this.win(session);
        break;
    }
  }

  private lose(session: PlaySession): void {
    const { sfx, haptics, progress, settings } = this.deps.services;
    sfx.play('fail');
    haptics.play('heavy');
    progress.noteDeath();
    const delay = settings.get().reducedMotion ? 250 : FAIL_DELAY_MS;
    this.later(delay, () => {
      if (session !== this.session || !session.finished) return;
      this.deps.ui.announce(`Ship lost. ${session.state.death ?? ''}`);
      this.openDialog('fail', failDialog(session.state.death, { retry: () => this.restart(), levels: () => this.toLevels() }));
    });
  }

  private win(session: PlaySession): void {
    const { sfx, haptics, progress } = this.deps.services;
    sfx.play('win');
    haptics.play('success');
    const run = session.completion();
    if (!run) return;
    // Saved the instant the level is won, so even a process kill during the celebration keeps the clear.
    const result = progress.recordCompletion(run);
    const nextId = session.level.id + 1;
    this.later(WIN_DELAY_MS, () => {
      if (session !== this.session) return;
      this.deps.ui.announce(`Level clear. ${run.stars} of 3 stars.`);
      this.openDialog('win', winDialog(session.level, run, result, {
        hasNext: nextId <= LEVEL_COUNT,
        next: () => this.deps.hooks.play(nextId),
        replay: () => this.restart(),
        levels: () => this.toLevels(),
      }));
    });
  }

  confirm(handle: DialogHandle): void {
    this.openDialog('confirm', handle);
  }

  private openDialog(kind: DialogKind, handle: DialogHandle): void {
    this.deps.dialogs.open(kind, handle);
  }
}

export { confirmDialog };

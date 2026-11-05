/**
 * Development tools: the level inspector and `window.__orbit`, the hook the browser tests use. This file is only
 * imported behind `import.meta.env.DEV`, so none of it exists in a production build or in the APK.
 */
import { LEVEL_COUNT } from '../game/levels/chapters';
import { levelById } from '../game/levels/catalog';
import type { StageBridge } from '../phaser/bridge';
import { h } from '../ui/dom';
import type { App } from './app';
import type { Services } from './services';

export interface OrbitSnapshot {
  route: string;
  playing: boolean;
  dialog: string | null;
  levelId: number | null;
  tick: number;
  mode: string;
  launches: number;
  shards: number;
  aiming: boolean;
  paused: boolean;
  won: boolean;
  stars: number | null;
  death: string | null;
  ship: { x: number; y: number };
  previewPoints: number;
}

export interface OrbitDevApi {
  snapshot(): OrbitSnapshot;
  startLevel(id: number): void;
  /** The recorded winning release ticks of a level, and how long that run takes. */
  solution(id: number): { launchTicks: number[]; totalTicks: number } | null;
  unlockAll(): void;
  /** Replays the level's recorded solution through the live game (real rendering, sound, dialogs). */
  autopilot(on: boolean): void;
  setSpeed(multiplier: number): void;
  /** Runs up to `ticks` simulation steps right now, through the same event path the stage uses. */
  fastForward(ticks: number): void;
}

declare global {
  interface Window {
    __orbit?: OrbitDevApi;
  }
}

function snapshotOf(app: App, bridge: StageBridge): OrbitSnapshot {
  const session = app.flow.session;
  const base = { route: app.currentRoute.name, playing: bridge.playing, dialog: app.dialogs.top };
  if (!session) {
    return {
      ...base,
      levelId: null,
      tick: 0,
      mode: 'none',
      launches: 0,
      shards: 0,
      aiming: false,
      paused: false,
      won: false,
      stars: null,
      death: null,
      ship: { x: 0, y: 0 },
      previewPoints: 0,
    };
  }
  const { state } = session;
  return {
    ...base,
    levelId: session.level.id,
    tick: state.tick,
    mode: state.ship.mode,
    launches: state.launches,
    shards: session.shards,
    aiming: session.aiming,
    paused: session.paused,
    won: session.won,
    stars: session.stars,
    death: state.death,
    ship: { x: state.ship.x, y: state.ship.y },
    previewPoints: session.preview?.points.length ?? 0,
  };
}

export function installDev(app: App, bridge: StageBridge, services: Services): void {
  const api: OrbitDevApi = {
    snapshot: () => snapshotOf(app, bridge),
    startLevel: (id) => app.play(id),
    solution(id) {
      const level = levelById(id);
      return level ? { launchTicks: level.solution.launchTicks, totalTicks: level.solution.totalTicks } : null;
    },
    unlockAll() {
      for (let id = 1; id < LEVEL_COUNT; id++) {
        const level = levelById(id);
        if (!level) continue;
        services.progress.recordCompletion({ levelId: id, stars: 3, ticks: 1200, launches: 2, shards: 1 });
      }
    },
    autopilot(on) {
      const session = app.flow.session;
      if (session) session.autopilot = on ? session.level.solution.launchTicks : null;
    },
    setSpeed(multiplier) {
      bridge.timeScale = multiplier;
    },
    fastForward(ticks) {
      const session = app.flow.session;
      for (let i = 0; session && i < ticks && !session.finished; i++) {
        const events = session.update(1000 / 60);
        if (events.length > 0) bridge.onEvents(events, session);
      }
    },
  };
  window.__orbit = api;
  document.getElementById('ui')?.append(inspector(app, bridge, api));
}

function inspector(app: App, bridge: StageBridge, api: OrbitDevApi): HTMLElement {
  const level = h('input', { type: 'number', min: 1, max: LEVEL_COUNT, value: 1, 'aria-label': 'Level number' });
  const speed = h(
    'select',
    { 'aria-label': 'Simulation speed', onChange: () => api.setSpeed(Number(speed.value)) },
    ...[0.25, 0.5, 1, 2].map((s) => h('option', { value: s, selected: s === 1 }, `${s}x`)),
  );
  const debug = h('input', { type: 'checkbox', onChange: () => (bridge.debug = debug.checked) });
  return h(
    'details',
    { class: 'dev', 'aria-label': 'Developer inspector' },
    h('summary', {}, 'DEV'),
    h('label', {}, 'Level ', level, h('button', { type: 'button', onClick: () => app.play(Number(level.value)) }, 'Go')),
    h('label', {}, 'Speed ', speed),
    h('label', {}, debug, ' Collision outlines'),
    h('button', { type: 'button', onClick: () => app.restart() }, 'Restart'),
    h('button', { type: 'button', onClick: () => api.autopilot(true) }, 'Play recorded solution'),
    h('button', { type: 'button', onClick: () => api.unlockAll() }, 'Unlock all'),
  );
}

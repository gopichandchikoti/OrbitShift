import { vi } from 'vitest';
import { App } from '../../src/app/app';
import { createServices, type Services } from '../../src/app/services';
import { AudioEngine } from '../../src/audio/engine';
import { Haptics } from '../../src/platform/haptics';
import type { Lifecycle } from '../../src/platform/lifecycle';
import type { StageBridge } from '../../src/phaser/bridge';
import { MemoryStore } from '../../src/storage/store';
import { UiLayer } from '../../src/ui/layer';
import { FakeAudioContext, asContext } from './fake-audio';

export interface Rig {
  app: App;
  ui: UiLayer;
  bridge: StageBridge;
  services: Services;
  store: MemoryStore;
  audio: FakeAudioContext;
  haptic: ReturnType<typeof vi.fn>;
  exit: ReturnType<typeof vi.fn>;
  /** Fire the app lifecycle: the app going to the background, coming back, or the Android back button. */
  fire(kind: 'background' | 'foreground' | 'back'): void;
  /** Stand-in for the Phaser stage: advance the live session by wall-clock milliseconds and report its events. */
  frame(ms?: number): void;
  frames(count: number, ms?: number): void;
  /** Find a button by its text or aria-label. */
  button(label: string | RegExp): HTMLButtonElement;
  maybeButton(label: string | RegExp): HTMLButtonElement | null;
  click(label: string | RegExp): void;
  text(): string;
  /** Runs the level's recorded solution through the live session and returns once it has finished. */
  solve(): void;
}

export interface RigOptions {
  store?: MemoryStore;
  persistent?: boolean;
}

export function createRig(options: RigOptions = {}): Rig {
  document.body.innerHTML = '<div id="game"></div><div id="ui"></div><div id="live"></div>';
  document.documentElement.removeAttribute('data-contrast');
  document.documentElement.removeAttribute('data-motion');
  const root = document.getElementById('ui') as HTMLElement;
  const live = document.getElementById('live') as HTMLElement;
  const store = options.store ?? new MemoryStore();
  const audio = new FakeAudioContext();
  const haptic = vi.fn();
  const exit = vi.fn();
  const handlers: Record<'background' | 'foreground' | 'back', (() => void)[]> = {
    background: [],
    foreground: [],
    back: [],
  };
  const lifecycle: Lifecycle = {
    onBackground: (cb) => (handlers.background.push(cb), () => undefined),
    onForeground: (cb) => (handlers.foreground.push(cb), () => undefined),
    onBack: (cb) => (handlers.back.push(cb), () => undefined),
  };
  const base = createServices({
    store,
    engine: new AudioEngine(() => asContext(audio)),
    lifecycle,
    haptics: new Haptics({ play: haptic }, () => true),
    exit,
    systemReducedMotion: false,
  });
  const services: Services = { ...base, persistent: options.persistent ?? true };
  const ui = new UiLayer(root, live);
  const bridge = {
    prefs: { reducedMotion: false, highContrast: false },
    timeScale: 1,
    debug: false,
    playing: false,
  } as unknown as StageBridge;
  const app = new App({ services, ui, bridge });
  app.start();

  const find = (label: string | RegExp): HTMLButtonElement | null =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
      const labelled = Array.from(b.labels ?? []).map((l) => l.textContent ?? '').join(' ');
      const name = (b.getAttribute('aria-label') ?? (labelled || b.textContent) ?? '').trim();
      return typeof label === 'string' ? name.includes(label) : label.test(name);
    }) ?? null;

  const rig: Rig = {
    app,
    ui,
    bridge,
    services,
    store,
    audio,
    haptic,
    exit,
    fire: (kind) => handlers[kind].forEach((cb) => cb()),
    frame(ms = 1000 / 60) {
      const session = bridge.session;
      if (session.paused) return;
      const events = session.update(ms);
      if (events.length > 0) bridge.onEvents(events, session);
    },
    frames(count, ms) {
      for (let i = 0; i < count; i++) rig.frame(ms);
    },
    maybeButton: find,
    button(label) {
      const found = find(label);
      if (!found) throw new Error(`No button "${String(label)}". Buttons: ${Array.from(root.querySelectorAll('button')).map((b) => b.textContent).join(' | ')}`);
      return found;
    },
    click: (label) => rig.button(label).click(),
    text: () => root.textContent ?? '',
    solve() {
      const session = app.flow.session;
      if (!session) throw new Error('no level is running');
      session.autopilot = session.level.solution.launchTicks;
      for (let i = 0; i < session.level.solution.totalTicks + 60 && !session.finished; i++) rig.frame();
    },
  };
  return rig;
}

/** Seeds a progress save that has cleared levels 1..count. */
export function progressWithClears(count: number): string {
  const levels: Record<string, unknown> = {};
  for (let id = 1; id <= count; id++) levels[id] = { stars: 3, bestTicks: 600, bestLaunches: 2, bestShards: 1 };
  return JSON.stringify({
    version: 1,
    data: {
      levels,
      achievements: {},
      stats: { restarts: 0, deaths: 0, launches: 0 },
      lastLevel: count,
      tutorialDone: true,
    },
  });
}

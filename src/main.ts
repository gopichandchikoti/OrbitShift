import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/instrument-serif/latin-400.css';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './ui/styles.css';
import { App } from './app/app';
import { installKeys } from './app/keys';
import { trackCanvas } from './app/layout';
import { createServices } from './app/services';
import { createGame } from './phaser/game';
import type { StageBridge } from './phaser/bridge';
import { UiLayer } from './ui/layer';

/** Canvas text (the "projected path" label) needs its web font loaded before Phaser draws it. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('600 20px "IBM Plex Mono"'),
      document.fonts.load('italic 400 40px "Instrument Serif"'),
      document.fonts.load('600 30px "Instrument Sans Variable"'),
    ]);
  } catch {
    // The system fallback fonts are fine; never block the game on a font.
  }
}

async function boot(): Promise<void> {
  const root = document.getElementById('ui');
  const live = document.getElementById('live');
  const parent = document.getElementById('game');
  if (!root || !live || !parent) throw new Error('Orbit Shift: page structure is missing');
  await loadFonts();
  const services = createServices({
    exit: () => {
      if (Capacitor.isNativePlatform()) void NativeApp.exitApp();
    },
  });
  const ui = new UiLayer(root, live);
  const bridge = {
    prefs: { reducedMotion: services.settings.get().reducedMotion, highContrast: services.settings.get().highContrast },
    timeScale: 1,
    debug: false,
    playing: false,
  } as unknown as StageBridge;
  const app = new App({ services, ui, bridge });
  app.start();
  createGame(parent, bridge);
  trackCanvas(parent, (box) => ui.layout(box));
  installKeys(window, app, ui);
  window.addEventListener('pointerdown', () => app.unlockAudio(), { capture: true });
  if (import.meta.env.DEV) (await import('./app/dev')).installDev(app, bridge, services);
  document.getElementById('splash')?.remove();
}

void boot().catch((error: unknown) => {
  const splash = document.getElementById('splash');
  if (splash) splash.textContent = `Orbit Shift could not start: ${error instanceof Error ? error.message : 'unknown error'}`;
});

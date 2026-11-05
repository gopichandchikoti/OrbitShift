import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/levels/types';
import { STANDARD } from '../ui/palette';
import { BRIDGE_KEY, type StageBridge } from './bridge';
import { StageScene } from './stage-scene';

/**
 * Creates the one Phaser game. The canvas is a fixed 720 x 1280 portrait field scaled to fit, so a phone, a tablet
 * and a desktop window all play the same level; spare screen becomes dark margin that the page background continues.
 */
export function createGame(parent: HTMLElement, bridge: StageBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    backgroundColor: STANDARD.bg0,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Sound is synthesised by src/audio with the Web Audio API, so Phaser's own audio system is switched off.
    audio: { noAudio: true },
    banner: false,
    render: { antialias: true, powerPreference: 'high-performance' },
    input: { activePointers: 2, touch: { capture: true } },
    scene: [StageScene],
    callbacks: {
      // Runs before the first scene is created, so the scene can rely on the bridge being there.
      preBoot: (game) => game.registry.set(BRIDGE_KEY, bridge),
    },
  });
}

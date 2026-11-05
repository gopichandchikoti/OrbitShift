import type Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/levels/types';
import { toNumber, type Palette } from '../ui/palette';
import { seeded } from './draw/shapes';

interface Layer {
  gfx: Phaser.GameObjects.Graphics;
  /** How far this layer shifts per unit of ship offset; nearer layers shift more. */
  depth: number;
}

/**
 * Three parallax layers of stars, each drawn once. Moving a layer afterwards is just a position change, so the
 * starfield costs almost nothing per frame.
 */
export class Starfield {
  private readonly layers: Layer[] = [];

  constructor(scene: Phaser.Scene, seed: number, palette: Palette) {
    const rand = seeded(seed);
    const tints = [palette.line, palette.edge, palette.text].map(toNumber);
    [
      { count: 70, size: 1.1, alpha: 0.45, depth: 0.012 },
      { count: 38, size: 1.6, alpha: 0.6, depth: 0.03 },
      { count: 16, size: 2.2, alpha: 0.85, depth: 0.06 },
    ].forEach((spec, index) => {
      const gfx = scene.add.graphics().setDepth(-10 + index);
      gfx.fillStyle(tints[index] as number, spec.alpha);
      for (let i = 0; i < spec.count; i++) {
        const x = rand() * (WORLD_WIDTH + 80) - 40;
        const y = rand() * (WORLD_HEIGHT + 80) - 40;
        gfx.fillCircle(x, y, spec.size * (0.7 + rand() * 0.6));
      }
      this.layers.push({ gfx, depth: spec.depth });
    });
  }

  /** `dx`,`dy`: ship offset from the middle of the playfield. */
  shift(dx: number, dy: number): void {
    for (const layer of this.layers) layer.gfx.setPosition(-dx * layer.depth, -dy * layer.depth);
  }

  destroy(): void {
    for (const layer of this.layers) layer.gfx.destroy();
    this.layers.length = 0;
  }
}

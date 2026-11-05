import type { ShipView } from '../../game/simulation/ship-view';
import { toNumber } from '../../ui/palette';
import { lw, type Gfx, type Look } from './shapes';

const TRAIL_LENGTH = 18;

/** The last few positions of the ship, in a ring buffer allocated once. */
export class Trail {
  private readonly xs = new Float32Array(TRAIL_LENGTH);
  private readonly ys = new Float32Array(TRAIL_LENGTH);
  private head = 0;
  private size = 0;

  push(x: number, y: number): void {
    this.head = (this.head + 1) % TRAIL_LENGTH;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.size = Math.min(this.size + 1, TRAIL_LENGTH);
  }

  clear(): void {
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  draw(g: Gfx, color: number, width: number): void {
    for (let i = 1; i < this.size; i++) {
      const from = (this.head - i + 1 + TRAIL_LENGTH * 2) % TRAIL_LENGTH;
      const to = (this.head - i + TRAIL_LENGTH * 2) % TRAIL_LENGTH;
      const fade = 1 - i / this.size;
      g.lineStyle(width * fade + 0.5, color, fade * 0.7);
      g.lineBetween(this.xs[from] as number, this.ys[from] as number, this.xs[to] as number, this.ys[to] as number);
    }
  }
}

/**
 * The ship: an arrowhead pointing where it is heading. In orbit it wears a teal safety ring (a shape, so "safe" does
 * not depend on colour); in flight it shows a flame.
 */
export function drawShip(g: Gfx, view: ShipView, look: Look): void {
  const amber = toNumber(look.palette.amber);
  const { heading, mode } = view;
  const point = (reach: number, turn: number): [number, number] => [
    view.x + Math.cos(heading + turn) * reach,
    view.y + Math.sin(heading + turn) * reach,
  ];
  if (mode === 'orbit') {
    g.lineStyle(lw(look, 1.8), toNumber(look.palette.teal), 0.9);
    g.strokeCircle(view.x, view.y, 21);
  }
  if (mode === 'flight') {
    const [fx, fy] = point(-21 - Math.sin(look.clock * 40) * 4, 0);
    const [lx, ly] = point(-8, 0.45);
    const [rx, ry] = point(-8, -0.45);
    g.fillStyle(0xffd9a0, 0.85);
    g.fillTriangle(lx, ly, rx, ry, fx, fy);
  }
  const [tx, ty] = point(16, 0);
  const [lx, ly] = point(13, 2.55);
  const [nx, ny] = point(5, Math.PI);
  const [rx, ry] = point(13, -2.55);
  g.fillStyle(amber, 1);
  g.beginPath();
  g.moveTo(tx, ty);
  g.lineTo(lx, ly);
  g.lineTo(nx, ny);
  g.lineTo(rx, ry);
  g.closePath();
  g.fillPath();
  g.lineStyle(lw(look, 1.6), 0xffffff, 0.95);
  g.strokePath();
}

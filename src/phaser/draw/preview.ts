import type { Prediction } from '../../game/simulation/flight';
import type { Vec } from '../../game/levels/types';
import { toNumber } from '../../ui/palette';
import { lw, type Gfx, type Look } from './shapes';

function endMarker(g: Gfx, at: Vec, prediction: Prediction, look: Look): void {
  const { palette } = look;
  const outcome = prediction.outcome;
  if (outcome.kind === 'death') {
    g.lineStyle(lw(look, 3), toNumber(palette.coral), 1);
    g.lineBetween(at.x - 8, at.y - 8, at.x + 8, at.y + 8);
    g.lineBetween(at.x - 8, at.y + 8, at.x + 8, at.y - 8);
    return;
  }
  if (outcome.kind === 'capture' || outcome.kind === 'goal') {
    g.lineStyle(lw(look, 2.4), toNumber(palette.teal), 1);
    g.strokeCircle(at.x, at.y, outcome.kind === 'goal' ? 14 : 10);
    g.fillStyle(toNumber(palette.teal), 1);
    g.fillCircle(at.x, at.y, 3);
    return;
  }
  g.fillStyle(toNumber(palette.textDim), 1);
  for (let i = -1; i <= 1; i++) g.fillCircle(at.x + i * 7, at.y, 2);
}

/**
 * The dotted projected path. It is the real simulation run forward, not an approximation, and its end marker says
 * how the flight would finish: a ring for a landing or the portal, a cross for a loss, dots if it is still open.
 * Returns the point where a label can sit.
 */
export function drawPreview(g: Gfx, prediction: Prediction, look: Look): Vec | null {
  const points = prediction.points;
  if (points.length < 2) return null;
  const amber = toNumber(look.palette.amber);
  const count = points.length;
  for (let i = 1; i < count - 1; i++) {
    const point = points[i] as Vec;
    const fade = 1 - (i / count) * 0.6;
    g.fillStyle(amber, Math.max(0.35, fade));
    g.fillCircle(point.x, point.y, look.highContrast ? 3.2 : 2.5);
  }
  endMarker(g, points[count - 1] as Vec, prediction, look);
  return points[Math.min(9, count - 2)] as Vec;
}

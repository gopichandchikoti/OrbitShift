import type Phaser from 'phaser';
import type { Vec } from '../../game/levels/types';
import type { Palette } from '../../ui/palette';

export type Gfx = Phaser.GameObjects.Graphics;

export const TAU = Math.PI * 2;

/** Everything a drawing routine needs to know about the current look. */
export interface Look {
  palette: Palette;
  /** Thicker strokes, brighter colours, no faint decorative fills. */
  highContrast: boolean;
  /** Seconds, frozen at 0 when reduced motion is on so decorative animation stops. */
  clock: number;
}

export interface Circle extends Vec {
  r: number;
}

export interface Radii {
  inner: number;
  outer: number;
}

/** An angular range, radians, clockwise on screen. */
export interface Span {
  from: number;
  to: number;
}

export interface Dashes {
  count: number;
  /** Fraction of each slot that is inked. */
  fill: number;
  /** Rotation of the whole ring, radians. */
  spin?: number;
}

/** Stroke width scaled up in high-contrast mode. */
export function lw(look: Look, base: number): number {
  return look.highContrast ? base * 1.7 : base;
}

/** A ring drawn as dashes. */
export function dashedCircle(g: Gfx, circle: Circle, dashes: Dashes): void {
  const slot = TAU / dashes.count;
  for (let i = 0; i < dashes.count; i++) {
    const start = (dashes.spin ?? 0) + i * slot;
    g.beginPath();
    g.arc(circle.x, circle.y, circle.r, start, start + slot * dashes.fill, false);
    g.strokePath();
  }
}

/** An annular slice, filled. */
export function sectorBand(g: Gfx, center: Vec, radii: Radii, span: Span): void {
  g.beginPath();
  g.arc(center.x, center.y, radii.outer, span.from, span.to, false);
  g.arc(center.x, center.y, radii.inner, span.to, span.from, true);
  g.closePath();
  g.fillPath();
}

function radialLine(g: Gfx, center: Vec, radii: Radii, angle: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  g.lineBetween(
    center.x + cos * radii.inner,
    center.y + sin * radii.inner,
    center.x + cos * radii.outer,
    center.y + sin * radii.outer,
  );
}

/** The outline of an annular slice: solid, or built from short segments when `dashed`. */
export function sectorOutline(g: Gfx, center: Vec, radii: Radii, span: Span & { dashed: boolean }): void {
  const { from, to } = span;
  if (!span.dashed) {
    g.beginPath();
    g.arc(center.x, center.y, radii.outer, from, to, false);
    g.lineTo(center.x + Math.cos(to) * radii.inner, center.y + Math.sin(to) * radii.inner);
    g.arc(center.x, center.y, radii.inner, to, from, true);
    g.closePath();
    g.strokePath();
    return;
  }
  const steps = Math.max(6, Math.round((to - from) / 0.12));
  for (let i = 0; i < steps; i += 2) {
    const a = from + ((to - from) * i) / steps;
    const b = from + ((to - from) * (i + 1)) / steps;
    for (const r of [radii.inner, radii.outer]) {
      g.beginPath();
      g.arc(center.x, center.y, r, a, b, false);
      g.strokePath();
    }
  }
  radialLine(g, center, radii, from);
  radialLine(g, center, radii, to);
}

export function diamond(g: Gfx, at: Vec, r: number): void {
  g.beginPath();
  g.moveTo(at.x, at.y - r);
  g.lineTo(at.x + r * 0.78, at.y);
  g.lineTo(at.x, at.y + r);
  g.lineTo(at.x - r * 0.78, at.y);
  g.closePath();
}

export function hexagon(g: Gfx, at: Vec, r: number): void {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    if (i === 0) g.moveTo(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
    else g.lineTo(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
  }
  g.closePath();
}

/** A rectangle rotated about its centre, as a path (fill or stroke it afterwards). */
export function rotatedRect(g: Gfx, c: Vec, size: { w: number; h: number }, angle: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners: [number, number][] = [
    [-size.w / 2, -size.h / 2],
    [size.w / 2, -size.h / 2],
    [size.w / 2, size.h / 2],
    [-size.w / 2, size.h / 2],
  ];
  g.beginPath();
  corners.forEach(([dx, dy], i) => {
    const px = c.x + dx * cos - dy * sin;
    const py = c.y + dx * sin + dy * cos;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
}

/** Small outward-pointing chevron, used to show push direction. */
export function chevron(g: Gfx, at: Vec, angle: number, size: number): void {
  const spread = 0.7;
  g.beginPath();
  g.moveTo(at.x - Math.cos(angle - spread) * size, at.y - Math.sin(angle - spread) * size);
  g.lineTo(at.x, at.y);
  g.lineTo(at.x - Math.cos(angle + spread) * size, at.y - Math.sin(angle + spread) * size);
  g.strokePath();
}

/** A point on a circle: handy for placing chevrons and pips around a centre. */
export function onRing(center: Vec, radius: number, angle: number): Vec {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/** Deterministic 0..1 values from an integer seed, so a rock keeps its shape from frame to frame. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import type { Goal, InversionField, LaserArc, RepulsionPulse, ShieldGate, Vec, Wormhole } from '../../game/levels/types';
import { cyclePhase, laserStartAngle } from '../../game/simulation/motion';
import { toNumber } from '../../ui/palette';
import { TAU, chevron, dashedCircle, lw, onRing, sectorBand, sectorOutline, type Gfx, type Look } from './shapes';

/** The tick that decides firing phase, and the fractional tick used for smooth rotation only. */
export interface LaserClock {
  tick: number;
  smooth: number;
}

function drawLaserBeam(g: Gfx, laser: LaserArc, from: number, look: Look): void {
  const coral = toNumber(look.palette.coral);
  const c = { x: laser.cx, y: laser.cy };
  const radii = { inner: laser.innerR, outer: laser.outerR };
  const to = from + laser.width;
  g.fillStyle(coral, 0.5);
  sectorBand(g, c, radii, { from, to });
  g.fillStyle(0xffffff, 0.3);
  sectorBand(g, c, { inner: radii.inner + 8, outer: radii.outer - 8 }, { from: from + 0.04, to: to - 0.04 });
  g.lineStyle(lw(look, 2.6), coral, 1);
  sectorOutline(g, c, radii, { from, to, dashed: false });
}

/**
 * Laser arc. Warning = dashed outline that fills in; firing = solid, bright band. The dashed-to-solid change is the
 * cue, so it reads without colour.
 */
export function drawLaser(g: Gfx, laser: LaserArc, time: LaserClock, look: Look): void {
  const coral = toNumber(look.palette.coral);
  const from = laserStartAngle(laser, time.smooth);
  const c = { x: laser.cx, y: laser.cy };
  const radii = { inner: laser.innerR, outer: laser.outerR };
  const phase = cyclePhase(time.tick, laser);
  if (phase === 'on') {
    drawLaserBeam(g, laser, from, look);
  } else if (phase === 'warn') {
    const progress = (time.tick % laser.period) / laser.warn;
    g.fillStyle(coral, 0.06 + 0.14 * progress);
    sectorBand(g, c, radii, { from, to: from + laser.width });
    g.lineStyle(lw(look, 2.2), coral, 0.9);
    sectorOutline(g, c, radii, { from, to: from + laser.width, dashed: true });
  } else {
    g.lineStyle(lw(look, 1.2), coral, look.highContrast ? 0.7 : 0.2);
    sectorOutline(g, c, radii, { from, to: from + laser.width, dashed: true });
  }
  g.lineStyle(lw(look, 2), coral, 1);
  g.strokeCircle(c.x, c.y, 7);
  g.fillStyle(coral, 1);
  g.fillCircle(c.x, c.y, 3);
}

function drawPulsePush(g: Gfx, pulse: RepulsionPulse, look: Look): void {
  const ice = toNumber(look.palette.ice);
  g.fillStyle(ice, 0.2);
  g.fillCircle(pulse.x, pulse.y, pulse.radius);
  g.lineStyle(lw(look, 2.6), ice, 1);
  g.strokeCircle(pulse.x, pulse.y, pulse.radius);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    chevron(g, onRing(pulse, pulse.radius * 0.62, a), a, 9);
  }
}

/** Repulsion pulse: a ring that contracts while warning, then a ring with outward chevrons while pushing. */
export function drawPulse(g: Gfx, pulse: RepulsionPulse, tick: number, look: Look): void {
  const ice = toNumber(look.palette.ice);
  const phase = cyclePhase(tick, pulse);
  g.lineStyle(lw(look, 1.2), ice, look.highContrast ? 0.7 : 0.18);
  g.strokeCircle(pulse.x, pulse.y, pulse.radius);
  if (phase === 'warn') {
    const progress = (tick % pulse.period) / pulse.warn;
    g.lineStyle(lw(look, 2.2), ice, 0.9);
    dashedCircle(g, { x: pulse.x, y: pulse.y, r: pulse.radius * (1 - 0.65 * progress) }, { count: 28, fill: 0.55 });
  } else if (phase === 'on') {
    drawPulsePush(g, pulse, look);
  }
  g.fillStyle(ice, 1);
  g.fillCircle(pulse.x, pulse.y, 8);
  g.lineStyle(lw(look, 2), 0xffffff, 0.9);
  g.strokeCircle(pulse.x, pulse.y, 8);
}

/** Inversion field: a dashed violet disc with chevrons pointing outward, meaning "pulls become pushes". */
export function drawInversion(g: Gfx, field: InversionField, look: Look): void {
  const violet = toNumber(look.palette.violet);
  g.fillStyle(violet, look.highContrast ? 0.16 : 0.08);
  g.fillCircle(field.x, field.y, field.radius);
  g.lineStyle(lw(look, 2), violet, 0.95);
  dashedCircle(g, { x: field.x, y: field.y, r: field.radius }, { count: 30, fill: 0.5, spin: look.clock * 0.15 });
  g.lineStyle(lw(look, 2), violet, 0.85);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    chevron(g, onRing(field, field.radius * 0.55, a), a, 8);
  }
}

function mouth(g: Gfx, at: Vec, r: number, look: Look): void {
  const violet = toNumber(look.palette.violet);
  g.fillStyle(0x0b0620, 1);
  g.fillCircle(at.x, at.y, r);
  g.lineStyle(lw(look, 2.4), violet, 1);
  g.strokeCircle(at.x, at.y, r);
  g.lineStyle(lw(look, 1.8), violet, 0.85);
  for (const [scale, offset] of [
    [0.72, 0],
    [0.46, 2.1],
  ] as const) {
    g.beginPath();
    g.arc(at.x, at.y, r * scale, look.clock * 2 + offset, look.clock * 2 + offset + 4.2, false);
    g.strokePath();
  }
  g.fillStyle(violet, 1);
  g.fillCircle(at.x, at.y, 3);
}

/** Dotted line between two points. */
function dottedLine(g: Gfx, a: Vec, b: Vec, steps: number): void {
  for (let i = 0; i < steps; i += 2) {
    const from = i / steps;
    const to = (i + 1) / steps;
    g.lineBetween(a.x + (b.x - a.x) * from, a.y + (b.y - a.y) * from, a.x + (b.x - a.x) * to, a.y + (b.y - a.y) * to);
  }
}

/** Wormhole: two matching spiral mouths joined by a faint dotted line. */
export function drawWormhole(g: Gfx, hole: Wormhole, look: Look): void {
  g.lineStyle(lw(look, 1.2), toNumber(look.palette.violet), look.highContrast ? 0.6 : 0.2);
  dottedLine(g, hole.a, hole.b, 22);
  mouth(g, hole.a, hole.radius, look);
  mouth(g, hole.b, hole.radius, look);
}

/** Shield gate: a solid barrier with crossed posts while closed; a faint dotted line with open posts once opened. */
export function drawGate(g: Gfx, gate: ShieldGate, open: boolean, look: Look): void {
  const color = toNumber(open ? look.palette.teal : look.palette.coral);
  const dx = gate.b.x - gate.a.x;
  const dy = gate.b.y - gate.a.y;
  const steps = Math.max(8, Math.round(Math.hypot(dx, dy) / 12));
  g.lineStyle(open ? lw(look, 1.5) : lw(look, 5), color, open ? 0.5 : 0.95);
  if (open) {
    dottedLine(g, gate.a, gate.b, steps);
  } else {
    g.lineBetween(gate.a.x, gate.a.y, gate.b.x, gate.b.y);
  }
  for (const end of [gate.a, gate.b]) {
    g.fillStyle(0x0b1030, 1);
    g.fillCircle(end.x, end.y, 9);
    g.lineStyle(lw(look, 2.4), color, 1);
    g.strokeCircle(end.x, end.y, 9);
    if (open) continue;
    g.lineBetween(end.x - 4, end.y - 4, end.x + 4, end.y + 4);
    g.lineBetween(end.x - 4, end.y + 4, end.x + 4, end.y - 4);
  }
}

function padlock(g: Gfx, at: Vec, color: number, look: Look): void {
  g.lineStyle(lw(look, 2.4), color, 1);
  g.beginPath();
  g.arc(at.x, at.y - 5, 6, Math.PI, 0, false);
  g.strokePath();
  g.fillStyle(color, 1);
  g.fillRoundedRect(at.x - 9, at.y - 5, 18, 14, 3);
}

function drawGoalLocked(g: Gfx, goal: Goal, shards: number, look: Look): void {
  const dim = toNumber(look.palette.textDim);
  const gold = toNumber(look.palette.gold);
  g.lineStyle(lw(look, 2.4), dim, 0.95);
  dashedCircle(g, { x: goal.x, y: goal.y, r: goal.radius }, { count: 24, fill: 0.55 });
  g.fillStyle(toNumber(look.palette.bg0), 0.85);
  g.fillCircle(goal.x, goal.y, goal.radius - 4);
  padlock(g, { x: goal.x, y: goal.y - 2 }, dim, look);
  for (let i = 0; i < goal.requiredShards; i++) {
    const px = goal.x + (i - (goal.requiredShards - 1) / 2) * 16;
    g.lineStyle(lw(look, 1.6), gold, 1);
    g.fillStyle(gold, i < shards ? 1 : 0);
    g.fillCircle(px, goal.y + goal.radius + 14, 5);
    g.strokeCircle(px, goal.y + goal.radius + 14, 5);
  }
}

/** Exit portal. Open: bright rings that turn. Locked: a dashed ring with a padlock and one pip per needed shard. */
export function drawGoal(g: Gfx, goal: Goal, shards: number, look: Look): void {
  if (shards < goal.requiredShards) {
    drawGoalLocked(g, goal, shards, look);
    return;
  }
  const teal = toNumber(look.palette.teal);
  const r = goal.radius;
  g.fillStyle(teal, 0.14);
  g.fillCircle(goal.x, goal.y, r);
  g.lineStyle(lw(look, 3), teal, 1);
  g.strokeCircle(goal.x, goal.y, r);
  g.lineStyle(lw(look, 2), teal, 0.8);
  dashedCircle(g, { x: goal.x, y: goal.y, r: r * 0.72 }, { count: 16, fill: 0.55, spin: look.clock * 0.9 });
  g.lineStyle(lw(look, 2), 0xffffff, 0.9);
  dashedCircle(g, { x: goal.x, y: goal.y, r: r * 0.4 }, { count: 8, fill: 0.6, spin: -look.clock * 1.3 });
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(goal.x, goal.y, 4);
}

import type { Asteroid, Collectible, Planet, PlanetMotion, Satellite, Vec } from '../../game/levels/types';
import { CAPTURE_MARGIN } from '../../game/simulation/constants';
import { orbitRadiusOf } from '../../game/simulation/runtime';
import { PLANET_STYLES, toNumber } from '../../ui/palette';
import { TAU, dashedCircle, diamond, hexagon, lw, rotatedRect, seeded, type Gfx, type Look } from './shapes';

const ROCK_FILL = 0x4a4560;

/** Faint pull glow, capture ring and the dashed safe orbit lane. */
function drawPlanetZones(g: Gfx, planet: Planet, at: Vec, look: Look): void {
  const { palette } = look;
  if (look.highContrast) {
    g.lineStyle(1.5, toNumber(palette.edge), 0.35);
    g.strokeCircle(at.x, at.y, planet.influence);
  } else {
    g.fillStyle(toNumber(palette.edge), 0.022);
    for (let k = 0; k < 3; k++) g.fillCircle(at.x, at.y, planet.influence * (1 - k * 0.2));
  }
  const lane = orbitRadiusOf(planet);
  g.lineStyle(lw(look, 1), toNumber(palette.teal), look.highContrast ? 0.6 : 0.2);
  g.strokeCircle(at.x, at.y, lane + CAPTURE_MARGIN);
  g.lineStyle(lw(look, 1.6), toNumber(palette.teal), look.highContrast ? 0.95 : 0.6);
  dashedCircle(g, { ...at, r: lane }, { count: 40, fill: 0.55 });
}

/** A planet: its zones, a shaded sphere with a highlight, and (for some styles) a ring. */
export function drawPlanet(g: Gfx, planet: Planet, at: Vec, look: Look): void {
  const style = PLANET_STYLES[planet.style % PLANET_STYLES.length] ?? PLANET_STYLES[0];
  const lit = toNumber(style?.lit ?? '#6f8cff');
  const r = planet.radius;
  drawPlanetZones(g, planet, at, look);
  g.fillStyle(toNumber(style?.shade ?? '#27357a'), 1);
  g.fillCircle(at.x, at.y, r);
  g.fillStyle(lit, 1);
  g.fillCircle(at.x - r * 0.16, at.y - r * 0.16, r * 0.84);
  g.fillStyle(0xffffff, 0.2);
  g.fillCircle(at.x - r * 0.36, at.y - r * 0.36, r * 0.26);
  g.lineStyle(lw(look, 2), toNumber(look.palette.edge), 0.75);
  g.strokeCircle(at.x, at.y, r);
  if (planet.style % 3 === 2) {
    g.lineStyle(lw(look, 3), lit, 0.75);
    g.strokeEllipse(at.x, at.y, r * 3.1, r * 0.95);
  }
}

/** The faint track a moving planet follows, so its route can be read before it arrives. */
export function drawMotionTrack(g: Gfx, motion: PlanetMotion, look: Look): void {
  g.lineStyle(lw(look, 1.2), toNumber(look.palette.textDim), look.highContrast ? 0.7 : 0.28);
  if (motion.kind === 'orbit') {
    dashedCircle(g, { x: motion.cx, y: motion.cy, r: motion.radius }, { count: 48, fill: 0.4 });
    return;
  }
  const steps = 14;
  for (let i = 0; i < steps; i += 2) {
    const a = i / steps;
    const b = (i + 1) / steps;
    g.lineBetween(
      motion.ax + (motion.bx - motion.ax) * a,
      motion.ay + (motion.by - motion.ay) * a,
      motion.ax + (motion.bx - motion.ax) * b,
      motion.ay + (motion.by - motion.ay) * b,
    );
  }
}

/** Asteroid: a jagged grey rock with a coral outline. The jagged outline, not the colour, marks it as lethal. */
export function drawAsteroid(g: Gfx, rock: Asteroid, look: Look): void {
  const rand = seeded(rock.seed);
  const sides = 9;
  g.fillStyle(ROCK_FILL, 1);
  g.lineStyle(lw(look, 2.4), toNumber(look.palette.coral), 1);
  g.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * TAU + (rand() - 0.5) * 0.4;
    const reach = rock.radius * (0.78 + rand() * 0.4);
    const x = rock.x + Math.cos(angle) * reach;
    const y = rock.y + Math.sin(angle) * reach;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(0x2c2840, 0.8);
  g.fillCircle(rock.x - rock.radius * 0.25, rock.y - rock.radius * 0.15, rock.radius * 0.18);
  g.fillCircle(rock.x + rock.radius * 0.3, rock.y + rock.radius * 0.28, rock.radius * 0.12);
}

/** Where a satellite is and which way it faces (along its orbit). */
export interface SatellitePose {
  at: Vec;
  heading: number;
}

/** Satellite: a square body with two solar panels, turned to face along its orbit. */
export function drawSatellite(g: Gfx, sat: Satellite, pose: SatellitePose, look: Look): void {
  const { at, heading } = pose;
  const coral = toNumber(look.palette.coral);
  g.lineStyle(lw(look, 2), coral, 1);
  g.fillStyle(0x3a2f4a, 1);
  for (const side of [-1, 1]) {
    const px = at.x + Math.cos(heading + Math.PI / 2) * side * 15;
    const py = at.y + Math.sin(heading + Math.PI / 2) * side * 15;
    rotatedRect(g, { x: px, y: py }, { w: 9, h: 15 }, heading);
    g.fillPath();
    g.strokePath();
  }
  g.fillStyle(coral, 1);
  rotatedRect(g, at, { w: sat.radius * 1.3, h: sat.radius * 1.3 }, heading);
  g.fillPath();
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(at.x, at.y, 2);
}

/** Shard: a gold diamond that bobs. A switch is a hollow hexagon, so the two differ in shape. */
export function drawCollectible(g: Gfx, item: Collectible, look: Look): void {
  const gold = toNumber(look.palette.gold);
  const at = { x: item.x, y: item.y + Math.sin(look.clock * 3 + item.x * 0.05) * 2.2 };
  if (item.kind === 'shard') {
    g.fillStyle(gold, 0.18);
    g.fillCircle(at.x, at.y, 17);
    g.fillStyle(gold, 1);
    diamond(g, at, 11);
    g.fillPath();
    g.lineStyle(lw(look, 1.4), 0xffffff, 0.9);
    diamond(g, at, 11);
    g.strokePath();
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(at.x - 2, at.y - 3, 2);
    return;
  }
  g.lineStyle(lw(look, 2.6), gold, 1);
  hexagon(g, at, 12);
  g.strokePath();
  g.fillStyle(gold, 1);
  g.fillCircle(at.x, at.y, 4);
}

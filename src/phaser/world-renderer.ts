import type Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/levels/types';
import type { PlaySession } from '../game/session';
import { gateIsOpen } from '../game/simulation/collision';
import { planetPosition, satellitePosition } from '../game/simulation/motion';
import { viewShip, type ShipView } from '../game/simulation/ship-view';
import { shardCount } from '../game/simulation/state';
import { toNumber } from '../ui/palette';
import { drawAsteroid, drawCollectible, drawMotionTrack, drawPlanet, drawSatellite } from './draw/bodies';
import { drawDebug } from './draw/debug';
import { drawGate, drawGoal, drawInversion, drawLaser, drawPulse, drawWormhole } from './draw/fields';
import { drawPreview } from './draw/preview';
import { dashedCircle, type Gfx, type Look } from './draw/shapes';
import { Trail, drawShip } from './draw/ship';
import { Effects } from './effects';
import { Starfield } from './starfield';

const PREVIEW_LABEL = 'PROJECTED PATH';

/** Draws one session. Static scenery is drawn once per level; everything that moves is redrawn each frame. */
export class WorldRenderer {
  readonly effects = new Effects();
  private readonly staticGfx: Gfx;
  private readonly dynamicGfx: Gfx;
  private readonly fxGfx: Gfx;
  private readonly label: Phaser.GameObjects.Text;
  private readonly trail = new Trail();
  private starfield: Starfield | null = null;
  private loaded: PlaySession | null = null;
  private loadedContrast: boolean | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.staticGfx = scene.add.graphics().setDepth(0);
    this.dynamicGfx = scene.add.graphics().setDepth(5);
    this.fxGfx = scene.add.graphics().setDepth(8);
    this.label = scene.add
      .text(0, 0, PREVIEW_LABEL, { fontFamily: '"IBM Plex Mono", monospace', fontSize: '20px', color: '#ffb454' })
      .setDepth(9)
      .setVisible(false);
  }

  /** True when the static layer must be rebuilt because the level or the contrast mode changed. */
  needsLoad(session: PlaySession, look: Look): boolean {
    return this.loaded !== session || this.loadedContrast !== look.highContrast;
  }

  load(session: PlaySession, look: Look): void {
    this.loaded = session;
    this.loadedContrast = look.highContrast;
    this.trail.clear();
    this.effects.clear();
    this.starfield?.destroy();
    this.starfield = new Starfield(this.scene, session.level.seed, look.palette);
    this.label.setColor(look.palette.amber).setStroke(look.palette.bg0, 5);
    const g = this.staticGfx.clear();
    this.drawBackdrop(g, look);
    for (const planet of session.level.planets) {
      if (planet.motion) drawMotionTrack(g, planet.motion, look);
      else drawPlanet(g, planet, planetPosition(planet, 0), look);
    }
    for (const rock of session.rt.asteroids) drawAsteroid(g, rock, look);
  }

  private drawBackdrop(g: Gfx, look: Look): void {
    g.fillStyle(toNumber(look.palette.bg0), 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // A soft glow high in the field that fades in from nothing and back out, so no edge shows against the page.
    const glow = toNumber(look.palette.bg1);
    g.fillGradientStyle(glow, glow, glow, glow, 0, 0, 0.85, 0.85);
    g.fillRect(0, 0, WORLD_WIDTH, 300);
    g.fillGradientStyle(glow, glow, glow, glow, 0.85, 0.85, 0, 0);
    g.fillRect(0, 300, WORLD_WIDTH, 460);
    g.lineStyle(look.highContrast ? 3 : 1.5, toNumber(look.palette.edge), look.highContrast ? 0.9 : 0.35);
    const inset = 14;
    const arm = 34;
    const corners: [number, number, number, number][] = [
      [inset, inset, 1, 1],
      [WORLD_WIDTH - inset, inset, -1, 1],
      [inset, WORLD_HEIGHT - inset, 1, -1],
      [WORLD_WIDTH - inset, WORLD_HEIGHT - inset, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      g.lineBetween(x, y, x + arm * sx, y);
      g.lineBetween(x, y, x, y + arm * sy);
    }
  }

  /** One frame. `dt` is seconds since the previous frame; `look.clock` drives decorative animation only. */
  render(session: PlaySession, look: Look, dt: number): void {
    const smooth = session.state.tick + session.alpha;
    const view = viewShip(session.rt, session.state, session.alpha);
    const g = this.dynamicGfx.clear();
    this.drawFields(g, session, look, smooth);
    this.drawBodies(g, session, look, smooth);
    this.drawShipLayer(g, view, look);
    this.drawAim(g, session, look);
    this.starfield?.shift(view.x - WORLD_WIDTH / 2, view.y - WORLD_HEIGHT / 2);
    this.effects.update(dt);
    this.effects.draw(this.fxGfx.clear());
  }

  /** Force fields and timed hazards, drawn under the moving bodies. */
  private drawFields(g: Gfx, session: PlaySession, look: Look, smooth: number): void {
    const { rt, state } = session;
    for (const field of rt.inversions) drawInversion(g, field, look);
    for (const pulse of rt.pulses) drawPulse(g, pulse, state.tick, look);
    for (const hole of rt.wormholes) drawWormhole(g, hole, look);
    for (const gate of rt.gates) drawGate(g, gate, gateIsOpen(gate, state.collected), look);
    for (const laser of rt.lasers) drawLaser(g, laser, { tick: state.tick, smooth }, look);
  }

  private drawBodies(g: Gfx, session: PlaySession, look: Look, smooth: number): void {
    const { rt, state } = session;
    for (const planet of rt.planets) {
      if (planet.motion) drawPlanet(g, planet, planetPosition(planet, smooth), look);
    }
    for (const item of rt.level.collectibles) {
      if (!state.collected.includes(item.id)) drawCollectible(g, item, look);
    }
    drawGoal(g, rt.level.goal, shardCount(rt, state), look);
    for (const sat of rt.satellites) {
      const at = satellitePosition(rt, sat, smooth);
      const ahead = satellitePosition(rt, sat, smooth + 1);
      drawSatellite(g, sat, { at, heading: Math.atan2(ahead.y - at.y, ahead.x - at.x) }, look);
    }
  }

  private drawShipLayer(g: Gfx, view: ShipView, look: Look): void {
    const amber = toNumber(look.palette.amber);
    if (view.mode !== 'gone') this.trail.push(view.x, view.y);
    this.trail.draw(g, amber, 4);
    if (view.mode !== 'gone') drawShip(g, view, look);
  }

  private drawAim(g: Gfx, session: PlaySession, look: Look): void {
    const preview = session.preview;
    if (!preview) {
      this.label.setVisible(false);
      return;
    }
    const anchor = drawPreview(g, preview, look);
    if (!anchor) return;
    const flip = anchor.x > WORLD_WIDTH * 0.55;
    this.label.setPosition(anchor.x + (flip ? -26 : 26), anchor.y).setOrigin(flip ? 1 : 0, 0.5).setVisible(true);
    g.lineStyle(1.5, toNumber(look.palette.amber), 0.5);
    dashedCircle(g, { x: anchor.x, y: anchor.y, r: 5 }, { count: 6, fill: 0.5 });
  }

  drawDebugOutlines(session: PlaySession, look: Look): void {
    drawDebug(this.fxGfx, session, look);
  }

  destroy(): void {
    this.starfield?.destroy();
    this.staticGfx.destroy();
    this.dynamicGfx.destroy();
    this.fxGfx.destroy();
    this.label.destroy();
  }
}

import Phaser from 'phaser';
import type { PlaySession } from '../game/session';
import { planetPosition } from '../game/simulation/motion';
import type { SimEvent } from '../game/simulation/types';
import { paletteFor, toNumber } from '../ui/palette';
import { BRIDGE_KEY, type StageBridge } from './bridge';
import type { Look } from './draw/shapes';
import { WorldRenderer } from './world-renderer';

type Of<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;

/** The single Phaser scene: it draws whichever session the bridge holds (a level, or the menu's ambient demo). */
export class StageScene extends Phaser.Scene {
  private bridge!: StageBridge;
  private world!: WorldRenderer;
  private clock = 0;
  private readonly look: Look = { palette: paletteFor(false), highContrast: false, clock: 0 };

  constructor() {
    super('stage');
  }

  create(): void {
    this.bridge = this.registry.get(BRIDGE_KEY) as StageBridge;
    this.world = new WorldRenderer(this);
    this.input.addPointer(1);
    this.input.on('pointerdown', () => this.bridge.onPointer(true));
    this.input.on('pointerup', () => this.bridge.onPointer(false));
    this.input.on('pointerupoutside', () => this.bridge.onPointer(false));
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute('aria-label', 'Orbit Shift playfield');
  }

  override update(_time: number, delta: number): void {
    const { bridge, look } = this;
    const dt = Math.min(delta, 100) / 1000;
    look.highContrast = bridge.prefs.highContrast;
    look.palette = paletteFor(look.highContrast);
    if (!bridge.prefs.reducedMotion) this.clock += dt;
    look.clock = bridge.prefs.reducedMotion ? 0 : this.clock;
    const session = bridge.session;
    if (this.world.needsLoad(session, look)) this.world.load(session, look);
    if (!session.paused) this.step(session, delta * bridge.timeScale);
    this.world.render(session, look, dt);
    if (bridge.debug) this.world.drawDebugOutlines(session, look);
  }

  private step(session: PlaySession, elapsedMs: number): void {
    const events = session.update(elapsedMs);
    if (events.length === 0) return;
    for (const event of events) this.react(event, session);
    this.bridge.onEvents(events, session);
  }

  private get reduced(): boolean {
    return this.bridge.prefs.reducedMotion;
  }

  private react(event: SimEvent, session: PlaySession): void {
    switch (event.type) {
      case 'launch':
        return this.onLaunch(session);
      case 'capture':
        return this.onCapture(event, session);
      case 'collect':
        return this.onCollect(event, session);
      case 'gate-open':
        return this.onGateOpen(session);
      case 'teleport':
        return this.burstAtShip(session, 14, 140, this.look.palette.violet);
      case 'death':
        return this.onDeath(session);
      case 'win':
        return this.onWin(session);
    }
  }

  private burstAtShip(session: PlaySession, count: number, speed: number, color: string): void {
    const { x, y } = session.state.ship;
    this.world.effects.burst({ x, y }, { count, speed, color: toNumber(color) }, this.reduced);
  }

  private onGateOpen(session: PlaySession): void {
    const { x, y } = session.state.ship;
    this.world.effects.ring(x, y, 60, toNumber(this.look.palette.teal));
  }

  private onLaunch(session: PlaySession): void {
    this.burstAtShip(session, 8, 120, this.look.palette.amber);
  }

  private onCapture(event: Of<'capture'>, session: PlaySession): void {
    const planet = session.rt.planetById.get(event.planetId);
    const at = planet ? planetPosition(planet, session.state.tick) : session.state.ship;
    this.world.effects.ring(at.x, at.y, (planet?.radius ?? 40) + 70, toNumber(this.look.palette.teal));
    this.burstAtShip(session, 10, 90, this.look.palette.teal);
  }

  private onCollect(event: Of<'collect'>, session: PlaySession): void {
    const item = session.rt.collectibleById.get(event.id);
    if (!item) return;
    this.world.effects.burst(item, { count: 14, speed: 150, color: toNumber(this.look.palette.gold) }, this.reduced);
  }

  private onDeath(session: PlaySession): void {
    this.burstAtShip(session, 30, 220, this.look.palette.coral);
    if (!this.reduced) this.cameras.main.shake(220, 0.007);
  }

  private onWin(session: PlaySession): void {
    const goal = session.level.goal;
    const teal = toNumber(this.look.palette.teal);
    this.world.effects.burst(goal, { count: 36, speed: 200, color: teal }, this.reduced);
    this.world.effects.ring(goal.x, goal.y, goal.radius + 90, teal);
    if (!this.reduced) {
      this.tweens.add({ targets: this.cameras.main, zoom: { from: 1.035, to: 1 }, duration: 260, ease: 'Sine.easeOut' });
    }
  }
}

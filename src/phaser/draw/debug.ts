import type { PlaySession } from '../../game/session';
import { COLLECTIBLE_RADIUS, GATE_HALF_THICKNESS, SHIP_HIT_RADIUS } from '../../game/simulation/constants';
import { planetPosition, satellitePosition } from '../../game/simulation/motion';
import type { Gfx, Look } from './shapes';

/** Development inspector: outlines of every collision shape, exactly as the simulation tests them. */
export function drawDebug(g: Gfx, session: PlaySession, look: Look): void {
  const { rt, state } = session;
  g.lineStyle(1, 0x00ff88, 0.9);
  for (const planet of rt.planets) {
    const at = planetPosition(planet, state.tick);
    g.strokeCircle(at.x, at.y, planet.radius + SHIP_HIT_RADIUS * 0.5);
  }
  g.lineStyle(1, 0xff3366, 0.9);
  for (const rock of rt.asteroids) g.strokeCircle(rock.x, rock.y, rock.radius + SHIP_HIT_RADIUS);
  for (const sat of rt.satellites) {
    const at = satellitePosition(rt, sat, state.tick);
    g.strokeCircle(at.x, at.y, sat.radius + SHIP_HIT_RADIUS);
  }
  for (const gate of rt.gates) {
    g.lineStyle(GATE_HALF_THICKNESS * 2 + SHIP_HIT_RADIUS * 2, 0xff3366, 0.25);
    g.lineBetween(gate.a.x, gate.a.y, gate.b.x, gate.b.y);
  }
  g.lineStyle(1, 0xffee00, 0.9);
  for (const item of rt.level.collectibles) g.strokeCircle(item.x, item.y, COLLECTIBLE_RADIUS + SHIP_HIT_RADIUS);
  g.lineStyle(1, 0xffffff, 0.9);
  g.strokeCircle(state.ship.x, state.ship.y, SHIP_HIT_RADIUS);
  g.lineStyle(1, 0x00ffff, look.highContrast ? 1 : 0.7);
  g.strokeCircle(rt.level.goal.x, rt.level.goal.y, rt.level.goal.radius);
}

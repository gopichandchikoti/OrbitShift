import type {
  Asteroid,
  Collectible,
  Hazard,
  InversionField,
  LaserArc,
  Level,
  Planet,
  RepulsionPulse,
  Satellite,
  ShieldGate,
  Wormhole,
} from '../levels/types';
import { ORBIT_GAP } from './constants';

/** A level prepared for stepping: hazards sorted by family and planets indexed by id. */
export interface LevelRuntime {
  level: Level;
  planets: Planet[];
  planetById: Map<string, Planet>;
  collectibleById: Map<string, Collectible>;
  asteroids: Asteroid[];
  satellites: Satellite[];
  lasers: LaserArc[];
  pulses: RepulsionPulse[];
  inversions: InversionField[];
  wormholes: Wormhole[];
  gates: ShieldGate[];
}

function pick<T extends Hazard>(hazards: Hazard[], type: T['type']): T[] {
  return hazards.filter((hazard): hazard is T => hazard.type === type);
}

export function buildRuntime(level: Level): LevelRuntime {
  return {
    level,
    planets: level.planets,
    planetById: new Map(level.planets.map((planet) => [planet.id, planet])),
    collectibleById: new Map(level.collectibles.map((item) => [item.id, item])),
    asteroids: pick<Asteroid>(level.hazards, 'asteroid'),
    satellites: pick<Satellite>(level.hazards, 'satellite'),
    lasers: pick<LaserArc>(level.hazards, 'laser'),
    pulses: pick<RepulsionPulse>(level.hazards, 'pulse'),
    inversions: pick<InversionField>(level.hazards, 'inversion'),
    wormholes: pick<Wormhole>(level.hazards, 'wormhole'),
    gates: pick<ShieldGate>(level.hazards, 'gate'),
  };
}

export function orbitRadiusOf(planet: Planet): number {
  return planet.radius + ORBIT_GAP;
}

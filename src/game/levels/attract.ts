import type { Level } from './types';

/**
 * The slowly turning scene behind the menus. It is not a playable level and is not in the catalogue: the ship simply
 * circles a planet while a second planet drifts and the portal glows, so the menu already looks like the game.
 */
export const ATTRACT_LEVEL: Level = {
  schema: 1,
  id: 0,
  chapter: 0,
  index: 0,
  name: 'Attract',
  seed: 11,
  bounds: { w: 720, h: 1280 },
  start: { planet: 'a', angle: -1.2, dir: 1 },
  goal: { x: 520, y: 250, radius: 46, requiredShards: 0 },
  planets: [
    { id: 'a', x: 250, y: 880, radius: 54, gravity: 700, influence: 220, orbitSpeed: 95, style: 0 },
    {
      id: 'b',
      x: 520,
      y: 560,
      radius: 38,
      gravity: 640,
      influence: 190,
      orbitSpeed: 110,
      style: 2,
      motion: { kind: 'orbit', cx: 480, cy: 560, radius: 40, omega: 0.25, phase: 0 },
    },
    { id: 'c', x: 160, y: 380, radius: 32, gravity: 600, influence: 180, orbitSpeed: 120, style: 4 },
  ],
  hazards: [],
  collectibles: [
    { id: 'k1', kind: 'shard', x: 360, y: 700 },
    { id: 'k2', kind: 'shard', x: 330, y: 470 },
  ],
  par: { launches: 3, seconds: 60 },
  tutorialHint: null,
  solution: { launchTicks: [1], totalTicks: 1, shards: 0, minWindow: 0, solver: 'none' },
};

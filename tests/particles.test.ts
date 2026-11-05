import { describe, expect, it } from 'vitest';
import { ParticlePool } from '../src/game/particles';

const dot = (x: number, vx: number, life: number, color = 1) => ({ x, y: 0, vx, vy: 0, life, size: 1, color });

describe('ParticlePool', () => {
  it('starts empty and counts spawned particles', () => {
    const pool = new ParticlePool(8);
    expect(pool.count).toBe(0);
    pool.spawn({ x: 1, y: 2, vx: 3, vy: 4, life: 1, size: 2, color: 0xff0000 });
    expect(pool.count).toBe(1);
    expect(pool.alive(0)).toBe(true);
    expect(pool.x[0]).toBe(1);
    expect(pool.color[0]).toBe(0xff0000);
  });

  it('moves particles, applies drag and expires them', () => {
    const pool = new ParticlePool(4);
    pool.spawn(dot(0, 100, 0.5));
    pool.update(0.25);
    expect(pool.x[0]).toBeCloseTo(25, 4);
    expect(pool.vx[0] as number).toBeLessThan(100);
    expect(pool.fade(0)).toBeCloseTo(0.5, 4);
    pool.update(0.3);
    expect(pool.alive(0)).toBe(false);
    expect(pool.count).toBe(0);
    expect(pool.fade(0)).toBe(0);
  });

  it('recycles the oldest slot when full instead of growing', () => {
    const pool = new ParticlePool(3);
    for (let n = 0; n < 5; n++) pool.spawn(dot(n, 0, 10, n));
    expect(pool.count).toBe(3);
    expect(pool.capacity).toBe(3);
    expect(Array.from(pool.x)).toEqual([3, 4, 2]);
  });

  it('bursts a ring of particles using the injected random source', () => {
    const pool = new ParticlePool(32);
    pool.burst({ x: 10, y: 20 }, { count: 12, speed: 200, color: 0xabcdef }, () => 0.5);
    expect(pool.count).toBe(12);
    for (let i = 0; i < 12; i++) expect(pool.x[i]).toBe(10);
  });

  it('clears everything', () => {
    const pool = new ParticlePool(4);
    pool.burst({ x: 0, y: 0 }, { count: 4, speed: 100, color: 1 }, () => 0);
    pool.clear();
    expect(pool.count).toBe(0);
  });

  it('survives a zero-length life without dividing by zero', () => {
    const pool = new ParticlePool(2);
    pool.spawn(dot(0, 0, 0));
    expect(pool.fade(0)).toBe(0);
  });
});

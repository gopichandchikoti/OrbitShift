import type { Vec } from '../game/levels/types';
import { ParticlePool, type BurstShape } from '../game/particles';
import type { Gfx } from './draw/shapes';

interface Ring {
  x: number;
  y: number;
  radius: number;
  reach: number;
  color: number;
  life: number;
}

const RING_SLOTS = 8;
const RING_LIFE = 0.5;

/** Particle bursts and expanding rings. Everything is preallocated; reduced motion halves the particle counts. */
export class Effects {
  readonly particles = new ParticlePool(192);
  private readonly rings: Ring[] = Array.from({ length: RING_SLOTS }, () => ({
    x: 0,
    y: 0,
    radius: 0,
    reach: 0,
    color: 0,
    life: 0,
  }));
  private nextRing = 0;

  burst(at: Vec, shape: BurstShape, reduced: boolean): void {
    const { count, speed } = shape;
    this.particles.burst(at, {
      ...shape,
      count: reduced ? Math.ceil(count / 2) : count,
      speed: reduced ? speed * 0.6 : speed,
    });
  }

  ring(x: number, y: number, reach: number, color: number): void {
    const slot = this.rings[this.nextRing] as Ring;
    this.nextRing = (this.nextRing + 1) % RING_SLOTS;
    Object.assign(slot, { x, y, radius: 6, reach, color, life: RING_LIFE });
  }

  update(dt: number): void {
    this.particles.update(dt);
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      ring.radius += ((ring.reach - ring.radius) * Math.min(1, dt * 9)) + dt * 30;
    }
  }

  clear(): void {
    this.particles.clear();
    for (const ring of this.rings) ring.life = 0;
  }

  draw(g: Gfx): void {
    const pool = this.particles;
    for (let i = 0; i < pool.capacity; i++) {
      if (!pool.alive(i)) continue;
      g.fillStyle(pool.color[i] as number, pool.fade(i));
      g.fillCircle(pool.x[i] as number, pool.y[i] as number, (pool.size[i] as number) * (0.4 + 0.6 * pool.fade(i)));
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      g.lineStyle(2.5, ring.color, Math.max(0, ring.life / RING_LIFE));
      g.strokeCircle(ring.x, ring.y, ring.radius);
    }
  }
}

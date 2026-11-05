export interface ParticleSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds to live. */
  life: number;
  size: number;
  color: number;
}

export interface BurstShape {
  count: number;
  /** Typical launch speed, units/s. */
  speed: number;
  color: number;
}

/**
 * A fixed-size particle pool. All storage is allocated once, so spawning and updating particles during play creates no
 * garbage. Spawning into a full pool recycles the oldest slot instead of growing.
 */
export class ParticlePool {
  readonly capacity: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly size: Float32Array;
  readonly color: Uint32Array;
  private cursor = 0;
  private live = 0;

  constructor(capacity = 192) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.color = new Uint32Array(capacity);
  }

  get count(): number {
    return this.live;
  }

  spawn(p: ParticleSpec): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.x[i] = p.x;
    this.y[i] = p.y;
    this.vx[i] = p.vx;
    this.vy[i] = p.vy;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size[i] = p.size;
    this.color[i] = p.color;
    this.live = this.countLive();
  }

  /** Spawns a ring of particles with a small random spread. `random` is injectable so tests are deterministic. */
  burst(origin: { x: number; y: number }, shape: BurstShape, random: () => number = Math.random): void {
    for (let k = 0; k < shape.count; k++) {
      const angle = (k / shape.count) * Math.PI * 2 + random() * 0.6;
      const speed = shape.speed * (0.45 + random() * 0.75);
      this.spawn({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + random() * 0.45,
        size: 1.6 + random() * 2.2,
        color: shape.color,
      });
    }
  }

  /** Advances every live particle by `dt` seconds with light drag. */
  update(dt: number): void {
    const drag = Math.max(0, 1 - 2.2 * dt);
    for (let i = 0; i < this.capacity; i++) {
      if ((this.life[i] as number) <= 0) continue;
      this.life[i] = (this.life[i] as number) - dt;
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
      this.vx[i] = (this.vx[i] as number) * drag;
      this.vy[i] = (this.vy[i] as number) * drag;
    }
    this.live = this.countLive();
  }

  /** 1 at birth, 0 at death. */
  fade(i: number): number {
    const max = this.maxLife[i] as number;
    return max > 0 ? Math.max(0, (this.life[i] as number) / max) : 0;
  }

  alive(i: number): boolean {
    return (this.life[i] as number) > 0;
  }

  clear(): void {
    this.life.fill(0);
    this.live = 0;
  }

  private countLive(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if ((this.life[i] as number) > 0) n += 1;
    return n;
  }
}

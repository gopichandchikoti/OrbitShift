/** Minimal Web Audio stand-ins that record what the game builds, so tests can assert on the node graph. */

export class FakeParam {
  value = 0;
  target: number | null = null;
  ramps: string[] = [];

  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(): this {
    this.ramps.push('linear');
    return this;
  }

  exponentialRampToValueAtTime(): this {
    this.ramps.push('exp');
    return this;
  }

  setTargetAtTime(value: number): this {
    this.target = value;
    return this;
  }
}

export class FakeNode {
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  type = '';
  buffer: unknown = null;
  readonly connections: unknown[] = [];
  started: number | null = null;
  stopped: number | null = null;

  connect(node: unknown): unknown {
    this.connections.push(node);
    return node;
  }

  start(at: number): void {
    this.started = at;
  }

  stop(at: number): void {
    this.stopped = at;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination = new FakeNode();
  readonly oscillators: FakeNode[] = [];
  readonly gains: FakeNode[] = [];
  readonly filters: FakeNode[] = [];
  readonly sources: FakeNode[] = [];
  buffersCreated = 0;

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  createGain(): FakeNode {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  }

  createOscillator(): FakeNode {
    const node = new FakeNode();
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter(): FakeNode {
    const node = new FakeNode();
    this.filters.push(node);
    return node;
  }

  createBufferSource(): FakeNode {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }

  createBuffer(_channels: number, length: number): { getChannelData(): Float32Array } {
    this.buffersCreated += 1;
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

export function asContext(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext;
}

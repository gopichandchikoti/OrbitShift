export type ShipMode = 'orbit' | 'flight' | 'dead' | 'won';

export type DeathReason = 'crash' | 'asteroid' | 'satellite' | 'laser' | 'gate' | 'out-of-bounds' | 'lost';

export interface ShipState {
  mode: ShipMode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Planet the ship orbits while `mode` is 'orbit'. */
  planetId: string | null;
  /** Angle around that planet, radians. */
  angle: number;
  /** +1 turns with increasing angle, -1 against it. */
  dir: 1 | -1;
  flightTicks: number;
  /** The planet just launched from cannot recapture the ship until `graceTicks` runs out. */
  graceId: string | null;
  graceTicks: number;
  wormholeTicks: number;
}

export interface SimState {
  /** Number of fixed steps taken. Every moving thing is a pure function of this value. */
  tick: number;
  ship: ShipState;
  /** Ids of collectibles picked up so far. */
  collected: string[];
  launches: number;
  death: DeathReason | null;
}

export type SimEvent =
  | { type: 'launch' }
  | { type: 'capture'; planetId: string }
  | { type: 'collect'; id: string; kind: 'shard' | 'switch' }
  | { type: 'gate-open'; id: string }
  | { type: 'teleport'; wormholeId: string }
  | { type: 'death'; reason: DeathReason }
  | { type: 'win' };

/** How a predicted or simulated flight ended. */
export type FlightOutcome =
  | { kind: 'capture'; planetId: string }
  | { kind: 'goal' }
  | { kind: 'death'; reason: DeathReason }
  | { kind: 'open' };

/** Tuned simulation constants. Distances are world units (the playfield is 720 x 1280); times are seconds or ticks. */

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Longest wall-clock gap the loop will catch up on; beyond this the sim slows instead of spiralling. */
export const MAX_CATCHUP_STEPS = 5;

export const SHIP_HIT_RADIUS = 7;
/** Gap between a planet's surface and the ship's orbit lane. */
export const ORBIT_GAP = 28;
/** The ship is captured once it is this far outside its orbit lane (or closer) and slow enough. */
export const CAPTURE_MARGIN = 16;
export const CAPTURE_SPEED_MAX = 470;
export const MAX_SPEED = 540;

export const LAUNCH_SPEED = 340;
/** Radial share of the launch velocity: 0 is purely tangent, larger pushes the ship further outward. */
export const LAUNCH_RADIAL = 0.34;
/** After a launch the origin planet cannot recapture the ship for this many ticks. */
export const RECAPTURE_LOCKOUT = 36;
/** Ticks a wormhole ignores a ship that just came out of it. */
export const WORMHOLE_COOLDOWN = 24;

/** A flight that lasts longer than this is declared lost, so a ship can never drift forever. */
export const FLIGHT_TIMEOUT_TICKS = 600;
export const OUT_OF_BOUNDS_MARGIN = 36;

export const COLLECTIBLE_RADIUS = 18;
export const GATE_HALF_THICKNESS = 5;

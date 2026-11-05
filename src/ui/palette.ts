/**
 * Observatory palette: one source of truth for the CSS variables and the Phaser colours.
 * Every hazard also differs in shape and icon, so colour is never the only signal. tests/palette.test.ts checks the
 * WCAG contrast of every text/background pair below.
 */
export interface Palette {
  /** Page and playfield background, darkest to lightest. */
  bg0: string;
  bg1: string;
  bg2: string;
  /** Decorative guide lines (orbit rings, starfield). Subtle on purpose: never the only carrier of information. */
  line: string;
  /** Functional borders and outlines of controls and objects: at least 3:1 against the background. */
  edge: string;
  text: string;
  textDim: string;
  /** Ship and primary actions. */
  amber: string;
  /** Portal, safe orbits, success. */
  teal: string;
  /** Lethal hazards, failure. */
  coral: string;
  /** Shards and stars. */
  gold: string;
  /** Gravity inversion and wormholes. */
  violet: string;
  /** Repulsion pulses. */
  ice: string;
  /** Text drawn on top of an amber, teal or gold surface. */
  ink: string;
}

export const STANDARD: Palette = {
  bg0: '#070b1a',
  bg1: '#0d1530',
  bg2: '#16224d',
  line: '#3b4f94',
  edge: '#7088d0',
  text: '#eaf0ff',
  textDim: '#a6b6e3',
  amber: '#ffb454',
  teal: '#4fe3c8',
  coral: '#ff6b7a',
  gold: '#ffd76a',
  violet: '#b49cff',
  ice: '#8ec5ff',
  ink: '#1a1204',
};

export const HIGH_CONTRAST: Palette = {
  bg0: '#000000',
  bg1: '#05070f',
  bg2: '#0c1230',
  line: '#9fb4ff',
  edge: '#c3d0ff',
  text: '#ffffff',
  textDim: '#dbe4ff',
  amber: '#ffc46b',
  teal: '#6bffe0',
  coral: '#ff8a96',
  gold: '#ffe58a',
  violet: '#cdbcff',
  ice: '#b4dcff',
  ink: '#000000',
};

export function paletteFor(highContrast: boolean): Palette {
  return highContrast ? HIGH_CONTRAST : STANDARD;
}

/** Planet body tints (index = Planet.style). Each has a lit face and a shadow edge. */
export const PLANET_STYLES: readonly { lit: string; shade: string }[] = [
  { lit: '#6f8cff', shade: '#27357a' },
  { lit: '#3fc7b0', shade: '#12554d' },
  { lit: '#e08bd0', shade: '#6a2a60' },
  { lit: '#f2a05c', shade: '#7a3f17' },
  { lit: '#8fd36b', shade: '#33631c' },
  { lit: '#c9b6ff', shade: '#4a3a8c' },
];

export function toNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = toNumber(hex);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG 2.x contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Writes the palette to CSS custom properties on the root element. */
export function applyPalette(root: HTMLElement, palette: Palette): void {
  for (const [name, value] of Object.entries(palette)) {
    root.style.setProperty(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  }
}

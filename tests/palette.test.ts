import { describe, expect, it } from 'vitest';
import { HIGH_CONTRAST, PLANET_STYLES, STANDARD, applyPalette, contrast, paletteFor, toNumber } from '../src/ui/palette';

const TEXT_ON = ['bg0', 'bg1', 'bg2'] as const;
const ACCENTS = ['amber', 'teal', 'coral', 'gold', 'violet', 'ice'] as const;

describe.each([
  ['standard', STANDARD, 4.5],
  ['high contrast', HIGH_CONTRAST, 7],
])('%s palette contrast', (_name, palette, minimum) => {
  it('keeps body text readable on every background', () => {
    for (const bg of TEXT_ON) {
      expect(contrast(palette.text, palette[bg])).toBeGreaterThanOrEqual(minimum);
      expect(contrast(palette.textDim, palette[bg])).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('keeps accent colours distinguishable from the playfield (3:1 for graphics)', () => {
    for (const accent of ACCENTS) expect(contrast(palette[accent], palette.bg0)).toBeGreaterThanOrEqual(3);
    for (const bg of TEXT_ON) expect(contrast(palette.edge, palette[bg])).toBeGreaterThanOrEqual(3);
  });

  it('keeps the decorative guide line visible but never relied upon', () => {
    expect(contrast(palette.line, palette.bg0)).toBeGreaterThan(1.5);
  });

  it('keeps label text readable on filled amber, teal and gold buttons', () => {
    for (const fill of ['amber', 'teal', 'gold'] as const) {
      expect(contrast(palette.ink, palette[fill])).toBeGreaterThanOrEqual(minimum);
    }
  });
});

describe('colour helpers', () => {
  it('computes known contrast ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('converts hex to the number Phaser wants', () => {
    expect(toNumber('#ffb454')).toBe(0xffb454);
  });

  it('picks the palette by setting', () => {
    expect(paletteFor(true)).toBe(HIGH_CONTRAST);
    expect(paletteFor(false)).toBe(STANDARD);
  });

  it('writes kebab-case CSS variables', () => {
    const style = new Map<string, string>();
    const root = { style: { setProperty: (k: string, v: string) => style.set(k, v) } } as unknown as HTMLElement;
    applyPalette(root, STANDARD);
    expect(style.get('--bg0')).toBe(STANDARD.bg0);
    expect(style.get('--text-dim')).toBe(STANDARD.textDim);
  });

  it('ships six planet styles, each lit side brighter than its shade', () => {
    expect(PLANET_STYLES).toHaveLength(6);
    for (const style of PLANET_STYLES) expect(contrast(style.lit, style.shade)).toBeGreaterThan(1.5);
  });
});

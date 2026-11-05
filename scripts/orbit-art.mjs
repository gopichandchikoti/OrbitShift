/**
 * The Orbit Shift mark, as SVG strings shared by the icon and splash renderers. It is original artwork drawn from the
 * same shapes the game uses: a dashed teal orbit lane, a violet planet, the amber ship and a gold shard.
 */
export const COLORS = {
  bg: '#070b1a',
  bg2: '#16224d',
  line: '#3b4f94',
  teal: '#4fe3c8',
  violet: '#b49cff',
  amber: '#ffb454',
  gold: '#ffd76a',
  text: '#eaf0ff',
};

/** The foreground mark on a 108-unit canvas, kept inside the 66-unit circle that every launcher mask keeps. */
export const MARK = `
  <circle cx="54" cy="54" r="24" fill="none" stroke="${COLORS.teal}" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round"/>
  <circle cx="54" cy="54" r="10" fill="${COLORS.violet}"/>
  <circle cx="51" cy="51" r="3" fill="#fff" opacity="0.55"/>
  <g transform="translate(72.4 38.6) rotate(50)">
    <circle r="9" fill="none" stroke="${COLORS.teal}" stroke-width="1.8"/>
    <path d="M9 0 L-6 6.5 L-2.5 0 L-6 -6.5 Z" fill="${COLORS.amber}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
  </g>
  <path d="M32 33 L37 41 L32 49 L27 41 Z" fill="${COLORS.gold}"/>
`;

/** Decorative rings and stars behind the mark, for the opaque (non-adaptive) icon and the splash. */
export const BACKDROP = `
  <circle cx="54" cy="54" r="40" fill="none" stroke="${COLORS.line}" stroke-width="1.4" stroke-dasharray="3 5" opacity="0.8"/>
  <circle cx="20" cy="22" r="1.1" fill="${COLORS.text}" opacity="0.7"/>
  <circle cx="88" cy="18" r="0.9" fill="${COLORS.text}" opacity="0.6"/>
  <circle cx="92" cy="82" r="1.2" fill="${COLORS.text}" opacity="0.7"/>
  <circle cx="16" cy="88" r="0.9" fill="${COLORS.text}" opacity="0.5"/>
  <circle cx="70" cy="94" r="0.8" fill="${COLORS.text}" opacity="0.5"/>
`;

export function svg(inner, viewBox = '0 0 108 108') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">${inner}</svg>`;
}

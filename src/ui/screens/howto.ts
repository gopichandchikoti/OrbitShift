import type { UiContext } from '../context';
import { h } from '../dom';
import { screenHead } from './parts';

const NS = 'http://www.w3.org/2000/svg';

type Drawing = (svg: SVGSVGElement) => void;

function el(svg: SVGElement, tag: string, attrs: Record<string, string>): void {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  svg.append(node);
}

const stroke = (color: string, extra = ''): string => `fill:none;stroke:var(--${color});stroke-width:2.4;${extra}`;

/** Each legend picture repeats the shape the game draws, so a player learns the shape, not just the colour. */
const DRAWINGS: Record<string, Drawing> = {
  orbit: (s) => {
    el(s, 'circle', { cx: '24', cy: '24', r: '15', style: stroke('teal', 'stroke-dasharray:4 3') });
    el(s, 'path', { d: 'M24 5l5 9h-10z', style: 'fill:var(--amber)', transform: 'rotate(90 24 24) translate(0 -2)' });
    el(s, 'circle', { cx: '24', cy: '24', r: '5', style: 'fill:var(--violet)' });
  },
  asteroid: (s) => el(s, 'path', { d: 'M10 20l7-9 11 2 9 8-2 11-10 6-12-3z', style: `${stroke('coral')}fill:#4a4560` }),
  satellite: (s) => {
    el(s, 'rect', { x: '18', y: '18', width: '12', height: '12', style: 'fill:var(--coral)' });
    el(s, 'rect', { x: '4', y: '19', width: '10', height: '10', style: `${stroke('coral')}fill:#3a2f4a` });
    el(s, 'rect', { x: '34', y: '19', width: '10', height: '10', style: `${stroke('coral')}fill:#3a2f4a` });
  },
  laser: (s) => {
    el(s, 'path', { d: 'M8 38a22 22 0 0 1 4-24', style: stroke('coral', 'stroke-dasharray:4 3') });
    el(s, 'path', { d: 'M18 40a24 24 0 0 0 26-8', style: stroke('coral') });
    el(s, 'circle', { cx: '10', cy: '40', r: '4', style: 'fill:var(--coral)' });
  },
  pulse: (s) => {
    el(s, 'circle', { cx: '24', cy: '24', r: '6', style: 'fill:var(--ice)' });
    el(s, 'circle', { cx: '24', cy: '24', r: '16', style: stroke('ice') });
    el(s, 'path', { d: 'M36 12l4-4m0 0h-4m4 0v4M12 36l-4 4m0 0h4m-4 0v-4', style: stroke('ice') });
  },
  inversion: (s) => {
    el(s, 'circle', { cx: '24', cy: '24', r: '18', style: stroke('violet', 'stroke-dasharray:5 4') });
    el(s, 'path', { d: 'M24 18l-4 5m4-5l4 5M24 30l-4-5m4 5l4-5', style: stroke('violet') });
  },
  wormhole: (s) => {
    el(s, 'circle', { cx: '24', cy: '24', r: '17', style: stroke('violet') });
    el(s, 'path', { d: 'M24 24m-10 0a10 10 0 1 1 10 10', style: stroke('violet') });
    el(s, 'circle', { cx: '24', cy: '24', r: '3', style: 'fill:var(--violet)' });
  },
  gate: (s) => {
    el(s, 'path', { d: 'M8 24h32', style: `${stroke('coral')}stroke-width:5` });
    for (const x of [8, 40]) {
      el(s, 'circle', { cx: String(x), cy: '24', r: '6', style: `${stroke('coral')}fill:#0b1030` });
    }
  },
  shard: (s) => el(s, 'path', { d: 'M24 6l11 18-11 18-11-18z', style: 'fill:var(--gold)' }),
  portal: (s) => {
    el(s, 'circle', { cx: '24', cy: '24', r: '18', style: stroke('teal') });
    el(s, 'circle', { cx: '24', cy: '24', r: '11', style: stroke('teal', 'stroke-dasharray:4 3') });
    el(s, 'circle', { cx: '24', cy: '24', r: '3', style: 'fill:#fff' });
  },
};

function legendIcon(kind: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  DRAWINGS[kind]?.(svg);
  return svg;
}

const LEGEND: { kind: string; name: string; text: string }[] = [
  { kind: 'orbit', name: 'Safe orbit', text: 'A dashed ring. Nothing can hurt you while you circle a planet.' },
  { kind: 'portal', name: 'Portal', text: 'Reach it to clear the level. A padlock means it still needs shards.' },
  { kind: 'shard', name: 'Energy shard', text: 'A gold diamond. Collect them; some portals will not open without them.' },
  { kind: 'asteroid', name: 'Asteroid', text: 'A jagged rock. Lethal to touch.' },
  { kind: 'satellite', name: 'Satellite', text: 'A square with panels. Lethal. It circles a planet on a steady rhythm.' },
  { kind: 'laser', name: 'Laser', text: 'A dashed outline is the warning. When it turns solid, it fires.' },
  { kind: 'pulse', name: 'Repulsion pulse', text: 'Rings with outward arrows. A ring contracts, then shoves you away.' },
  { kind: 'inversion', name: 'Inversion zone', text: 'A dashed disc with arrows. Inside it, pulls become pushes.' },
  { kind: 'wormhole', name: 'Wormhole', text: 'A pair of spirals. Fly into one, leave by the other, still moving.' },
  { kind: 'gate', name: 'Shield gate', text: 'A bar with crossed posts. Shut until its shard is collected, then dotted.' },
];

export function howToScreen(ctx: UiContext): HTMLElement {
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'howto-title' },
    screenHead(ctx, 'howto-title', 'How to play'),
    h(
      'div',
      { class: 'prose' },
      h('h2', {}, 'The idea'),
      h('p', {}, 'Your ship circles a planet. Launch it toward another planet, or the portal, and let gravity bend the way.'),
      h('h2', {}, 'Aim and launch'),
      h('p', {}, 'Press and hold anywhere on the playfield. A dotted line shows exactly where you would fly. Let go to launch. The line is the real simulation, so it shows moving planets and hazards too.'),
      h('p', {}, 'Prefer one finger tap at a time? Turn on "Tap twice" in Settings: tap to aim, tap again to launch.'),
      h('h2', {}, 'Stars'),
      h('p', {}, 'One star for clearing a level. Two for staying within the par launches. Three for par launches and par time.'),
      h('h2', {}, 'Keyboard'),
      h('p', {}, 'Space: hold to aim, release to launch. P or Escape: pause. R: restart. M: mute.'),
      h('h2', {}, 'What things look like'),
      h(
        'div',
        { class: 'legend' },
        ...LEGEND.map((row) =>
          h(
            'div',
            { class: 'legend__row' },
            legendIcon(row.kind),
            h('p', {}, h('strong', {}, row.name), row.text),
          ),
        ),
      ),
    ),
  );
}

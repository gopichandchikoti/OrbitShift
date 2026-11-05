const NS = 'http://www.w3.org/2000/svg';

interface IconShape {
  paths: string[];
  /** Filled silhouettes (play, star, shard) versus line icons. */
  fill?: boolean;
}

const SHAPES = {
  pause: { paths: ['M8 5v14', 'M16 5v14'] },
  play: { paths: ['M7 4.5l12 7.5-12 7.5z'], fill: true },
  restart: { paths: ['M4.5 12a7.5 7.5 0 1 0 2.4-5.5', 'M4.5 4.5v4h4'] },
  back: { paths: ['M15 5l-7 7 7 7'] },
  next: { paths: ['M9 5l7 7-7 7'] },
  star: { paths: ['M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8z'], fill: true },
  lock: { paths: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'] },
  sliders: { paths: ['M4 7h9', 'M17 7h3', 'M4 12h3', 'M11 12h9', 'M4 17h11', 'M19 17h1'] },
  shard: { paths: ['M12 3l6 9-6 9-6-9z'], fill: true },
  check: { paths: ['M5 12.5l4.5 4.5L19 7'] },
  trophy: { paths: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5v2a3 3 0 0 0 3 3', 'M16 6h3v2a3 3 0 0 1-3 3', 'M12 13v4', 'M8.5 20h7'] },
  help: { paths: ['M9.2 9a3 3 0 1 1 4.6 2.5c-1 .7-1.8 1.2-1.8 2.5', 'M12 17.6v.4'] },
  close: { paths: ['M6 6l12 12', 'M18 6L6 18'] },
  home: { paths: ['M4 11l8-7 8 7', 'M6 10v10h12V10'] },
  grid: { paths: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'] },
  sound: { paths: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9a4 4 0 0 1 0 6'] },
  mute: { paths: ['M4 9h4l5-4v14l-5-4H4z', 'M17 9l5 6', 'M22 9l-5 6'] },
  book: { paths: ['M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h10'] },
  launch: { paths: ['M6 18L18 6', 'M9 6h9v9'] },
} satisfies Record<string, IconShape>;

export type IconName = keyof typeof SHAPES;

/** A decorative icon: hidden from assistive technology, so the button or label beside it carries the meaning. */
export function icon(name: IconName, size = 22): SVGSVGElement {
  const shape: IconShape = SHAPES[name];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('fill', shape.fill ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', shape.fill ? '1.4' : '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of shape.paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export const ICON_NAMES = Object.keys(SHAPES) as IconName[];

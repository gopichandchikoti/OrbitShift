import pkg from '../../../package.json';
import { ACHIEVEMENTS } from '../../game/achievements';
import type { UiContext } from '../context';
import { h } from '../dom';
import { icon } from '../icons';
import { screenHead } from './parts';

export function achievementsScreen(ctx: UiContext): HTMLElement {
  const progress = ctx.progress();
  const earned = ACHIEVEMENTS.filter((a) => progress.achievements[a.id] !== undefined);
  const items = ACHIEVEMENTS.map((achievement) => {
    const at = progress.achievements[achievement.id];
    const done = at !== undefined;
    return h(
      'li',
      { class: `item${done ? ' item--done' : ''}` },
      h('span', { class: 'item__badge' }, icon(done ? 'check' : 'lock', 22)),
      h(
        'div',
        {},
        h('p', { class: 'item__title' }, achievement.title, h('span', { class: 'sr-only' }, done ? ' (earned)' : ' (locked)')),
        h('p', { class: 'item__desc' }, achievement.description),
        done && h('p', { class: 'item__desc' }, `Earned ${new Date(at).toLocaleDateString()}`),
      ),
    );
  });
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'ach-title' },
    screenHead(ctx, 'ach-title', 'Achievements', `${earned.length} of ${ACHIEVEMENTS.length} earned`),
    h('ul', { class: 'list' }, ...items),
  );
}

const CREDITS: { name: string; license: string; note: string }[] = [
  { name: 'Phaser 3.90', license: 'MIT', note: 'Rendering and input for the playfield.' },
  { name: 'Capacitor 8', license: 'MIT', note: 'Packages the same game as an Android app.' },
  { name: 'Vite and TypeScript', license: 'MIT, Apache-2.0', note: 'Build tooling.' },
  { name: 'Instrument Serif and Instrument Sans', license: 'SIL OFL 1.1', note: 'Titles and interface text.' },
  { name: 'IBM Plex Mono', license: 'SIL OFL 1.1', note: 'Numbers and readouts.' },
];

export function creditsScreen(ctx: UiContext): HTMLElement {
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'credits-title' },
    screenHead(ctx, 'credits-title', 'Credits', `Orbit Shift ${pkg.version}`),
    h(
      'div',
      { class: 'prose' },
      h('h2', {}, 'Made by'),
      h('p', {}, 'Design, code, level layouts, artwork and music are original to this project. Every sound and the background music are generated in the game itself, so there are no audio files.'),
      h('h2', {}, 'Built with'),
      h(
        'ul',
        { class: 'list' },
        ...CREDITS.map((credit) =>
          h(
            'li',
            { class: 'item' },
            h('span', { class: 'item__badge' }, icon('check', 20)),
            h('div', {}, h('p', { class: 'item__title' }, credit.name), h('p', { class: 'item__desc' }, `${credit.license}. ${credit.note}`)),
          ),
        ),
      ),
      h('h2', {}, 'Privacy'),
      h('p', {}, 'No ads, no accounts, no analytics and no network access. Your progress is saved only on this device.'),
    ),
  );
}

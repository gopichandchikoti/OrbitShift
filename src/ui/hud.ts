import { formatTime } from '../game/levels/stars';
import type { Level } from '../game/levels/types';
import type { PlaySession } from '../game/session';
import { h } from './dom';
import { icon } from './icons';

export interface Hud {
  element: HTMLElement;
  /** Refreshes the readouts from the session. Cheap enough to call ten times a second. */
  update(session: PlaySession): void;
  dismissHint(): void;
}

/** A compact readout. The hidden prefix gives a screen reader the label that the short visible text leaves out. */
function chip(label: string, ...content: (Node | string)[]): HTMLElement {
  return h('span', { class: 'chip' }, h('span', { class: 'sr-only' }, `${label} `), ...content);
}

/**
 * In-play overlay: one slim row with pause, level, shards, launches and time, so it never covers a portal. The
 * level's name is announced on start and shown in the pause dialog instead of taking room here.
 */
export function createHud(level: Level, onPause: () => void): Hud {
  const totalShards = level.collectibles.filter((item) => item.kind === 'shard').length;
  const shards = h('b', {}, `0/${totalShards}`);
  const launches = h('b', {}, '0');
  const time = h('b', {}, '0:00.0');
  const hint = level.tutorialHint ? h('p', { class: 'hud__hint', role: 'note' }, level.tutorialHint) : null;
  const element = h(
    'div',
    { class: 'hud', role: 'region', 'aria-label': 'Level status' },
    h(
      'div',
      { class: 'hud__top' },
      h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Pause', onClick: onPause }, icon('pause')),
      chip('Level', h('b', {}, `L${level.id}`)),
      totalShards > 0 ? chip('Shards', icon('shard', 16), shards) : null,
      chip('Launches', icon('launch', 16), launches, ` / ${level.par.launches}`),
      chip('Time', time),
    ),
    hint,
  );
  return {
    element,
    update(session) {
      shards.textContent = `${session.shards}/${totalShards}`;
      launches.textContent = String(session.state.launches);
      time.textContent = formatTime(session.state.tick);
    },
    dismissHint() {
      hint?.remove();
    },
  };
}

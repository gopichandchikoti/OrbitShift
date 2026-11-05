import { formatTime } from '../../game/levels/stars';
import { h } from '../dom';
import { icon } from '../icons';
import type { UiContext } from '../context';

/** Three stars, filled up to `count`. The label gives the number in words so colour is not the only cue. */
export function starRow(count: number, size = 22): HTMLElement {
  const row = h('span', { class: 'pips', role: 'img', 'aria-label': `${count} of 3 stars` });
  for (let i = 1; i <= 3; i++) {
    const star = icon('star', size);
    if (i > count) star.classList.add('off');
    row.append(star);
  }
  return row;
}

export function backButton(ctx: UiContext, label = 'Back'): HTMLElement {
  return h(
    'button',
    { class: 'btn btn--icon', type: 'button', 'aria-label': label, onClick: () => ctx.actions.back() },
    icon('back'),
  );
}

export function screenHead(ctx: UiContext, titleId: string, title: string, sub?: string): HTMLElement {
  return h(
    'header',
    { class: 'screen__head' },
    backButton(ctx),
    h('div', {}, h('h1', { class: 'screen__title', id: titleId }, title), sub && h('p', { class: 'screen__sub' }, sub)),
  );
}

export { formatTime };

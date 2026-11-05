import { ACHIEVEMENTS } from '../../game/achievements';
import { LEVEL_COUNT } from '../../game/levels/chapters';
import { levelById } from '../../game/levels/catalog';
import { completedCount, totalShards, totalStars, unlockedUpTo } from '../../storage/progress-model';
import type { UiContext } from '../context';
import { h } from '../dom';
import { icon, type IconName } from '../icons';

interface MenuItem {
  label: string;
  glyph: IconName;
  onClick: () => void;
  hint?: string;
}

function menuButton(ctx: UiContext, item: MenuItem): HTMLElement {
  return h(
    'button',
    {
      class: 'btn btn--wide',
      type: 'button',
      onClick: () => {
        ctx.actions.click();
        item.onClick();
      },
    },
    h('span', { class: 'btn__label' }, item.label),
    item.hint && h('span', { class: 'btn__hint' }, item.hint),
    icon(item.glyph),
  );
}

/** Level the "Continue" button resumes: the first unfinished level, or the last one played if everything is done. */
export function continueTarget(ctx: UiContext): number {
  const progress = ctx.progress();
  return Math.min(unlockedUpTo(progress), LEVEL_COUNT);
}

export function menuScreen(ctx: UiContext): HTMLElement {
  const progress = ctx.progress();
  const next = continueTarget(ctx);
  const fresh = completedCount(progress) === 0;
  const name = levelById(next)?.name ?? '';
  const earned = ACHIEVEMENTS.filter((a) => progress.achievements[a.id] !== undefined).length;
  const play = h(
    'button',
    {
      class: 'btn btn--primary btn--wide',
      type: 'button',
      'data-autofocus': true,
      onClick: () => {
        ctx.actions.click();
        ctx.actions.continueGame();
      },
    },
    h('span', { class: 'btn__label' }, fresh ? 'Play' : `Continue · Level ${next}`),
    h('span', { class: 'btn__hint' }, fresh ? 'Level 1' : name),
    icon('play'),
  );
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'menu-title' },
    h('p', { class: 'eyebrow' }, 'Orbital gravity puzzle'),
    h('h1', { class: 'wordmark', id: 'menu-title' }, 'Orbit ', h('span', {}, 'Shift')),
    h('div', { class: 'spacer' }),
    h(
      'p',
      { class: 'menu__meta' },
      h('span', {}, 'Levels ', h('strong', {}, `${completedCount(progress)}/${LEVEL_COUNT}`)),
      h('span', {}, 'Stars ', h('strong', {}, `${totalStars(progress)}/${LEVEL_COUNT * 3}`)),
      h('span', {}, 'Shards ', h('strong', {}, String(totalShards(progress)))),
    ),
    h(
      'nav',
      { class: 'menu', 'aria-label': 'Main menu' },
      play,
      menuButton(ctx, { label: 'Chapters', glyph: 'grid', onClick: () => ctx.actions.openChapters() }),
      menuButton(ctx, {
        label: 'Achievements',
        glyph: 'trophy',
        onClick: () => ctx.actions.openAchievements(),
        hint: `${earned}/${ACHIEVEMENTS.length}`,
      }),
      menuButton(ctx, { label: 'Settings', glyph: 'sliders', onClick: () => ctx.actions.openSettings() }),
      menuButton(ctx, { label: 'How to play', glyph: 'help', onClick: () => ctx.actions.openHowTo() }),
      menuButton(ctx, { label: 'Credits', glyph: 'book', onClick: () => ctx.actions.openCredits() }),
    ),
  );
}

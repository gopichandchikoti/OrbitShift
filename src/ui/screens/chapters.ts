import { CHAPTERS, LEVELS_PER_CHAPTER, levelId } from '../../game/levels/chapters';
import { levelsOfChapter } from '../../game/levels/catalog';
import type { Level } from '../../game/levels/types';
import {
  chapterStars,
  chapterUnlocked,
  isUnlocked,
  recordOf,
  unlockedUpTo,
  type Progress,
} from '../../storage/progress-model';
import type { UiContext } from '../context';
import { h } from '../dom';
import { icon } from '../icons';
import { screenHead, starRow } from './parts';

/**
 * One chapter button. There is deliberately no aria-label: the visible text (number, name, focus, stars) is the
 * accessible name, as WCAG 2.5.3 "Label in Name" requires, with visually hidden words added around it for context.
 */
function chapterCard(ctx: UiContext, chapter: (typeof CHAPTERS)[number], progress: Progress): HTMLElement {
  const unlocked = chapterUnlocked(progress, chapter.id);
  const total = LEVELS_PER_CHAPTER * 3;
  return h(
    'button',
    {
      class: 'btn chapter',
      type: 'button',
      'aria-disabled': unlocked ? undefined : 'true',
      onClick: () => {
        if (!unlocked) {
          ctx.actions.announce(`Chapter ${chapter.id} is locked. Finish chapter ${chapter.id - 1} first.`);
          return;
        }
        ctx.actions.click();
        ctx.actions.openLevels(chapter.id);
      },
    },
    h('span', { class: 'chapter__num' }, h('span', { class: 'sr-only' }, 'Chapter '), String(chapter.id)),
    h(
      'span',
      {},
      h('span', { class: 'chapter__name' }, chapter.name),
      ' ',
      h('span', { class: 'chapter__focus' }, chapter.focus),
    ),
    unlocked
      ? h('span', { class: 'chapter__stars' }, icon('star', 18), `${chapterStars(progress, chapter.id)}/${total}`, h('span', { class: 'sr-only' }, ' stars'))
      : h('span', { class: 'chapter__stars' }, icon('lock', 22), h('span', { class: 'sr-only' }, `Locked. Finish chapter ${chapter.id - 1} first.`)),
  );
}

export function chaptersScreen(ctx: UiContext): HTMLElement {
  const progress = ctx.progress();
  const cards = CHAPTERS.map((chapter) => chapterCard(ctx, chapter, progress));
  const first = cards.find((card) => !card.hasAttribute('aria-disabled')) ?? cards[0];
  const next = Math.ceil(unlockedUpTo(progress) / LEVELS_PER_CHAPTER);
  (cards[next - 1] ?? first)?.setAttribute('data-autofocus', '');
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'chapters-title' },
    screenHead(ctx, 'chapters-title', 'Chapters', '12 chapters, 120 levels'),
    h('div', { class: 'grid chapters' }, ...cards),
  );
}

function tileState(progress: Progress, level: Level): string {
  if (!isUnlocked(progress, level.id)) return 'locked';
  const record = recordOf(progress, level.id);
  return record ? `${record.stars} of 3 stars` : 'not yet cleared';
}

/** One level button. Its accessible name spells out the state in words; a locked tile explains itself when tapped. */
function levelTile(ctx: UiContext, level: Level, isFrontier: boolean): HTMLElement {
  const progress = ctx.progress();
  const open = isUnlocked(progress, level.id);
  const stars = recordOf(progress, level.id)?.stars ?? 0;
  const play = (): void => {
    if (!open) {
      ctx.actions.announce(`Level ${level.id} is locked. Clear level ${level.id - 1} first.`);
      return;
    }
    ctx.actions.click();
    ctx.actions.play(level.id);
  };
  return h(
    'button',
    {
      class: `tile${isFrontier ? ' tile--next' : ''}`,
      type: 'button',
      'aria-label': `Level ${level.id}, ${level.name}, ${tileState(progress, level)}`,
      'aria-disabled': open ? undefined : 'true',
      'data-autofocus': isFrontier || level.id === 1 ? true : undefined,
      onClick: play,
    },
    h('span', { class: 'tile__num', 'aria-hidden': 'true' }, String(level.index)),
    open ? starRow(stars, 16) : icon('lock', 20),
  );
}

export function levelsScreen(ctx: UiContext, chapterNumber: number): HTMLElement {
  const progress = ctx.progress();
  const chapter = CHAPTERS[chapterNumber - 1];
  const levels = levelsOfChapter(chapterNumber);
  const frontier = unlockedUpTo(progress);
  const tiles = levels.map((level) => levelTile(ctx, level, level.id === frontier));
  const firstFocus = tiles.find((tile) => tile.hasAttribute('data-autofocus')) ?? tiles[0];
  tiles.forEach((tile) => tile !== firstFocus && tile.removeAttribute('data-autofocus'));
  firstFocus?.setAttribute('data-autofocus', '');
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'levels-title' },
    screenHead(ctx, 'levels-title', chapter?.name ?? 'Levels', chapter?.focus),
    h('p', { class: 'eyebrow' }, `Chapter ${chapterNumber} · levels ${levelId(chapterNumber, 1)}–${levelId(chapterNumber, 10)}`),
    h('div', { class: 'grid levels', role: 'group', 'aria-label': `Levels of ${chapter?.name ?? 'this chapter'}` }, ...tiles),
    h('p', { class: 'screen__sub' }, 'A level unlocks when you clear the one before it.'),
  );
}

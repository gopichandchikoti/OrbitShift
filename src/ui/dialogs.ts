import { formatTime } from '../game/levels/stars';
import type { Level } from '../game/levels/types';
import { describeDeath } from '../game/tips';
import type { DeathReason } from '../game/simulation/types';
import type { CompletionInput, CompletionResult } from '../storage/progress';
import { achievementById } from '../game/achievements';
import type { ConfirmOptions } from './context';
import { h } from './dom';
import { icon } from './icons';
import { starRow } from './screens/parts';

let counter = 0;
const uid = (): string => `dlg-${(counter += 1)}`;

export interface DialogHandle {
  element: HTMLElement;
  /** The control that should receive focus first. */
  focus: HTMLElement;
}

function dialog(kind: string, titleId: string, ...content: (Node | null | false)[]): HTMLElement {
  const attrs = { class: `dialog ${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId };
  return h('section', attrs, ...content);
}

interface ActionOptions {
  primary?: boolean;
  hint?: string;
  focus?: boolean;
}

function action(label: string, onClick: () => void, extra: ActionOptions = {}): HTMLElement {
  return h(
    'button',
    {
      class: `btn btn--wide${extra.primary ? ' btn--primary' : ''}`,
      type: 'button',
      'data-autofocus': extra.focus ? true : undefined,
      onClick,
    },
    h('span', { class: 'btn__label' }, label),
    extra.hint && h('span', { class: 'btn__hint' }, extra.hint),
  );
}

export interface PauseHandlers {
  resume(): void;
  restart(): void;
  settings(): void;
  levels(): void;
}

export function pauseDialog(level: Level, on: PauseHandlers): DialogHandle {
  const id = uid();
  const resume = action('Resume', on.resume, { primary: true, focus: true, hint: 'P' });
  const element = dialog(
    'dialog--pause',
    id,
    h('h2', { class: 'dialog__title', id }, 'Paused'),
    h('p', { class: 'dialog__body' }, `Level ${level.id}: ${level.name}`),
    h(
      'div',
      { class: 'dialog__actions' },
      resume,
      action('Restart', on.restart, { hint: 'R' }),
      action('Settings', on.settings),
      action('Level select', on.levels),
    ),
  );
  return { element, focus: resume };
}

export interface FailHandlers {
  retry(): void;
  levels(): void;
}

/** Shown after a loss. Retry is first and already focused, so Enter or Space starts the next attempt at once. */
export function failDialog(reason: DeathReason | null, on: FailHandlers): DialogHandle {
  const id = uid();
  const info = describeDeath(reason);
  const retry = action('Retry', on.retry, { primary: true, focus: true, hint: 'R' });
  const element = dialog(
    'dialog--fail',
    id,
    h('h2', { class: 'dialog__title', id }, info.title),
    h('p', { class: 'dialog__body' }, info.tip),
    h('div', { class: 'dialog__actions' }, retry, action('Level select', on.levels)),
  );
  return { element, focus: retry };
}

export interface WinHandlers {
  next(): void;
  replay(): void;
  levels(): void;
}

function statRow(label: string, value: string, isNew: boolean): Node[] {
  return [
    h('dt', {}, label),
    h('dd', {}, value, isNew && h('span', { class: 'badge' }, 'NEW BEST')),
  ];
}

export function winDialog(
  level: Level,
  run: CompletionInput,
  result: CompletionResult,
  on: WinHandlers & { hasNext: boolean },
): DialogHandle {
  const id = uid();
  const next = action(on.hasNext ? 'Next level' : 'Back to levels', on.hasNext ? on.next : on.levels, {
    primary: true,
    focus: true,
  });
  const totalShards = level.collectibles.filter((item) => item.kind === 'shard').length;
  const unlocked = result.achievements.map((aid) => achievementById(aid)?.title).filter((t): t is string => Boolean(t));
  const element = dialog(
    'dialog--win',
    id,
    h('h2', { class: 'dialog__title', id }, 'Level clear'),
    h('div', { class: 'starrow' }, ...starRow(run.stars, 44).children),
    h('p', { class: 'sr-only' }, `${run.stars} of 3 stars`),
    h(
      'dl',
      { class: 'stats' },
      ...statRow('Time', formatTime(run.ticks), result.improved.time && !result.firstClear),
      ...statRow('Launches', `${run.launches} (par ${level.par.launches})`, result.improved.launches && !result.firstClear),
      ...(totalShards > 0 ? statRow('Shards', `${run.shards}/${totalShards}`, false) : []),
    ),
    unlocked.length > 0
      ? h('ul', { class: 'unlocks', 'aria-label': 'Achievements earned' }, ...unlocked.map((t) => h('li', {}, icon('trophy', 22), t)))
      : null,
    h(
      'div',
      { class: 'dialog__actions' },
      next,
      action('Replay', on.replay, { hint: 'R' }),
      action('Level select', on.levels),
    ),
  );
  return { element, focus: next };
}

export function confirmDialog(options: ConfirmOptions, close: () => void): DialogHandle {
  const id = uid();
  const cancel = action('Cancel', close, { focus: true });
  const confirm = h(
    'button',
    {
      class: `btn btn--wide${options.danger ? ' danger' : ' btn--primary'}`,
      type: 'button',
      onClick: () => {
        close();
        options.onConfirm();
      },
    },
    options.confirmLabel,
  );
  const element = h(
    'section',
    { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': id },
    h('h2', { class: 'dialog__title', id }, options.title),
    h('p', { class: 'dialog__body' }, options.body),
    h('div', { class: 'dialog__actions' }, cancel, confirm),
  );
  return { element, focus: cancel };
}

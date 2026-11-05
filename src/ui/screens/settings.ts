import type { ControlMode, Settings } from '../../storage/settings';
import type { UiContext } from '../context';
import { h } from '../dom';
import { screenHead } from './parts';

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}-${(idCounter += 1)}`;

function labelled(label: string, description: string | undefined, id: string): HTMLElement {
  return h(
    'label',
    { class: 'row__label', for: id },
    label,
    description && h('span', { class: 'row__desc' }, description),
  );
}

function toggleRow(
  ctx: UiContext,
  spec: { key: keyof Settings; label: string; description?: string; disabled?: boolean },
): HTMLElement {
  const id = nextId('toggle');
  const value = ctx.settings.get()[spec.key] === true;
  const control = h('button', {
    class: 'switch',
    id,
    type: 'button',
    role: 'switch',
    'aria-checked': String(value),
    disabled: spec.disabled,
    onClick: () => {
      const next = control.getAttribute('aria-checked') !== 'true';
      control.setAttribute('aria-checked', String(next));
      ctx.settings.update({ [spec.key]: next });
      ctx.actions.click();
    },
  });
  return h('div', { class: 'row' }, labelled(spec.label, spec.description, id), control);
}

function sliderRow(ctx: UiContext, key: 'musicVolume' | 'sfxVolume', label: string): HTMLElement {
  const id = nextId('range');
  const input = h('input', {
    class: 'range',
    id,
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(ctx.settings.get()[key] * 100),
    'aria-valuetext': `${Math.round(ctx.settings.get()[key] * 100)} percent`,
    onInput: () => {
      const percent = Number(input.value);
      input.setAttribute('aria-valuetext', `${percent} percent`);
      ctx.settings.update({ [key]: percent / 100 });
    },
    onChange: () => ctx.actions.click(),
  });
  return h('div', { class: 'row' }, labelled(label, undefined, id), input);
}

function controlRow(ctx: UiContext): HTMLElement {
  const modes: { mode: ControlMode; label: string }[] = [
    { mode: 'hold', label: 'Hold' },
    { mode: 'tap', label: 'Tap twice' },
  ];
  const buttons = modes.map(({ mode, label }) =>
    h('button', {
      type: 'button',
      'aria-pressed': String(ctx.settings.get().controlMode === mode),
      onClick: () => {
        ctx.settings.update({ controlMode: mode });
        buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(modes[i]?.mode === mode)));
        ctx.actions.click();
      },
      text: label,
    }),
  );
  return h(
    'div',
    { class: 'row', role: 'group', 'aria-labelledby': 'control-label' },
    h(
      'span',
      { class: 'row__label', id: 'control-label' },
      'Controls',
      h('span', { class: 'row__desc' }, 'Hold: press to aim, release to launch. Tap twice: tap to aim, tap again to launch.'),
    ),
    h('div', { class: 'seg' }, ...buttons),
  );
}

export function settingsScreen(ctx: UiContext): HTMLElement {
  const reset = h('button', {
    class: 'btn danger',
    type: 'button',
    onClick: () =>
      ctx.actions.confirm({
        title: 'Erase all progress?',
        body: 'Every level, star, shard and achievement on this device will be deleted. This cannot be undone.',
        confirmLabel: 'Erase everything',
        danger: true,
        onConfirm: () => ctx.actions.resetProgress(),
      }),
    text: 'Reset progress…',
  });
  return h(
    'main',
    { class: 'screen', 'aria-labelledby': 'settings-title' },
    screenHead(ctx, 'settings-title', 'Settings'),
    h(
      'div',
      { class: 'stack' },
      sliderRow(ctx, 'musicVolume', 'Music'),
      sliderRow(ctx, 'sfxVolume', 'Sound effects'),
      toggleRow(ctx, { key: 'muted', label: 'Mute all sound' }),
      toggleRow(ctx, {
        key: 'haptics',
        label: 'Haptics',
        description: ctx.hapticsAvailable ? 'Vibration on launch, landing and loss.' : 'This device cannot vibrate.',
        disabled: !ctx.hapticsAvailable,
      }),
      toggleRow(ctx, { key: 'reducedMotion', label: 'Reduce motion', description: 'No screen shake or zoom; fewer particles.' }),
      toggleRow(ctx, { key: 'highContrast', label: 'High contrast', description: 'Brighter colours and thicker outlines.' }),
      controlRow(ctx),
      reset,
    ),
  );
}

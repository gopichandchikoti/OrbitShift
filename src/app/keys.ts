import type { UiLayer } from '../ui/layer';

/** What the keyboard can do. The application implements this; tests can supply a fake. */
export interface KeyActions {
  readonly canAim: boolean;
  press(): void;
  release(): void;
  back(): void;
  togglePause(): void;
  restart(): void;
  toggleMute(): void;
}

type KeyHandler = (event: KeyboardEvent, actions: KeyActions) => void;

function isTextual(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement && target.type !== 'range' ? true : target.isContentEditable;
}

/** Space is swallowed while the playfield is live, so it cannot scroll the page or "click" a focused button. */
const aim: KeyHandler = (event, actions) => {
  if (!actions.canAim) return;
  event.preventDefault();
  if (!event.repeat) actions.press();
};

const HANDLERS: Record<string, KeyHandler> = {
  ' ': aim,
  Escape: (event, actions) => {
    event.preventDefault();
    actions.back();
  },
  p: (_event, actions) => actions.togglePause(),
  P: (_event, actions) => actions.togglePause(),
  r: (_event, actions) => actions.restart(),
  R: (_event, actions) => actions.restart(),
  m: (_event, actions) => actions.toggleMute(),
  M: (_event, actions) => actions.toggleMute(),
};

/**
 * Space aims and launches; P and Escape pause or go back; R restarts; M mutes. Menus and dialogs keep their normal
 * keys (Tab, Enter, arrows), and Tab is kept inside an open dialog.
 */
export function installKeys(target: EventTarget, actions: KeyActions, ui: UiLayer): () => void {
  const down = (raw: Event): void => {
    const event = raw as KeyboardEvent;
    if (ui.handleKey(event) || isTextual(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    HANDLERS[event.key]?.(event, actions);
  };
  const up = (raw: Event): void => {
    const event = raw as KeyboardEvent;
    if (event.key !== ' ') return;
    if (actions.canAim) event.preventDefault();
    actions.release();
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}

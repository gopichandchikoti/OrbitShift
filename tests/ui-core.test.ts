// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installKeys, type KeyActions } from '../src/app/keys';
import { trackCanvas } from '../src/app/layout';
import { createServices } from '../src/app/services';
import { clear, focusElement, focusableIn, h, trapTab } from '../src/ui/dom';
import { ICON_NAMES, icon } from '../src/ui/icons';
import { UiLayer } from '../src/ui/layer';

function fixture(): { root: HTMLElement; live: HTMLElement } {
  document.body.innerHTML = '<div id="ui"></div><div id="live"></div>';
  return { root: document.getElementById('ui') as HTMLElement, live: document.getElementById('live') as HTMLElement };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('h()', () => {
  it('sets class, text, attributes, booleans and listeners', () => {
    const onClick = vi.fn();
    const el = h('button', { class: 'a b', text: 'hi', type: 'button', 'data-flag': true, hidden: false, nope: undefined, onClick });
    el.click();
    expect(el.className).toBe('a b');
    expect(el.textContent).toBe('hi');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('data-flag')).toBe('');
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('nope')).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('appends nodes and strings, skipping empty children, and never parses markup', () => {
    const el = h('div', {}, 'a', null, false, undefined, h('span', { text: 'b' }), '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(1);
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x');
  });

  it('clears children and focuses without scrolling', () => {
    const el = h('div', {}, h('b'), h('i'));
    clear(el);
    expect(el.childNodes).toHaveLength(0);
    const button = h('button');
    document.body.append(button);
    focusElement(button);
    expect(document.activeElement).toBe(button);
    expect(() => focusElement(null)).not.toThrow();
  });
});

describe('focus trapping', () => {
  function dialogWithButtons(): { root: HTMLElement; first: HTMLElement; last: HTMLElement } {
    const first = h('button', { text: 'one' });
    const last = h('button', { text: 'two' });
    const root = h('div', {}, first, h('button', { text: 'hidden', hidden: true }), last);
    document.body.append(root, h('button', { id: 'outside' }));
    return { root, first, last };
  }
  const tab = (shiftKey = false): KeyboardEvent => new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });

  it('lists focusable controls and skips hidden ones', () => {
    const { root } = dialogWithButtons();
    expect(focusableIn(root)).toHaveLength(2);
  });

  it('wraps Tab from the last control to the first, and Shift+Tab the other way', () => {
    const { root, first, last } = dialogWithButtons();
    last.focus();
    const forward = tab();
    expect(trapTab(forward, root)).toBe(true);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const backward = tab(true);
    expect(trapTab(backward, root)).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back in from outside and leaves in-between tabs alone', () => {
    const { root, first } = dialogWithButtons();
    (document.getElementById('outside') as HTMLElement).focus();
    expect(trapTab(tab(), root)).toBe(true);
    expect(document.activeElement).toBe(first);
    (document.getElementById('outside') as HTMLElement).focus();
    expect(trapTab(tab(true), root)).toBe(true);
    first.focus();
    expect(trapTab(tab(), root)).toBe(false);
  });

  it('ignores other keys and swallows Tab in an empty container', () => {
    const { root } = dialogWithButtons();
    expect(trapTab(new KeyboardEvent('keydown', { key: 'a' }), root)).toBe(false);
    const empty = h('div');
    const event = tab();
    expect(trapTab(event, empty)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('icons', () => {
  it.each(ICON_NAMES)('draws "%s" as a hidden decorative svg', (name) => {
    const svg = icon(name, 30);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('30');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('fills silhouettes and outlines line icons', () => {
    expect(icon('star').getAttribute('fill')).toBe('currentColor');
    expect(icon('back').getAttribute('fill')).toBe('none');
  });
});

describe('UiLayer', () => {
  it('replaces the current screen and moves focus into it', () => {
    const { root, live } = fixture();
    const ui = new UiLayer(root, live);
    const a = h('main', {}, h('button', { text: 'a' }));
    const b = h('main', {}, h('button', { 'data-autofocus': true, text: 'b1' }), h('button', { text: 'b2' }));
    ui.show(a);
    expect(ui.current).toBe(a);
    expect(document.activeElement?.textContent).toBe('a');
    ui.show(b);
    expect(root.contains(a)).toBe(false);
    expect(document.activeElement?.textContent).toBe('b1');
    ui.clearScreen();
    expect(ui.current).toBeNull();
  });

  it('opens dialogs on top, makes everything beneath inert, and restores focus on close', () => {
    const { root, live } = fixture();
    const ui = new UiLayer(root, live);
    const screen = h('main', {}, h('button', { id: 'opener', text: 'open' }));
    ui.show(screen);
    (document.getElementById('opener') as HTMLElement).focus();
    const first = h('section', {}, h('button', { text: 'first' }));
    const second = h('section', {}, h('button', { text: 'second' }));
    const back1 = ui.openDialog(first);
    expect(ui.hasDialog).toBe(true);
    expect(screen.hasAttribute('inert')).toBe(true);
    const back2 = ui.openDialog(second, second.querySelector('button'));
    expect(back1.hasAttribute('inert')).toBe(true);
    expect(back2.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.textContent).toBe('second');
    ui.closeDialog();
    expect(back1.hasAttribute('inert')).toBe(false);
    ui.closeDialog(back1);
    expect(screen.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
    ui.closeDialog();
    expect(ui.hasDialog).toBe(false);
  });

  it('falls back to the screen when the opener is gone, and can close every dialog at once', () => {
    const { root, live } = fixture();
    const ui = new UiLayer(root, live);
    const screen = h('main', {}, h('button', { id: 'only', text: 'only' }));
    ui.show(screen);
    ui.openDialog(h('section', {}, h('button')));
    ui.openDialog(h('section', {}, h('button')));
    ui.closeAllDialogs();
    expect(ui.hasDialog).toBe(false);
    expect(document.activeElement?.id).toBe('only');
  });

  it('keeps Tab inside the top dialog only', () => {
    const { root, live } = fixture();
    const ui = new UiLayer(root, live);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    expect(ui.handleKey(tab)).toBe(false);
    ui.openDialog(h('section', {}, h('button', { text: 'x' })));
    expect(ui.handleKey(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))).toBe(true);
  });

  it('announces text, shows timed toasts and positions itself over the canvas', () => {
    const { root, live } = fixture();
    const ui = new UiLayer(root, live);
    ui.announce('Hello');
    expect(live.textContent).toBe('Hello');
    ui.toast('Saved', 1000);
    expect(root.querySelector('.toast')?.textContent).toBe('Saved');
    vi.advanceTimersByTime(1100);
    expect(root.querySelector('.toast')).toBeNull();
    ui.layout({ left: 10, top: 20, width: 300, height: 500 });
    expect(root.style.getPropertyValue('--ui-w')).toBe('300px');
    expect(root.style.getPropertyValue('--ui-y')).toBe('20px');
  });
});

describe('keyboard shortcuts', () => {
  function setup(canAim = true) {
    const { root, live } = fixture();
    const ui = new UiLayer(root, live);
    const actions = {
      canAim,
      press: vi.fn(),
      release: vi.fn(),
      back: vi.fn(),
      togglePause: vi.fn(),
      restart: vi.fn(),
      toggleMute: vi.fn(),
    } satisfies KeyActions;
    const target = new EventTarget();
    const off = installKeys(target, actions, ui);
    const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit, on: EventTarget = target): KeyboardEvent => {
      const event = new KeyboardEvent(type, { cancelable: true, ...init });
      on.dispatchEvent(event);
      return event;
    };
    return { actions, ui, key, off, target };
  }

  it('Space aims on key down and launches on key up, without repeating, and is swallowed', () => {
    const { actions, key } = setup();
    expect(key('keydown', { key: ' ' }).defaultPrevented).toBe(true);
    key('keydown', { key: ' ', repeat: true });
    expect(actions.press).toHaveBeenCalledTimes(1);
    expect(key('keyup', { key: ' ' }).defaultPrevented).toBe(true);
    expect(actions.release).toHaveBeenCalledTimes(1);
  });

  it('leaves Space alone when the playfield is not live, but still reports the release', () => {
    const { actions, key } = setup(false);
    expect(key('keydown', { key: ' ' }).defaultPrevented).toBe(false);
    expect(actions.press).not.toHaveBeenCalled();
    expect(key('keyup', { key: ' ' }).defaultPrevented).toBe(false);
    expect(actions.release).toHaveBeenCalledTimes(1);
    key('keyup', { key: 'x' });
    expect(actions.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Escape', 'back'],
    ['p', 'togglePause'],
    ['P', 'togglePause'],
    ['r', 'restart'],
    ['R', 'restart'],
    ['m', 'toggleMute'],
    ['M', 'toggleMute'],
  ] as const)('%s calls %s', (pressed, action) => {
    const { actions, key } = setup();
    key('keydown', { key: pressed });
    expect(actions[action]).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated keys, modified keys and typing in a text field, but not a slider', () => {
    const { actions, key, target } = setup();
    key('keydown', { key: 'q' });
    key('keydown', { key: 'p', ctrlKey: true });
    key('keydown', { key: 'p', metaKey: true });
    key('keydown', { key: 'p', altKey: true });
    const text = document.createElement('input');
    const range = document.createElement('input');
    range.type = 'range';
    target.addEventListener('keydown', () => undefined);
    key('keydown', { key: 'p' }, text);
    expect(actions.togglePause).not.toHaveBeenCalled();
    const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true });
    Object.defineProperty(event, 'target', { value: range });
    target.dispatchEvent(event);
    expect(actions.togglePause).toHaveBeenCalledTimes(1);
  });

  it('lets an open dialog keep Tab, and stops listening when removed', () => {
    const { ui, actions, key, off } = setup();
    ui.openDialog(h('section', {}, h('button')));
    key('keydown', { key: 'Tab' });
    expect(actions.press).not.toHaveBeenCalled();
    off();
    key('keydown', { key: 'p' });
    expect(actions.togglePause).not.toHaveBeenCalled();
  });
});

describe('trackCanvas', () => {
  class FakeObserver {
    static instances: FakeObserver[] = [];
    disconnected = false;
    constructor(public callback: () => void) {
      FakeObserver.instances.push(this);
    }
    observe(): void {}
    disconnect(): void {
      this.disconnected = true;
    }
  }

  it('reports the canvas box, only when it changes, and stops on dispose', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const parent = h('div');
    document.body.append(parent);
    const apply = vi.fn();
    const off = trackCanvas(parent, apply);
    expect(apply).not.toHaveBeenCalled();
    const canvas = document.createElement('canvas');
    let rect = { left: 1, top: 2, width: 300, height: 500 };
    canvas.getBoundingClientRect = () => rect as DOMRect;
    parent.append(canvas);
    vi.advanceTimersByTime(300);
    expect(apply).toHaveBeenCalledWith({ left: 1, top: 2, width: 300, height: 500 });
    vi.advanceTimersByTime(600);
    expect(apply).toHaveBeenCalledTimes(1);
    rect = { left: 5, top: 2, width: 280, height: 498 };
    window.dispatchEvent(new Event('resize'));
    expect(apply).toHaveBeenCalledTimes(2);
    off();
    expect(FakeObserver.instances.every((o) => o.disconnected)).toBe(true);
    rect = { left: 9, top: 9, width: 9, height: 9 };
    window.dispatchEvent(new Event('resize'));
    expect(apply).toHaveBeenCalledTimes(2);
  });
});

describe('createServices', () => {
  it('builds a working set from the defaults in a browser-like environment', () => {
    const services = createServices();
    expect(services.persistent).toBe(true);
    expect(services.haptics.available).toBe(false);
    expect(services.settings.get().reducedMotion).toBe(false);
    expect(() => services.exit()).not.toThrow();
    services.progress.setLastLevel(3);
    expect(createServices().progress.get().lastLevel).toBe(3);
    window.localStorage.clear();
  });

  it('turns reduced motion on by default when the system asks for it', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
    expect(createServices().settings.get().reducedMotion).toBe(true);
    window.localStorage.clear();
  });
});

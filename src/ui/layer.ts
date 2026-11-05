import { clear, focusElement, focusableIn, trapTab, h } from './dom';

interface OpenDialog {
  backdrop: HTMLElement;
  returnFocus: HTMLElement | null;
}

/**
 * Owns the DOM that sits over the playfield: one current screen (or the HUD), a stack of modal dialogs, toasts and the
 * screen-reader live region. When a dialog is open everything beneath it is `inert`, so keyboard focus, screen readers
 * and taps cannot reach controls that are visually covered.
 */
export class UiLayer {
  private screen: HTMLElement | null = null;
  private readonly dialogs: OpenDialog[] = [];
  private readonly toasts: HTMLElement;

  constructor(
    readonly root: HTMLElement,
    private readonly live: HTMLElement,
  ) {
    this.toasts = h('div', { class: 'toasts', 'aria-hidden': 'true' });
    root.append(this.toasts);
  }

  /** Replaces the current screen (or HUD) and moves focus into it. */
  show(element: HTMLElement, focus?: HTMLElement | null): void {
    this.screen?.remove();
    this.screen = element;
    this.root.insertBefore(element, this.toasts);
    this.syncInert();
    if (this.dialogs.length === 0) focusElement(focus ?? this.firstFocusable(element));
  }

  clearScreen(): void {
    this.screen?.remove();
    this.screen = null;
  }

  get current(): HTMLElement | null {
    return this.screen;
  }

  get hasDialog(): boolean {
    return this.dialogs.length > 0;
  }

  openDialog(dialog: HTMLElement, focus?: HTMLElement | null): HTMLElement {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = h('div', { class: 'backdrop' }, dialog);
    this.dialogs.push({ backdrop, returnFocus });
    this.root.insertBefore(backdrop, this.toasts);
    this.syncInert();
    focusElement(focus ?? this.firstFocusable(dialog));
    return backdrop;
  }

  /** Closes the top dialog (or the given one) and gives focus back to whatever opened it. */
  closeDialog(backdrop?: HTMLElement): void {
    const index = backdrop ? this.dialogs.findIndex((d) => d.backdrop === backdrop) : this.dialogs.length - 1;
    const [closed] = index >= 0 ? this.dialogs.splice(index, 1) : [];
    if (!closed) return;
    closed.backdrop.remove();
    this.syncInert();
    if (this.dialogs.length > 0) return;
    const fallback = this.screen ? this.firstFocusable(this.screen) : null;
    focusElement(closed.returnFocus?.isConnected ? closed.returnFocus : fallback);
  }

  closeAllDialogs(): void {
    while (this.dialogs.length > 0) this.closeDialog();
  }

  /** Key handling that belongs to the layer itself: Tab stays inside the top dialog. Returns true if consumed. */
  handleKey(event: KeyboardEvent): boolean {
    const top = this.dialogs[this.dialogs.length - 1];
    return top ? trapTab(event, top.backdrop) : false;
  }

  announce(text: string): void {
    // Clearing first makes a screen reader read the same sentence again if it repeats.
    clear(this.live);
    this.live.textContent = text;
  }

  toast(text: string, milliseconds = 3600): void {
    const toast = h('div', { class: 'toast' }, text);
    this.toasts.append(toast);
    this.announce(text);
    window.setTimeout(() => toast.remove(), milliseconds);
  }

  /** Sizes and positions the layer exactly over the letterboxed canvas. */
  layout(rect: { left: number; top: number; width: number; height: number }): void {
    this.root.style.setProperty('--ui-x', `${rect.left}px`);
    this.root.style.setProperty('--ui-y', `${rect.top}px`);
    this.root.style.setProperty('--ui-w', `${rect.width}px`);
    this.root.style.setProperty('--ui-h', `${rect.height}px`);
  }

  private syncInert(): void {
    const topIndex = this.dialogs.length - 1;
    this.screen?.toggleAttribute('inert', this.dialogs.length > 0);
    this.dialogs.forEach((entry, index) => entry.backdrop.toggleAttribute('inert', index !== topIndex));
  }

  private firstFocusable(root: HTMLElement): HTMLElement | null {
    return root.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(root)[0] ?? null;
  }
}

import type { DialogHandle } from '../ui/dialogs';
import type { UiLayer } from '../ui/layer';

export type DialogKind = 'pause' | 'fail' | 'win' | 'confirm' | 'settings';

interface Entry {
  kind: DialogKind;
  backdrop: HTMLElement;
}

/** Remembers what kind of dialog is on top, so "back", Escape and the Android back button each do the right thing. */
export class DialogStack {
  private readonly entries: Entry[] = [];

  constructor(private readonly ui: UiLayer) {}

  open(kind: DialogKind, handle: DialogHandle): HTMLElement {
    const backdrop = this.ui.openDialog(handle.element, handle.focus);
    this.entries.push({ kind, backdrop });
    return backdrop;
  }

  get top(): DialogKind | null {
    return this.entries[this.entries.length - 1]?.kind ?? null;
  }

  has(kind: DialogKind): boolean {
    return this.entries.some((entry) => entry.kind === kind);
  }

  get isOpen(): boolean {
    return this.entries.length > 0;
  }

  /** Closes the topmost dialog of this kind. */
  close(kind: DialogKind): void {
    const index = this.entries.map((entry) => entry.kind).lastIndexOf(kind);
    const [entry] = index >= 0 ? this.entries.splice(index, 1) : [];
    if (entry) this.ui.closeDialog(entry.backdrop);
  }

  closeAll(): void {
    while (this.entries.length > 0) {
      const entry = this.entries.pop();
      if (entry) this.ui.closeDialog(entry.backdrop);
    }
  }
}

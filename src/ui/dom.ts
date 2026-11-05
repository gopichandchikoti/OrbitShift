export type Child = Node | string | null | false | undefined;

export type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

function applyAttribute(element: HTMLElement, key: string, value: Attrs[string]): void {
  if (value === undefined || value === false) return;
  if (key === 'class') element.className = String(value);
  else if (key === 'text') element.textContent = String(value);
  else if (key.startsWith('on') && typeof value === 'function') {
    element.addEventListener(key.slice(2).toLowerCase(), value);
  } else element.setAttribute(key, value === true ? '' : String(value));
}

/**
 * Builds an element. `class` sets className, `text` sets textContent, `onX` attaches an event listener, `true`
 * becomes an empty attribute, and `false`/`undefined` omit the attribute. Children given as strings are text nodes,
 * never HTML, so nothing here can inject markup.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) applyAttribute(element, key, value);
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

/** Removes every child of a node. */
export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Moves keyboard focus without scrolling the page. */
export function focusElement(element: HTMLElement | null | undefined): void {
  element?.focus({ preventScroll: true });
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('hidden'));
}

/** Keeps Tab and Shift+Tab inside `root`, wrapping at both ends. Returns true when it handled the key. */
export function trapTab(event: KeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== 'Tab') return false;
  const items = focusableIn(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return true;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !root.contains(active))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

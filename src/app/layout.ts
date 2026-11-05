export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Keeps the DOM UI layer exactly over the (letterboxed) canvas. Phaser creates the canvas after the page loads and
 * repositions it with margins, which a ResizeObserver alone does not report, so a light poll backs up the observers.
 */
export function trackCanvas(parent: HTMLElement, apply: (box: Box) => void): () => void {
  let last = '';
  const update = (): void => {
    const canvas = parent.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const key = `${rect.left}|${rect.top}|${rect.width}|${rect.height}`;
    if (key === last) return;
    last = key;
    apply({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  };
  const resize = new ResizeObserver(update);
  resize.observe(parent);
  const mutations = new MutationObserver(update);
  mutations.observe(parent, { childList: true, subtree: true });
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  const poll = window.setInterval(update, 250);
  update();
  return () => {
    resize.disconnect();
    mutations.disconnect();
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    window.clearInterval(poll);
  };
}

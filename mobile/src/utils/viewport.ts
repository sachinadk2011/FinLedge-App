/**
 * Keeps a focused input/select/textarea visible above the on-screen keyboard:
 * a global focusin handler plus a visualViewport resize handler that re-scrolls
 * while the keyboard animates in. Re-usable by any input on any screen.
 */
export function scrollFieldIntoView(el: HTMLElement): void {
  const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport;
  const visibleH = vv && vv.height > 0 ? vv.height : window.innerHeight;
  const scroller = document.scrollingElement || document.documentElement;
  const rect = el.getBoundingClientRect();

  if (rect.bottom > visibleH * 0.7 || rect.top < 0) {
    const offsetTop = vv ? (vv.offsetTop || 0) : 0;
    const desiredTop = Math.max(12, Math.round(visibleH * 0.18)) + offsetTop;
    scroller.scrollTop += rect.top - desiredTop;
  }
}

export function bindKeyboardScrollProtection(): void {
  document.addEventListener("focusin", (event) => {
    const el = event.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) {
      window.setTimeout(() => scrollFieldIntoView(el), 120);
    }
  });

  const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport;
  vv?.addEventListener("resize", () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const tag = active.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      scrollFieldIntoView(active);
    }
  });
}
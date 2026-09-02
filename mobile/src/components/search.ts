import { appState } from "../app-state.js";
import { escapeAttr } from "../utils/html.js";
import { scrollFieldIntoView } from "../utils/viewport.js";

/**
 * Reusable module search: render the input, read the current query, and bind
 * the debounced re-render. Every module that needs a filter uses these three
 * pieces together — a future module just calls searchInput + filterRows.
 */

export function searchInput(module: string, placeholder = "Search"): string {
  const current = appState.dashSearchQuery[module] ?? "";
  return `<input class="search-input" type="search" placeholder="${escapeAttr(placeholder)}" value="${escapeAttr(current)}" data-search-module="${module}" autocomplete="off">`;
}

export function searchQuery(module: string): string {
  return (appState.dashSearchQuery[module] ?? "").toLowerCase();
}

/** Filters rows by the module's current query across the given string fields. */
export function filterRows<T extends object>(rows: T[], module: string, fields?: ReadonlyArray<keyof T>): T[] {
  const q = searchQuery(module);
  if (!q) return rows;
  const keys = fields && fields.length ? fields : (Object.keys(rows[0] ?? {}) as unknown as ReadonlyArray<keyof T>);
  return rows.filter((row) => keys.some((key) => String(row[key] ?? "").toLowerCase().includes(q)));
}

let searchDebounceTimer: number | undefined;

/**
 * Debounces the search re-render so every keystroke doesn't rebuild the whole
 * DOM (which would drop the input's focus and dismiss the on-screen keyboard).
 * After render, refocus the input, restore the caret, and scroll into view.
 */
export function bindSearchInputs(render: () => void): void {
  document.querySelectorAll<HTMLInputElement>("[data-search-module]").forEach((node) => {
    node.addEventListener("input", () => {
      const mod = node.dataset.searchModule ?? "";
      if (!mod) return;
      appState.dashSearchQuery[mod] = node.value;
      debounce(searchInputRefocus(mod, render));
    });
  });
}

function debounce(fn: () => void): void {
  if (searchDebounceTimer !== undefined) {
    window.clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = undefined;
    fn();
  }, 250);
}

function searchInputRefocus(mod: string, render: () => void): () => void {
  return () => {
    render();
    const target = document.querySelector<HTMLInputElement>(`[data-search-module="${mod}"]`);
    if (target) {
      target.focus();
      try {
        target.setSelectionRange(target.value.length, target.value.length);
      } catch {
        // ignore
      }
      scrollFieldIntoView(target);
    }
  };
}
import { escapeAttr, escapeHtml } from "../utils/html.js";

export function highlightMatch(name: string, query: string): string {
  const q = query.trim();
  if (!q) return escapeHtml(name);
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return escapeHtml(name);
  return (
    escapeHtml(name.slice(0, idx)) +
    `<mark class="suggest-mark">${escapeHtml(name.slice(idx, idx + q.length))}</mark>` +
    escapeHtml(name.slice(idx + q.length))
  );
}

export function bindShareSuggestions(): void {
  document.querySelectorAll<HTMLElement>("[data-suggest-root]").forEach((root) => {
    const input = root.querySelector<HTMLInputElement>("[data-suggest-input]");
    const list  = root.querySelector<HTMLElement>("[data-suggest-list]");
    if (!input || !list) return;
    const inp = input;
    const lst = list;

    const source = (inp.dataset.suggestSource ?? "")
      .split("\n")
      .filter(Boolean)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    let activeIndex = -1;

    const items = () => Array.from(lst.querySelectorAll<HTMLElement>(".share-suggest-item"));

    function render(): void {
      const raw = inp.value.trim();
      const query = raw.toLowerCase();
      const matches = source.filter((name) => !query || name.toLowerCase().includes(query));
      lst.innerHTML = matches
        .map((name) =>
          `<button type="button" class="share-suggest-item" data-suggest-value="${escapeAttr(name)}">${highlightMatch(name, raw)}</button>`,
        )
        .join("");
      lst.hidden = matches.length === 0;
      activeIndex = -1;
    }

    function pick(value: string): void {
      inp.value = value;
      lst.hidden = true;
      inp.focus();
    }

    function setActive(index: number): void {
      const arr = items();
      arr.forEach((el, i) => el.classList.toggle("active", i === index));
      if (arr[index]) arr[index].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", () => {
      if (!lst.hidden) render();
    });
    lst.addEventListener("mousedown", (event) => {
      if (event.target instanceof Element && event.target.closest(".share-suggest-item")) {
        event.preventDefault();
      }
    });
    lst.addEventListener("click", (event) => {
      const btn = (event.target as Element).closest<HTMLElement>("[data-suggest-value]");
      if (!btn?.dataset.suggestValue) return;
      inp.value = btn.dataset.suggestValue;
      lst.hidden = true;
      inp.focus();
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        lst.hidden = true;
      }, 140);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        lst.hidden = true;
        activeIndex = -1;
        return;
      }
      const arr = items();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (lst.hidden || arr.length === 0) return;
        event.preventDefault();
        activeIndex =
          event.key === "ArrowDown"
            ? Math.min(activeIndex + 1, arr.length - 1)
            : Math.max(activeIndex - 1, 0);
        setActive(activeIndex);
        return;
      }
      if (event.key === "Enter" && !lst.hidden && activeIndex >= 0) {
        const picked = arr[activeIndex]?.dataset.suggestValue;
        if (picked) {
          event.preventDefault();
          pick(picked);
        }
      }
    });
  });
}
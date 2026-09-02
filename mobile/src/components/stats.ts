import { money } from "../utils/format.js";

export type StatTone = "pos" | "neg" | "neu";

export function statValueHtml(value: number, tone: StatTone): string {
  return `<div class="value money ${tone}">${money(value, { sign: tone === "pos" || tone === "neg" })}</div>`;
}

export function statBoxHtml(label: string, value: number, tone: StatTone, extra = ""): string {
  return `<div class="stat-box${extra}"><div class="label">${label}</div>${statValueHtml(value, tone)}</div>`;
}

/**
 * 2- or 3-column stat grid. A lone box that would sit by itself in the final
 * row (odd count on 2 cols, count % cols === 1 on 3 cols) spans the full row —
 * so e.g. "Bank net" / "Cash net" never float on the left of an empty cell.
 * fullWidthLast forces the last box to span all columns regardless of count.
 */
export function statGrid(stats: Array<[string, number, StatTone]>, cols: 2 | 3 = 2, fullWidthLast = false): string {
  const colClass = cols === 3 ? "stat-grid split-3" : "stat-grid";
  return `<div class="${colClass}">${stats.map(([label, value, tone], i) => {
    const isLast = i === stats.length - 1;
    const loneInRow = isLast && stats.length % cols === 1;
    const extra = (fullWidthLast || loneInRow) && isLast ? " stat-box-full" : "";
    return statBoxHtml(label, value, tone, extra);
  }).join("")}</div>`;
}
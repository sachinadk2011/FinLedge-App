import { appState } from "../app-state.js";
import { groupedBarsLegend, renderGroupedBars } from "./home-chart.js";
import type { ChartBucket, ChartRange } from "../types.js";
import { compactMoney } from "../utils/format.js";
import { escapeHtml } from "../utils/html.js";

export type BarChartBucket = {
  label: string;       // x-axis primary label
  sublabel?: string;   // x-axis secondary label (month for day buckets)
  value: number;
  color: string;       // CSS var string
  /** When true, the bar + value label are colored green (+) / red (−) by value sign instead of `color`. */
  signColor?: boolean;
};

const COL_W   = 44;
const PLOT_H  = 104;
const BAR_MAX = PLOT_H - 16;

export function renderBars(buckets: BarChartBucket[]): string {
  if (!buckets.length) return "<p class='sub'>No data for this period.</p>";
  const nonZero = buckets.filter((b) => Math.abs(b.value) > 0);
  const maxVal  = nonZero.length ? Math.max(...nonZero.map((b) => Math.abs(b.value))) : 1;

  const cols = buckets.map((b) => {
    const hasBar = Math.abs(b.value) >= 0.01;
    const barPx  = hasBar ? Math.max(4, (Math.abs(b.value) / maxVal) * BAR_MAX) : 0;
    const color  = b.signColor ? (b.value >= 0 ? "var(--accent-green)" : "var(--accent-red)") : b.color;
    const stickHtml = hasBar
      ? `<div class="single-bar-stick">
          <span class="single-bar-val" style="color:${color};">${compactMoney(b.value)}</span>
          <div class="single-bar-body" style="height:${barPx}px;background:${color};"></div>
        </div>`
      : "";
    const subHtml = b.sublabel ? `<span class="single-bar-sub">${b.sublabel}</span>` : `<span class="single-bar-sub"></span>`;
    return `<div class="single-bar-col" style="width:${COL_W}px;">
      <div class="single-bar-plot">${stickHtml}</div>
      <span class="single-bar-x">${b.label}</span>
      ${subHtml}
    </div>`;
  }).join("");

  return `<div class="chart-scroll chart-animate" data-scroll-end style="-webkit-overflow-scrolling:touch;">
    <div class="chart-track" style="width:${buckets.length * (COL_W + 6) + 16}px;">
      ${cols}
    </div>
  </div>`;
}

function legendHtml(legend: Array<{ label: string; color: string }>): string {
  return legend.map((l) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${l.color};margin-right:5px;vertical-align:middle;"></i>${escapeHtml(l.label)}</span>`).join("");
}

/** Full bar chart card with title, optional description, bars, and legend. */
export function barsChart(
  title: string,
  description: string,
  buckets: BarChartBucket[],
  legend: Array<{ label: string; color: string }>,
): string {
  return `<section class="card">
    <h3>${title}</h3>
    ${description ? `<p class="sub" style="margin:0 0 10px;font-size:11px;color:var(--text-3);">${escapeHtml(description)}</p>` : ""}
    ${renderBars(buckets)}
    ${legendHtml(legend) ? `<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${legendHtml(legend)}</div>` : ""}
  </section>`;
}

type PeriodRangeConfig = {
  ranges?: ChartRange[];
  activeRange?: ChartRange;
  rangeAttr?: "data-home-range" | "data-bank-range";
};

function periodRangeControls({
  ranges = ["week", "month", "year", "custom"],
  activeRange = appState.homeRange,
  rangeAttr = "data-home-range",
}: PeriodRangeConfig = {}): string {
  const tabs = ranges.map((r) =>
    `<button class="${activeRange === r ? "active" : ""}" ${rangeAttr}="${r}">${r[0].toUpperCase()}${r.slice(1)}</button>`
  ).join("");
  const customRange = activeRange === "custom"
    ? `<div class="custom-range"><label>From<input type="date" value="${appState.customStart}" data-custom-start></label><label>To<input type="date" value="${appState.customEnd}" data-custom-end></label></div>`
    : "";
  return `<div class="segmented graph-tabs period-tabs" style="margin-bottom:8px;">${tabs}</div>${customRange}`;
}

/** Single-bar trend chart card with period controls (Bank/Shares/Expenses/Summary). */
export function periodBarsChart(
  title: string,
  buckets: BarChartBucket[],
  legend: Array<{ label: string; color: string }>,
  config: PeriodRangeConfig = {},
): string {
  return `<section class="card">
    <div class="section-title"><h3>${title}</h3></div>
    ${periodRangeControls(config)}
    ${renderBars(buckets)}
    ${legendHtml(legend) ? `<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${legendHtml(legend)}</div>` : ""}
  </section>`;
}

/** Grouped income/expense/net bars with period controls (Bank/Expenses dashboards). */
export function periodGroupedBarsChart(
  title: string,
  buckets: ChartBucket[],
  config: PeriodRangeConfig = {},
): string {
  return `<section class="card">
    <div class="section-title"><h3>${title}</h3></div>
    ${periodRangeControls(config)}
    ${renderGroupedBars(buckets)}
    ${groupedBarsLegend()}
  </section>`;
}

/** Standalone period tabs for the Home money-flow card. */
export function periodControls(ranges: ChartRange[], options: { wrap?: boolean } = { wrap: true }): string {
  const body = `<div class="segmented graph-tabs period-tabs">${ranges.map((r) => `<button class="${appState.homeRange === r ? "active" : ""}" data-home-range="${r}">${r[0].toUpperCase()}${r.slice(1)}</button>`).join("")}</div>
    ${appState.homeRange === "custom" ? `<div class="custom-range"><label>From<input type="date" value="${appState.customStart}" data-custom-start></label><label>To<input type="date" value="${appState.customEnd}" data-custom-end></label></div>` : ""}`;
  return options.wrap === false ? `<div class="period-controls compact-card">${body}</div>` : `<section class="card compact-card">${body}</section>`;
}

/** Category bar-meter section (e.g. Bank "Charges by category"). */
export function categoryBarsSection(title: string, totals: Array<{ label: string; value: number }>, color = "var(--brand-teal)"): string {
  if (!totals.length) return "";
  const max = Math.max(...totals.map((t) => Math.abs(t.value)), 1);
  const rows = totals.map((t) => {
    const pct = Math.max(4, (Math.abs(t.value) / max) * 100);
    return `<div class="history-row" style="display:block;padding:8px 0;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-1);margin-bottom:6px;">
        <span>${escapeHtml(t.label)}</span><b class="money" style="font-variant-numeric:tabular-nums;">${compactMoney(t.value)}</b>
      </div>
      <div class="category-meter"><i style="width:${pct}%;background:${color};"></i></div>
    </div>`;
  }).join("");
  return `<section class="card"><h3>${title}</h3>${rows}</section>`;
}
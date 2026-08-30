import { appState, appVersionLabel, deviceName, getProfileName, greeting, profileInitial } from "../app-state.js";
import {
  BANK_CATEGORIES,
  PERSONAL_FINANCE_DIRECTIONS,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_FLOWS,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
  SHARE_CATEGORIES,
  SHARE_CATEGORY_LABELS,
} from "../constants/options.js";
import type { ChartRange, ScreenId } from "../types.js";
import { money } from "../utils/format.js";

export function screen(id: ScreenId, body: string): string {
  return `<main class="screen ${appState.activeScreen === id ? "active" : ""}" data-screen="${id}">${body}</main>`;
}

export function topbar(): string {
  const name = getProfileName();
  return `
    <header class="topbar">
      <button class="icon-btn" data-open-drawer aria-label="Open navigation"><span class="hamburger-lines"></span></button>
      <div class="brand brand-centered brand-logo"><img class="brand-logo-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${greeting()}${name ? `, ${name}` : ""}</span></div></div>
      <button class="avatar" data-nav="settings" aria-label="Open profile">${profileInitial()}</button>
    </header>
  `;
}

export function drawer(): string {
  const items: Array<[ScreenId, string, string, ScreenId[]]> = [
    ["home", "Home", "🏠", ["home"]],
    ["bank-add", "Bank Services", "🏦", ["bank-add", "bank-dash"]],
    ["shares-add", "Share Portfolio", "📈", ["shares-add", "shares-dash"]],
    ["expenses-add", "Personal Expenses", "💳", ["expenses-add", "expenses-dash", "transfer"]],
    ["summary", "Financial Summary", "📊", ["summary"]],
    ["settings", "Settings", "⚙", ["settings", "settings-profile", "settings-import-export", "settings-investment", "settings-backup-sync", "settings-privacy", "settings-about", "settings-how-to-use", "settings-version"]],
  ];
  return `
    <div class="drawer-overlay" data-close-drawer></div>
    <nav class="drawer" aria-label="Mobile navigation">
      <div class="drawer-head"><img class="mark mark-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${appVersionLabel} / ${deviceName}</span></div></div>
      ${items.map(([id, label, icon, screens]) => `<button class="drawer-item ${screens.includes(appState.activeScreen) ? "active" : ""}" data-nav="${id}"><span>${icon}</span>${label}</button>`).join("")}
    </nav>
  `;
}

export function bottomNav(back: ScreenId, action: ScreenId): string {
  const label = action.endsWith("dash") ? "View dashboard" : "Add entry";
  return `<div class="btn-row"><button class="btn-secondary" data-back="${back}">Back</button><button class="btn-secondary" data-nav="home">Home</button><button class="btn-secondary active" data-nav="${action}">${label}</button></div>`;
}

export function addFormScreen(eyebrow: string, title: string, fields: string[][], submit: string, next: ScreenId): string {
  return `<p class="eyebrow">${eyebrow}</p><h1 class="pagehead">${title}</h1><p class="sub">Stored locally on this device.</p>${formCard(fields, submit)}${bottomNav("home", next)}`;
}

export function formCard(fields: string[][], submit: string): string {
  return `<section class="card">${fields.map(([label, type, value]) => field(label, type, value)).join("")}<button class="btn-primary">${submit}</button></section>`;
}

export function field(label: string, type: string, value?: string): string {
  return `<div class="field"><label>${label}</label>${type === "select" ? `<select>${selectOptions(label, value)}</select>` : `<input type="${type}" ${type === "number" ? "inputmode=\"decimal\"" : ""}>`}</div>`;
}

export function selectOptions(label: string, fallback = "Other"): string {
  const optionsByLabel: Record<string, string[]> = {
    Category:
      BANK_CATEGORIES.includes(fallback)
        ? BANK_CATEGORIES
        : [...PERSONAL_FINANCE_EXPENSE_CATEGORIES, ...PERSONAL_FINANCE_INCOME_CATEGORIES],
    "Entry type": SHARE_CATEGORIES,
    Flow: PERSONAL_FINANCE_FLOWS.map((flow) => flow.label),
    Type: PERSONAL_FINANCE_DIRECTIONS.map((direction) => direction.label),
    "Dividend Type": ["cash", "bonus"],
    "SIP type": ["installment", "redeem"],
  };
  const options = optionsByLabel[label] || [fallback, "Other"];
  return options.map((option) => `<option value="${option}">${SHARE_CATEGORY_LABELS[option] || option}</option>`).join("");
}

export function dashboardScreen(eyebrow: string, title: string, stats: Array<[string, number, string]>, body: string, addTarget: ScreenId): string {
  return `<p class="eyebrow">${eyebrow}</p><h1 class="pagehead">${title}</h1><div class="stat-grid card">${stats.map(([label, value, tone]) => `<div class="stat-box"><div class="label">${label}</div><div class="value money ${tone}">${money(value, { sign: tone === "pos" || tone === "neg" })}</div></div>`).join("")}</div>${body}${bottomNav("home", addTarget)}`;
}

export function historyRows(rows: Array<Record<string, unknown>>, wrap = true): string {
  const content = rows.length ? rows.map((row) => {
    const inferredDirection = Number(row.amount ?? 0) >= 0 ? "income" : "expense";
    const direction = String(row.direction ?? inferredDirection);
    const amount = Number(row.amount ?? 0);
    return `<div class="history-row"><div><b>${String(row.description ?? row.category ?? "Entry")}</b><span>${String(row.category ?? "")} / ${String(row.flow_type ?? "")} / ${String(row.date ?? "")}</span></div><div class="money ${direction === "income" ? "pos" : "neg"}">${money(amount, { sign: true })}</div></div>`;
  }).join("") : `<p class="sub">No entries match this view yet.</p>`;
  return wrap ? `<section class="card">${content}</section>` : content;
}

export function periodControls(ranges: ChartRange[], options: { wrap?: boolean } = { wrap: true }): string {
  const body = `
      <h3>Mobile period view</h3>
      <div class="segmented graph-tabs">
        ${ranges.map((range) => `<button class="${appState.homeRange === range ? "active" : ""}" data-home-range="${range}">${range[0].toUpperCase()}${range.slice(1)}</button>`).join("")}
      </div>
      ${appState.homeRange === "custom" ? `<div class="custom-range"><label>From<input type="date" value="${appState.customStart}" data-custom-start></label><label>To<input type="date" value="${appState.customEnd}" data-custom-end></label></div>` : ""}
  `;
  return options.wrap === false ? `<div class="period-controls compact-card">${body}</div>` : `<section class="card compact-card">${body}</section>`;
}

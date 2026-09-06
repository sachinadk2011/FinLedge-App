import {
  BANK_CATEGORIES,
  PERSONAL_FINANCE_DIRECTIONS,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_FLOWS,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
  SHARE_CATEGORIES,
  SHARE_CATEGORY_LABELS,
} from "../constants/options.js";
import type { ScreenId } from "../types.js";
import { toDateKey, today } from "../utils/date.js";
import { escapeAttr } from "../utils/html.js";
import { bottomNav } from "./shell.js";

/** Today's date as YYYY-MM-DD, computed once per render. */
const todayStr = toDateKey(today());

/** Form field tuple: [label, input type, default/selected value, field name]. */
export type FormField = [label: string, type: string, value?: string, name?: string];

export function addFormScreen(
  eyebrow: string,
  title: string,
  fields: FormField[],
  submit: string,
  next: ScreenId,
  formId = "",
): string {
  return `<p class="eyebrow">${eyebrow}</p><h1 class="pagehead">${title}</h1><p class="sub">Stored locally on this device.</p>${formCard(fields, submit, formId)}${bottomNav("home", next)}`;
}

export function formCard(fields: FormField[], submit: string, formId = ""): string {
  const formAttr = formId ? ` data-form="${escapeAttr(formId)}"` : "";
  return `<section class="card"${formAttr}>${fields.map(([label, type, value, name]) => field(label, type, value, name)).join("")}<button class="btn-primary" data-submit>${submit}</button></section>`;
}

/** Renders a form field. Date inputs default to today — user only taps if they need a different date. */
export function field(label: string, type: string, value?: string, name?: string): string {
  const defaultValue = type === "date" ? todayStr : (value ?? "");
  const nameAttr = name ? ` name="${escapeAttr(name)}"` : "";
  if (type === "select") {
    return `<div class="field"><label>${label}</label><select${nameAttr}>${selectOptions(label, value)}</select></div>`;
  }
  return `<div class="field"><label>${label}</label><input type="${type}"${nameAttr} ${type === "number" ? `inputmode="decimal"` : ""} value="${defaultValue}"></div>`;
}

export function selectOptions(label: string, fallback = "Other"): string {
  const optionsByLabel: Record<string, string[]> = {
    Category: BANK_CATEGORIES.includes(fallback ?? "") ? BANK_CATEGORIES : [...PERSONAL_FINANCE_EXPENSE_CATEGORIES, ...PERSONAL_FINANCE_INCOME_CATEGORIES],
    "Entry type": SHARE_CATEGORIES,
    Flow: PERSONAL_FINANCE_FLOWS.map((f) => f.label),
    Type: PERSONAL_FINANCE_DIRECTIONS.map((d) => d.label),
    "Dividend Type": ["cash", "bonus"],
    "SIP type": ["installment", "redeem"],
  };
  const options = optionsByLabel[label] || [fallback ?? "Other", "Other"];
  return options.map((o) => `<option value="${o}">${SHARE_CATEGORY_LABELS[o] || o}</option>`).join("");
}

export function sectionTitle(heading: string, rightLabel = ""): string {
  return `<div class="section-title"><h3>${heading}</h3>${rightLabel ? `<span>${rightLabel}</span>` : ""}</div>`;
}
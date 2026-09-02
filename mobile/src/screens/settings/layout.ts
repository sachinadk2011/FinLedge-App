import { escapeHtml } from "../../utils/html.js";

/** Shared shell for every settings sub-screen: eyebrow, page title, card body, back button. */
export function settingsSubScreen(title: string, body: string): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">${escapeHtml(title)}</h1>
    ${body}
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
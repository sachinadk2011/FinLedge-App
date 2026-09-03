import { appState } from "../../app-state.js";
import { escapeAttr } from "../../utils/html.js";

/**
 * Notes import — step 1: paste raw note text.
 * Step 2 (review) lives in keep-notes/review.ts and renders as a full-screen
 * destination, not a modal, so the staged rows get the whole viewport.
 */
export function importPasteScreen(): string {
  return `
    <p class="eyebrow">Import / Export</p>
    <h1 class="pagehead">Import from notes</h1>
    <p class="sub">Paste any expense or income note below. Each line becomes a row for you to review before anything is saved.</p>

    <section class="card">
      <label class="field">
        <span>Raw note text</span>
        <textarea class="import-note-area" data-import-note rows="12" placeholder="Paste your expenses or income note here…" autocomplete="off" autocapitalize="sentences" spellcheck="false">${escapeAttr(appState.importPasteDraft)}</textarea>
      </label>
    </section>

    <div class="btn-stack">
      <button class="btn-primary btn-block" type="button" data-import-parse>Parse &amp; review</button>
      <div class="btn-row btn-row-2">
        <button class="btn-secondary" type="button" data-back>Back</button>
        <button class="btn-secondary" type="button" data-nav="home">Home</button>
      </div>
    </div>
  `;
}
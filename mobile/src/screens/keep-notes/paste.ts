import { appState } from "../../app-state.js";
import { escapeAttr } from "../../utils/html.js";

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Notes import — step 1: paste raw note text.
 * Step 2 (review) lives in keep-notes/review.ts.
 *
 * The Clear/Undo button occupies a fixed spot in the textarea header so the
 * page layout never shifts when toggling between states:
 *   • has text + no undo available → shows "Clear" (red)
 *   • just cleared (undo available) → shows "Undo" (teal) in the same spot
 *   • no text + no undo → button is invisible but still takes up space
 */
export function importPasteScreen(): string {
  const hasText = appState.importPasteDraft.trim().length > 0;
  const undoAvailable =
    appState.importClearUndo !== null &&
    Date.now() - appState.importClearTime < UNDO_WINDOW_MS;

  // The button is always rendered (keeps layout stable); only its content
  // and visibility change. aria-hidden keeps it out of the a11y tree when
  // it is invisible.
  let actionBtn: string;
  if (undoAvailable) {
    actionBtn = `<button class="import-note-action import-note-undo" type="button" data-import-undo-clear>Undo</button>`;
  } else if (hasText) {
    actionBtn = `<button class="import-note-action import-note-clear" type="button" data-import-clear>Clear</button>`;
  } else {
    actionBtn = `<button class="import-note-action" type="button" aria-hidden="true" tabindex="-1" style="visibility:hidden">Clear</button>`;
  }

  return `
    <p class="eyebrow">Import / Export</p>
    <h1 class="pagehead">Import from notes</h1>
    <p class="sub">Paste any expense or income note below. Each line becomes a row for you to review before anything is saved.</p>

    <section class="card">
      <div class="import-paste-head">
        <label class="import-paste-label" for="import-note-area">Raw note text</label>
        ${actionBtn}
      </div>
      <textarea id="import-note-area" class="import-note-area" data-import-note rows="12"
        placeholder="Paste your expenses or income note here\u2026"
        autocomplete="off" autocapitalize="sentences" spellcheck="false">${escapeAttr(appState.importPasteDraft)}</textarea>
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

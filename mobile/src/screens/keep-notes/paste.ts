import { appState } from "../../app-state.js";
import { escapeAttr } from "../../utils/html.js";

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Notes import — step 1: paste raw note text.
 * Step 2 (review) lives in keep-notes/review.ts and renders as a full-screen
 * destination, not a modal, so the staged rows get the whole viewport.
 */
export function importPasteScreen(): string {
  const hasText = appState.importPasteDraft.trim().length > 0;
  const undoAvailable =
    appState.importClearUndo !== null &&
    Date.now() - appState.importClearTime < UNDO_WINDOW_MS;

  const undoBar = undoAvailable
    ? `<section class="card import-undo-bar">
        <span class="import-undo-label">Note cleared.</span>
        <button class="btn-soft btn-sm" type="button" data-import-undo-clear>Undo</button>
      </section>`
    : "";

  const clearBtn = hasText
    ? `<button class="import-clear-btn" type="button" data-import-clear title="Clear pasted text">Clear</button>`
    : "";

  return `
    <p class="eyebrow">Import / Export</p>
    <h1 class="pagehead">Import from notes</h1>
    <p class="sub">Paste any expense or income note below. Each line becomes a row for you to review before anything is saved.</p>

    ${undoBar}

    <section class="card">
      <div class="import-paste-head">
        <label class="import-paste-label" for="import-note-area">Raw note text</label>
        ${clearBtn}
      </div>
      <textarea id="import-note-area" class="import-note-area" data-import-note rows="12" placeholder="Paste your expenses or income note here\u2026" autocomplete="off" autocapitalize="sentences" spellcheck="false">${escapeAttr(appState.importPasteDraft)}</textarea>
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

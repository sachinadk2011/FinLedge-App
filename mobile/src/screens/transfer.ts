import { appState } from "../app-state.js";

export function transferScreen(): string {
  const direction = appState.transferDirection;
  return `
    <p class="eyebrow">Transfer</p>
    <h1 class="pagehead">Cash ⇄ Bank transfer</h1>
    <section class="card" data-form="transfer">
      <div class="field"><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="chip-row">
        <button type="button" class="chip ${direction === "cash-to-bank" ? "active" : ""}" data-transfer-direction="cash-to-bank">Cash to Bank</button>
        <button type="button" class="chip ${direction === "bank-to-cash" ? "active" : ""}" data-transfer-direction="bank-to-cash">Bank to Cash</button>
      </div>
      <div class="field"><label>Amount</label><input type="number" inputmode="decimal" name="amount"></div>
      <div class="field"><label>Note (optional)</label><input type="text" name="note"></div>
      <button class="btn-primary" data-submit style="background:var(--accent-amber);">Record transfer</button>
    </section>
    <button class="btn-secondary" data-back="expenses-add">Back to add entry</button>
  `;
}

export function transferScreen(): string {
  return `
    <p class="eyebrow">Transfer</p>
    <h1 class="pagehead">Cash to bank transfer</h1>
    <p class="sub">Moves money between tracked Cash and Bank flow without affecting income or expense totals.</p>
    <section class="card" data-form="transfer">
      <div class="field"><label>Date</label><input type="date" name="date"></div>
      <div class="chip-row">
        <button type="button" class="chip active" data-transfer-direction="cash-to-bank">Cash to Bank</button>
        <button type="button" class="chip" data-transfer-direction="bank-to-cash">Bank to Cash</button>
      </div>
      <div class="field"><label>Amount</label><input type="number" inputmode="decimal" name="amount"></div>
      <div class="field"><label>Note</label><input type="text" name="note"></div>
      <button class="btn-primary" data-submit style="background:var(--accent-amber);">Record transfer</button>
    </section>
    <button class="btn-secondary" data-back="expenses-add">Back to add entry</button>
  `;
}
export function transferScreen(): string {
  return `
    <p class="eyebrow">Transfer</p>
    <h1 class="pagehead">Cash to bank transfer</h1>
    <p class="sub">Moves money between tracked Cash and Bank flow without affecting income or expense totals.</p>
    <section class="card">
      <div class="field"><label>Date</label><input type="date"></div>
      <div class="chip-row"><button class="chip active">Cash to Bank</button><button class="chip">Bank to Cash</button></div>
      <div class="field"><label>Amount</label><input type="number" inputmode="decimal"></div>
      <div class="field"><label>Note</label><input type="text"></div>
      <button class="btn-primary" style="background:var(--accent-amber);">Record transfer</button>
    </section>
    <button class="btn-secondary" data-back="expenses-add">Back to add entry</button>
  `;
}

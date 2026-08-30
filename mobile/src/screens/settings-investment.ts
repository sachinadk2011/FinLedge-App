export function settingsInvestmentScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Investment</h1>
    <section class="card">
      <h3>Portfolio rules</h3>
      <p class="sub">Share Portfolio uses the on-device FIFO lot-matching service and SIP calculations. The interest engine remains deferred.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}

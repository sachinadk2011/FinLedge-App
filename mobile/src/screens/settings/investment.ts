import { settingsSubScreen } from "./layout.js";

export function settingsInvestmentScreen(): string {
  return settingsSubScreen(
    "Investment",
    `<section class="card">
      <h3>Portfolio rules</h3>
      <p class="sub">Share Portfolio uses the on-device FIFO lot-matching service and SIP calculations. The interest engine remains deferred.</p>
    </section>`,
  );
}
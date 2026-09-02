import { settingsSubScreen } from "./layout.js";

export function settingsHowToUseScreen(): string {
  return settingsSubScreen(
    "How To Use",
    `<section class="card">
      <h3>Mobile flow</h3>
      <p class="sub">Use Home for day-to-day Personal Expenses, the drawer for each module pair, and Import / Export for Keep Notes, Excel, and transfer actions.</p>
    </section>`,
  );
}
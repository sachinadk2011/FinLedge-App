import "./styles.css";

import { App } from "@capacitor/app";
import {
  appState,
  dismissProfilePrompt,
  exitApp,
  saveProfileName,
  showToast,
} from "./app-state.js";
import { drawer, screen, topbar } from "./components/shell.js";
import { activeHomeCategories, availableHomeCategories, homeScreen } from "./screens/home.js";
import { bankAddScreen, bankDashboardScreen } from "./screens/bank.js";
import { expensesAddScreen, expensesDashboardScreen } from "./screens/expenses.js";
import { settingsAboutScreen } from "./screens/settings-about.js";
import { settingsBackupSyncScreen } from "./screens/settings-backup-sync.js";
import { settingsHowToUseScreen } from "./screens/settings-how-to-use.js";
import { settingsImportExportScreen } from "./screens/settings-import-export.js";
import { settingsInvestmentScreen } from "./screens/settings-investment.js";
import { settingsPrivacyScreen } from "./screens/settings-privacy.js";
import { settingsProfileScreen } from "./screens/settings-profile.js";
import { settingsVersionScreen } from "./screens/settings-version.js";
import { settingsScreen } from "./screens/settings.js";
import { sharesAddScreen, sharesDashboardScreen } from "./screens/shares.js";
import { summaryScreen } from "./screens/summary.js";
import { transferScreen } from "./screens/transfer.js";
import type { ChartRange, ScreenId } from "./types.js";

function navigate(nextScreen: ScreenId, options: { replace?: boolean } = {}): void {
  if (nextScreen !== appState.activeScreen) {
    if (options.replace) {
      appState.screenHistory[appState.screenHistory.length - 1] = nextScreen;
    } else {
      appState.screenHistory.push(nextScreen);
    }
  }

  appState.activeScreen = nextScreen;
  render();
  window.scrollTo({ top: 0 });
}

function goBack(fallback: ScreenId = "home"): void {
  if (appState.activeScreen === "home") {
    const now = Date.now();
    if (now - appState.lastHomeBackPress < 1800) {
      exitApp();
      return;
    }
    appState.lastHomeBackPress = now;
    showToast("Press back again to exit");
    return;
  }

  appState.screenHistory.pop();
  navigate(appState.screenHistory[appState.screenHistory.length - 1] || fallback, { replace: true });
}

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <div class="app-shell">
      ${topbar()}
      ${drawer()}
      ${screen("home", homeScreen())}
      ${screen("bank-add", bankAddScreen())}
      ${screen("bank-dash", bankDashboardScreen())}
      ${screen("shares-add", sharesAddScreen())}
      ${screen("shares-dash", sharesDashboardScreen())}
      ${screen("expenses-add", expensesAddScreen())}
      ${screen("expenses-dash", expensesDashboardScreen())}
      ${screen("transfer", transferScreen())}
      ${screen("summary", summaryScreen())}
      ${screen("settings", settingsScreen())}
      ${screen("settings-profile", settingsProfileScreen())}
      ${screen("settings-import-export", settingsImportExportScreen())}
      ${screen("settings-investment", settingsInvestmentScreen())}
      ${screen("settings-backup-sync", settingsBackupSyncScreen())}
      ${screen("settings-privacy", settingsPrivacyScreen())}
      ${screen("settings-about", settingsAboutScreen())}
      ${screen("settings-how-to-use", settingsHowToUseScreen())}
      ${screen("settings-version", settingsVersionScreen())}
    </div>
  `;
  bindEvents();
}

function bindEvents(): void {
  document.querySelector("[data-open-drawer]")?.addEventListener("click", () => {
    document.querySelector(".drawer")?.classList.add("open");
    document.querySelector(".drawer-overlay")?.classList.add("open");
  });
  document.querySelector("[data-close-drawer]")?.addEventListener("click", closeDrawer);
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((node) => {
    node.addEventListener("click", () => navigate(node.dataset.nav as ScreenId));
  });
  document.querySelectorAll<HTMLElement>("[data-back]").forEach((node) => {
    node.addEventListener("click", () => goBack((node.dataset.back as ScreenId) || "home"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-home-mode]").forEach((node) => {
    node.addEventListener("click", () => {
      appState.homeMode = node.dataset.homeMode as "expense" | "income";
      appState.categorySelectionTouched = false;
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-home-range]").forEach((node) => {
    node.addEventListener("click", () => {
      appState.homeRange = node.dataset.homeRange as ChartRange;
      render();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[data-category-check]").forEach((node) => {
    node.addEventListener("change", updateCategorySelection);
  });
  document.querySelector<HTMLInputElement>("[data-custom-start]")?.addEventListener("change", (event) => {
    appState.customStart = (event.target as HTMLInputElement).value || appState.customStart;
    render();
  });
  document.querySelector<HTMLInputElement>("[data-custom-end]")?.addEventListener("change", (event) => {
    appState.customEnd = (event.target as HTMLInputElement).value || appState.customEnd;
    render();
  });
  document.querySelectorAll<HTMLFormElement>("[data-profile-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveProfileName(String(new FormData(form).get("profileName") || ""));
      render();
    });
  });
  document.querySelector("[data-dismiss-profile]")?.addEventListener("click", () => {
    dismissProfilePrompt();
    render();
  });
}

function updateCategorySelection(event: Event): void {
  const selectedValue = (event.target as HTMLInputElement).value;
  const checks = Array.from(document.querySelectorAll<HTMLInputElement>("[data-category-check]"));
  if (selectedValue === "__all__" && (event.target as HTMLInputElement).checked) {
    appState.categorySelectionTouched = false;
    appState.selectedHomeCategories = new Set(availableHomeCategories());
    render();
    return;
  }

  const selected = checks
    .filter((check) => check.value !== "__all__" && check.checked)
    .map((check) => check.value);

  if (!selected.length) {
    appState.categorySelectionTouched = false;
    appState.selectedHomeCategories = new Set(activeHomeCategories());
  } else {
    appState.categorySelectionTouched = true;
    appState.selectedHomeCategories = new Set(selected);
  }
  render();
}

function closeDrawer(): void {
  document.querySelector(".drawer")?.classList.remove("open");
  document.querySelector(".drawer-overlay")?.classList.remove("open");
}

function initBackButton(): void {
  App.addListener("backButton", () => {
    if (document.querySelector(".drawer.open")) {
      closeDrawer();
      return;
    }
    goBack();
  }).catch(() => {
    window.addEventListener("popstate", () => goBack());
  });
}

render();
initBackButton();

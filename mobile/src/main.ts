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
  // Use rAF so the active screen's layout is complete before scrolling charts to show today
  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>("[data-scroll-end]").forEach((el) => {
      el.scrollLeft = el.scrollWidth;
    });
  });
}

function bindEvents(): void {
  // Keep the focused input visible above the on-screen keyboard: whenever an
  // input/select/textArea gains focus, scroll it into a comfortable position.
  document.addEventListener("focusin", (event) => {
    const el = event.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) {
      window.setTimeout(() => scrollFieldIntoView(el), 120);
    }
  });

  // The on-screen keyboard can keep resizing the visual viewport after focus;
  // re-keep the active field visible while it settles.
  const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport;
  vv?.addEventListener("resize", () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const tag = active.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      scrollFieldIntoView(active);
    }
  });

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
  document.querySelectorAll<HTMLButtonElement>("[data-bank-range]").forEach((node) => {
    node.addEventListener("click", () => {
      appState.bankRange = node.dataset.bankRange as ChartRange;
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

  // Search inputs — update the query immediately (no re-render), then re-render
  // after a short debounce to keep typing smooth and preserve focus/caret.
  document.querySelectorAll<HTMLInputElement>("[data-search-module]").forEach((node) => {
    node.addEventListener("input", () => {
      const mod = node.dataset.searchModule ?? "";
      if (!mod) return;
      appState.dashSearchQuery[mod] = node.value.toLowerCase();
      scheduleDebouncedSearch(node, mod);
    });
  });

  // Expenses dashboard tab: Combined / Bank flow / Cash flow
  document.querySelectorAll<HTMLButtonElement>("[data-expenses-tab]").forEach((node) => {
    node.addEventListener("click", () => {
      appState.expensesDashTab = (node.dataset.expensesTab as typeof appState.expensesDashTab) ?? "combined";
      render();
    });
  });

  // Shares add-entry: re-render when entry type changes (conditional fields)
  document.querySelectorAll<HTMLSelectElement>("[data-shares-entry-type]").forEach((sel) => {
    sel.addEventListener("change", () => {
      appState.sharesEntryType = sel.value;
      render();
    });
  });

  // Shares add-entry: re-render when dividend type changes (cash vs bonus share)
  document.querySelectorAll<HTMLSelectElement>("[data-shares-dividend-type]").forEach((sel) => {
    sel.addEventListener("change", () => {
      appState.sharesDividendType = sel.value;
      render();
    });
  });

  // Shares add-entry: re-render when SIP type changes (installment vs redeem label)
  document.querySelectorAll<HTMLSelectElement>("[data-shares-sip-type]").forEach((sel) => {
    sel.addEventListener("change", () => {
      appState.sharesSipType = sel.value;
      render();
    });
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

let searchDebounceTimer: number | undefined;
let searchFocusModule = "";

/**
 * Debounces the search re-render so every keystroke doesn't rebuild the whole
 * DOM (which would drop the input's focus and dismiss the on-screen keyboard).
 * After rendering, refocus the search input, restore the caret, and scroll it
 * into view so the soft keyboard never covers it.
 */
function scheduleDebouncedSearch(node: HTMLInputElement, mod: string): void {
  searchFocusModule = mod;
  if (searchDebounceTimer !== undefined) {
    window.clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = undefined;
    render();
    const target = document.querySelector<HTMLInputElement>(`[data-search-module="${mod}"]`);
    if (target) {
      target.focus();
      try {
        target.setSelectionRange(target.value.length, target.value.length);
      } catch {
        /* no-op: some browsers reject setSelectionRange on some inputs */
      }
      scrollFieldIntoView(target);
    }
  }, 250);
}

/**
 * Scrolls a focused field into a comfortable position so the on-screen keyboard
 * never covers it. Uses window.visualViewport when available (accounts for the
 * keyboard resizing the layout) and falls back to a viewport-relative scroll.
 */
function scrollFieldIntoView(el: HTMLElement): void {
  const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport;
  // Visible height excludes the on-screen keyboard when visualViewport exists.
  const visibleH = vv && vv.height > 0 ? vv.height : window.innerHeight;
  const scroller = document.scrollingElement || document.documentElement;
  const rect = el.getBoundingClientRect();

  // If the field is below the keyboard (needs scrolling up), or clipped above the top.
  if (rect.bottom > visibleH * 0.7 || rect.top < 0) {
    // Scroll so the field sits near the top of the visible area (clear of the keyboard).
    const offsetTop = vv ? (vv.offsetTop || 0) : 0;
    const desiredTop = Math.max(12, Math.round(visibleH * 0.18)) + offsetTop;
    scroller.scrollTop += rect.top - desiredTop;
  }
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

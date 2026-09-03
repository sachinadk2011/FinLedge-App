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
import { bindShareSuggestions } from "./components/share-suggest.js";
import { bindSearchInputs } from "./components/search.js";
import { activeHomeCategories, availableHomeCategories, homeScreen } from "./screens/home.js";
import { bankAddScreen, bankDashboardScreen } from "./screens/bank.js";
import { expensesAddScreen, expensesDashboardScreen } from "./screens/expenses.js";
import { settingsScreen } from "./screens/settings/index.js";
import { settingsAboutScreen } from "./screens/settings/about.js";
import { settingsBackupSyncScreen } from "./screens/settings/backup-sync.js";
import { settingsHowToUseScreen } from "./screens/settings/how-to-use.js";
import { settingsImportExportScreen } from "./screens/settings/import-export.js";
import { settingsInvestmentScreen } from "./screens/settings/investment.js";
import { settingsPrivacyScreen } from "./screens/settings/privacy.js";
import { settingsProfileScreen } from "./screens/settings/profile.js";
import { settingsVersionScreen } from "./screens/settings/version.js";
import { sharesAddScreen, sharesDashboardScreen } from "./screens/shares.js";
import { summaryScreen } from "./screens/summary.js";
import { transferScreen } from "./screens/transfer.js";
import { bindKeyboardScrollProtection } from "./utils/viewport.js";
import type { ChartRange, ScreenId } from "./types.js";
import { importPasteScreen } from "./screens/keep-notes/paste.js";
import { importReviewScreen } from "./screens/keep-notes/review.js";
import { parseKeepNotes, type StagedEntry } from "../services/keep-notes-parser.js";
import { openMobileDatabase } from "./data/sqlite.js";
import { commitKeepNotes } from "../services/keep-notes-commit.js";
import { today, toDateKey } from "./utils/date.js";

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

  // Preserve scroll position across re-renders of the import review screen so
  // edits/splits/deletes don't jump the viewport to another row.
  const preserveScroll = appState.activeScreen === "import-review";
  const prevY = preserveScroll ? (document.scrollingElement || document.documentElement).scrollTop : 0;

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
      ${screen("import-paste", importPasteScreen())}
      ${screen("import-review", importReviewScreen())}
    </div>
  `;
  bindEvents();
  // Use rAF so the active screen's layout is complete before scrolling charts to show today
  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>("[data-scroll-end]").forEach((el) => {
      el.scrollLeft = el.scrollWidth;
    });
  });
  if (preserveScroll) {
    requestAnimationFrame(() => {
      (document.scrollingElement || document.documentElement).scrollTop = prevY;
    });
  }
}

function bindEvents(): void {
  // Keep the focused input visible above the on-screen keyboard.
  bindKeyboardScrollProtection();

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

  // Common search: one reusable binder handles every module's input, updates
  // the stored query, and re-renders (debounced) without dropping focus.
  bindSearchInputs(() => render());

  // Expenses dashboard tab: Combined / Bank flow / Cash flow
  document.querySelectorAll<HTMLButtonElement>("[data-expenses-tab]").forEach((node) => {
    node.addEventListener("click", () => {
      appState.expensesDashTab = (node.dataset.expensesTab as typeof appState.expensesDashTab) ?? "combined";
      render();
    });
  });

  // Share-name autocomplete panels (single dropdown, no re-render so focus stays)
  bindShareSuggestions();

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

  bindImportEvents();
  document.addEventListener("input", handleImportFieldEdit);
}

/** Keep Notes import flow event wiring (parse, search, add, commit, and per-row actions). */
function bindImportEvents(): void {
  document.querySelector("[data-import-parse]")?.addEventListener("click", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("[data-import-note]");
    const raw = textarea?.value.trim() ?? "";
    if (!raw) {
      toastNear("Paste some note text first.", textarea);
      return;
    }
    appState.importPasteDraft = raw;
    appState.importEntries = parseKeepNotes(raw).entries;
    navigate("import-review");
  });

  document.querySelector("[data-import-add-row]")?.addEventListener("click", () => {
    appState.importEntries.push(blankEntry());
    appState.importReviewQuery = "";
    render();
  });

  document.querySelector("[data-import-search]")?.addEventListener("input", (event) => {
    appState.importReviewQuery = (event.target as HTMLInputElement).value;
    render();
    refocusImportSearch();
  });

  document.querySelector("[data-import-commit]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    if (button.dataset.disabled) return;
    const unconfirmed = appState.importEntries.filter((e) => needsConfirm(e));
    if (unconfirmed.length) {
      showToast("Confirm flagged rows before committing.");
      render();
      return;
    }
    button.disabled = true;
    button.textContent = "Committing…";
    try {
      const db = await openMobileDatabase();
      const report = await commitKeepNotes(db, appState.importEntries);
      appState.importEntries = [];
      appState.importPasteDraft = "";
      showToast(`Committed ${report.written} row${report.written === 1 ? "" : "s"}.`);
      navigate("settings", { replace: true });
    } catch (error) {
      showToast("Commit failed. See console.");
      console.error(error);
      render();
    }
  });

  // Row actions use delegation so rows keep working after filter re-renders.
  document.querySelectorAll<HTMLElement>("[data-import-row]").forEach((panel) => {
    const id = panel.dataset.importRow ?? "";
    panel.querySelector("[data-import-confirm]")?.addEventListener("click", () => {
      confirmRow(id);
    });
    panel.querySelector("[data-import-delete]")?.addEventListener("click", () => {
      appState.importEntries = appState.importEntries.filter((e) => e.id !== id);
      render();
    });
    panel.querySelector("[data-import-split]")?.addEventListener("click", () => {
      splitRow(id);
    });
    panel.querySelector("[data-import-undo-split]")?.addEventListener("click", () => {
      undoRowSplit(id);
    });
  });
}

/** Live-edit a staged row's fields without a full render (keeps focus/caret). */
function handleImportFieldEdit(event: Event): void {
  const field = event.target as HTMLElement;
  const panel = field.closest<HTMLElement>("[data-import-row]");
  if (!panel) return;
  const id = panel.dataset.importRow ?? "";
  const entry = appState.importEntries.find((e) => e.id === id);
  if (!entry) return;

  const attr =
    field.dataset.importDate ? "date" :
    field.dataset.importLabel ? "label" :
    field.dataset.importModule ? "module" :
    field.dataset.importFlow ? "flow" :
    field.dataset.importDirection ? "direction" :
    field.dataset.importCategory ? "category" :
    field.dataset.importDescription ? "description" :
    (field instanceof HTMLInputElement && field.type === "number") ? "amount" : "";
  if (!attr) return;

  const value = (field as HTMLInputElement | HTMLSelectElement).value;
  if (attr === "amount") {
    const n = Number(value);
    entry.amount = Number.isFinite(n) ? n : 0;
  } else if (attr === "module") {
    entry.module = value as StagedEntry["module"];
  } else if (attr === "direction") {
    entry.direction = value as StagedEntry["direction"];
  } else if (attr === "flow") {
    entry.flow = value as StagedEntry["flow"];
  } else if (attr === "category") {
    entry.category = value;
  } else if (attr === "date") {
    entry.date = value;
  } else if (attr === "label") {
    entry.label = value;
  } else if (attr === "description") {
    entry.description = value;
  }
  entry.edited = true;
  // Amount handled separately (number input).
}

function confirmRow(id: string): void {
  const entry = appState.importEntries.find((e) => e.id === id);
  if (!entry) return;
  entry.flags = entry.flags.filter((f) => f.kind !== "ambiguous" && f.kind !== "checksum");
  render();
}

function splitRow(id: string): void {
  const entry = appState.importEntries.find((e) => e.id === id);
  if (!entry) return;
  const halves = Math.floor(entry.amount / 2);
  const rem = entry.amount - halves;
  const group = `split-${Date.now().toString(36)}`;
  const clone: StagedEntry = {
    ...entry,
    id: `${entry.id}-s`,
    amount: rem,
    splitGroup: group,
    flags: [],
    edited: true,
    description: `${entry.label || "Item"} (part)`,
  };
  entry.amount = halves;
  entry.splitGroup = group;
  entry.flags = [];
  entry.description = `${entry.label || "Item"} (part)`;
  appState.importEntries.splice(indexOfId(id) + 1, 0, clone);
  render();
}

function undoRowSplit(id: string): void {
  const clicked = appState.importEntries.find((e) => e.id === id);
  if (!clicked || !clicked.splitGroup) return;
  const group = clicked.splitGroup;
  const peers = appState.importEntries.filter((e) => e.splitGroup === group);
  if (peers.length < 2) return;
  const base = peers.find((e) => !e.id.endsWith("-s")) ?? peers[0];
  const originals = peers.map((e) => e.id);
  const idx = appState.importEntries.findIndex((e) => e.id === originals[0]);
  const merged: StagedEntry = {
    ...base,
    id: base.id.endsWith("-s") ? base.id.slice(0, -2) : base.id,
    amount: peers.reduce((s, e) => s + e.amount, 0),
    splitGroup: undefined,
    flags: [],
    edited: true,
    description: base.label || "",
  };
  appState.importEntries = appState.importEntries.filter((e) => e.splitGroup !== group);
  appState.importEntries.splice(Math.max(idx, 0), 0, merged);
  render();
}

function blankEntry(): StagedEntry {
  return {
    id: `manual-${Date.now().toString(36)}`,
    date: toDateKey(today()),
    amount: 0,
    label: "",
    description: "",
    module: "personal",
    direction: "expense",
    flow: "cash",
    category: "Other",
    flags: [],
    edited: true,
  };
}

function needsConfirm(entry: StagedEntry): boolean {
  return entry.flags.some((f) => f.kind === "ambiguous" || f.kind === "checksum");
}

function indexOfId(id: string): number {
  return appState.importEntries.findIndex((e) => e.id === id);
}

function refocusImportSearch(): void {
  const search = document.querySelector<HTMLInputElement>("[data-import-search]");
  if (!search) return;
  search.focus();
  try {
    search.setSelectionRange(search.value.length, search.value.length);
  } catch {
    /* ignore */
  }
}

function toastNear(message: string, anchor: Element | null): void {
  showToast(message);
  anchor?.classList.add("import-error-flash");
  window.setTimeout(() => anchor?.classList.remove("import-error-flash"), 1200);
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

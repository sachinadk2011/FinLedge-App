import { App } from "@capacitor/app";
import type { ChartRange, ScreenId } from "./types.js";
import { toDateKey, today } from "./utils/date.js";

export const deviceName = "mobile-local";
export const appVersionLabel = "mobile-v1.0.0";

const profileNameKey = "finledge.mobile.profileName";
const profilePromptDismissedKey = "finledge.mobile.profilePromptDismissed";

export const appState = {
  activeScreen: "home" as ScreenId,
  screenHistory: ["home"] as ScreenId[],
  lastHomeBackPress: 0,
  homeMode: "expense" as "expense" | "income",
  homeRange: "week" as ChartRange,
  selectedHomeCategories: new Set<string>(),
  categorySelectionTouched: false,
  customStart: toDateKey(new Date(today().getFullYear(), today().getMonth(), 1)),
  customEnd: toDateKey(today()),
};

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getProfileName(): string {
  return window.localStorage.getItem(profileNameKey)?.trim() || "";
}

export function profileInitial(): string {
  return (getProfileName() || "F").slice(0, 1).toUpperCase();
}

export function shouldShowProfilePrompt(): boolean {
  return !getProfileName() && !window.localStorage.getItem(profilePromptDismissedKey);
}

export function saveProfileName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  window.localStorage.setItem(profileNameKey, trimmed);
  window.localStorage.setItem(profilePromptDismissedKey, "1");
}

export function dismissProfilePrompt(): void {
  window.localStorage.setItem(profilePromptDismissedKey, "1");
}

export function showToast(message: string): void {
  const existing = document.querySelector(".toast");
  existing?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1600);
}

export function exitApp(): void {
  void App.exitApp();
}


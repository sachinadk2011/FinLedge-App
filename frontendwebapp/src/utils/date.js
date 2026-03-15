export function getTodayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const adjusted = new Date(now.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

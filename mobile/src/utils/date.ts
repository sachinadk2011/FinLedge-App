export function today(): Date {
  return new Date();
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(start: string, end: string): number {
  const from = parseDateKey(start).getTime();
  const to = parseDateKey(end).getTime();
  return Math.floor((to - from) / 86_400_000) + 1;
}

export function monthKey(date: Date): string {
  return toDateKey(date).slice(0, 7);
}

export function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long" });
}


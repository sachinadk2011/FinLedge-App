export function money(value: number, options: { sign?: boolean } = {}): string {
  const abs = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (!options.sign) {
    return `Rs ${abs}`;
  }
  return `${value >= 0 ? "+" : "-"}Rs ${abs}`;
}

export function compactMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 100_000) {
    return `${sign}${(abs / 100_000).toFixed(abs % 100_000 === 0 ? 0 : 1)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;
  }
  return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}


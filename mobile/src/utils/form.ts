/**
 * Read submitted form values from within a scope element by input name.
 * Inputs are looked up by `name=` attribute, so every reader stays in sync
 * with whatever the screens render.
 */
export interface FormReader {
  pick: (name: string) => string;
  toNumber: (name: string) => number;
}

export function formReader(scope: HTMLElement): FormReader {
  const pick = (name: string): string => {
    const el = scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
    return el ? String(el.value ?? "").trim() : "";
  };
  const toNumber = (name: string): number => {
    const n = Number(pick(name));
    return Number.isFinite(n) ? n : 0;
  };
  return { pick, toNumber };
}
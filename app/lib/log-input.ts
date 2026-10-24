/** Decimal editors accept either separator, but never grouping or partial numbers. */
export function parseDecimalInput(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) throw new Error("Invalid number");
  const parsed = Number(text.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("Invalid number");
  return parsed;
}

export function parseHourInput(value: string): number | null {
  const text = value.trim();
  if (!text.includes(":")) {
    const hours = parseDecimalInput(text);
    if (hours !== null && hours < 0) throw new Error("Invalid duration");
    return hours;
  }
  const match = /^(\d+):([0-5]\d)$/.exec(text);
  if (!match) throw new Error("Invalid duration");
  const hours = Number(match[1]) + Number(match[2]) / 60;
  if (!Number.isFinite(hours)) throw new Error("Invalid duration");
  return hours;
}

export function formatEngineHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "";
  const minutes = Math.round(Math.abs(hours) * 60);
  return `${hours < 0 ? "−" : ""}${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/** Match the view's decimal separator without grouping, rounding or losing typed precision. */
export function decimalSeparator(locale?: Intl.LocalesArgument) {
  return new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
}

export function formatDecimalInput(value: string | number | null | undefined, locale?: Intl.LocalesArgument): string {
  const text = value == null ? "" : String(value);
  if (!/[.,]/.test(text)) return text;
  try {
    parseDecimalInput(text);
    return text.replace(/[.,]/, decimalSeparator(locale));
  } catch { return text; }
}

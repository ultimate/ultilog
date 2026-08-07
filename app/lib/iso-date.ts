const englishMonthNumbers: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function normalizeIsoDate(value: string): string | undefined {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T, ])/);
  if (iso) return validIsoDate(iso[1], iso[2], iso[3]);

  const legacyMonth = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{4})$/);
  if (legacyMonth) {
    const month = englishMonthNumbers[legacyMonth[2].toLowerCase()];
    if (month) return validIsoDate(legacyMonth[3], month, legacyMonth[1].padStart(2, "0"));
  }

  return undefined;
}

export function requireIsoDate(value: string, label = "Date") {
  const normalized = normalizeIsoDate(value);
  if (!normalized) throw new Error(`${label} must be a valid ISO date (YYYY-MM-DD).`);
  return normalized;
}

function validIsoDate(year: string, month: string, day: string) {
  const candidate = `${year}-${month}-${day}`;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : undefined;
}

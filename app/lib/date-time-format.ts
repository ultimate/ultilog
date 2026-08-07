import { normalizeIsoDate } from "./iso-date";

export const dateFormats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy", "dd-MM-yyyy", "d MMM yyyy", "MMM d, yyyy"] as const;
export const timeFormats = ["HH:mm", "h:mm a", "HH:mm:ss", "h:mm:ss a"] as const;

export type DateFormat = (typeof dateFormats)[number];
export type TimeFormat = (typeof timeFormats)[number];

export const defaultDateFormat: DateFormat = "dd/MM/yyyy";
export const defaultTimeFormat: TimeFormat = "HH:mm";

export function isDateFormat(value: unknown): value is DateFormat {
  return typeof value === "string" && (dateFormats as readonly string[]).includes(value);
}

export function isTimeFormat(value: unknown): value is TimeFormat {
  return typeof value === "string" && (timeFormats as readonly string[]).includes(value);
}

/** Formats a stored ISO date or the legacy `dd MMM yyyy` log-sheet date without changing storage. */
export function formatStoredDate(value: string | undefined | null, format: DateFormat, locale = "en"): string {
  if (!value) return "";
  const normalized = normalizeIsoDate(value);
  if (!normalized) return value;
  const [year, month, day] = normalized.split("-");
  const shortMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  switch (format) {
    case "MM/dd/yyyy": return `${month}/${day}/${year}`;
    case "yyyy-MM-dd": return `${year}-${month}-${day}`;
    case "dd.MM.yyyy": return `${day}.${month}.${year}`;
    case "dd-MM-yyyy": return `${day}-${month}-${year}`;
    case "d MMM yyyy": return `${Number(day)} ${shortMonth} ${year}`;
    case "MMM d, yyyy": return `${shortMonth} ${Number(day)}, ${year}`;
    default: return `${day}/${month}/${year}`;
  }
}

export function formatStoredTime(value: string | undefined | null, format: TimeFormat): string {
  if (!value) return "";
  const match = value.match(/(?:^|T)(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return value;
  const [, hours, minutes, seconds = "00"] = match;
  const includeSeconds = format.includes("ss");
  if (format.startsWith("HH")) return `${hours}:${minutes}${includeSeconds ? `:${seconds}` : ""}`;
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes}${includeSeconds ? `:${seconds}` : ""} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatStoredDateTime(value: string | undefined | null, dateFormat: DateFormat, timeFormat: TimeFormat, locale = "en"): string {
  if (!value) return "";
  const date = formatStoredDate(value, dateFormat, locale);
  const time = formatStoredTime(value, timeFormat);
  return time && time !== value ? `${date}, ${time}` : date;
}

export function formatStoredDateRange(from: string | undefined | null, to: string | undefined | null, dateFormat: DateFormat, locale = "en") {
  const start = formatStoredDate(from, dateFormat, locale);
  const end = formatStoredDate(to, dateFormat, locale);
  if (!start) return end;
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

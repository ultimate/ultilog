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

/** Formats a stored ISO date without changing storage. */
export function formatStoredDate(value: string | undefined | null, format: DateFormat, locale = "en"): string {
  if (!value) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}(?:$|[T, ])/.test(value.trim()) ? normalizeIsoDate(value) : undefined;
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

/** Parse only the configured format; never guess ambiguous day/month order. */
export function parseFormattedDate(value: string, format: DateFormat, locale = "en"): string | undefined {
  const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokens: string[] = [];
  const pattern = format.split(/(yyyy|MMM|MM|dd|d)/).map((part) => {
    if (!["yyyy", "MMM", "MM", "dd", "d"].includes(part)) return escaped(part);
    tokens.push(part);
    return part === "yyyy" ? "(\\d{4})" : part === "MMM" ? "(.+?)" : "(\\d{1,2})";
  }).join("");
  const match = value.trim().match(new RegExp(`^${pattern}$`, "iu"));
  if (!match) return undefined;
  let year = "", month = "", day = "";
  tokens.forEach((token, index) => {
    const part = match[index + 1];
    if (token === "yyyy") year = part;
    else if (token === "MMM") {
      const formatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
      const monthIndex = Array.from({ length: 12 }, (_, i) => formatter.format(new Date(Date.UTC(2026, i, 1))).toLocaleLowerCase(locale)).indexOf(part.toLocaleLowerCase(locale));
      if (monthIndex >= 0) month = String(monthIndex + 1).padStart(2, "0");
    } else if (token === "MM") month = part.padStart(2, "0");
    else day = part.padStart(2, "0");
  });
  return normalizeIsoDate(`${year}-${month}-${day}`);
}

export function parsePreferenceDateTime(text: string, dateFormat: DateFormat, timeFormat: TimeFormat, locale: string): string | undefined {
  const match = /^(.*?)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i.exec(text.trim());
  if (!match) return undefined;
  const date = parseFormattedDate(match[1].replace(/,\s*$/, ""), dateFormat, locale);
  let hours = Number(match[2]);
  const minutes = Number(match[3]), seconds = Number(match[4] ?? 0);
  const twelveHour = timeFormat.includes("a");
  if (!date || minutes > 59 || seconds > 59 || (twelveHour ? hours < 1 || hours > 12 || !match[5] : hours > 23 || Boolean(match[5]))) return undefined;
  if (twelveHour) hours = hours % 12 + (match[5].toUpperCase() === "PM" ? 12 : 0);
  return `${date}T${String(hours).padStart(2, "0")}:${match[3]}${timeFormat.includes("ss") ? `:${String(seconds).padStart(2, "0")}` : ""}`;
}

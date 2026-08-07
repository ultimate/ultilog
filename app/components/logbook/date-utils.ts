const offsetPattern = /(Z|[+-]\d{2}:\d{2})$/;

export const timeZoneOffsetOptions = ["-12:00", "-11:00", "-10:00", "-09:30", "-09:00", "-08:00", "-07:00", "-06:00", "-05:00", "-04:00", "-03:30", "-03:00", "-02:00", "-01:00", "+00:00", "+01:00", "+02:00", "+03:00", "+03:30", "+04:00", "+04:30", "+05:00", "+05:30", "+05:45", "+06:00", "+06:30", "+07:00", "+08:00", "+08:45", "+09:00", "+09:30", "+10:00", "+10:30", "+11:00", "+12:00", "+12:45", "+13:00", "+14:00"] as const;

export function dateTimeLocalFromParts(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}

export function splitDateTimeLocal(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function dateTimeLocalFromStamp(value: string) {
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (iso) return `${iso[1]}T${iso[2]}`;
  const withTime = value.match(/^(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2})/);
  if (withTime) return `${withTime[1]}T${withTime[2]}`;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? `${dateOnly[1]}T00:00` : "";
}

export function timezoneOffsetFromStamp(value: string) {
  const match = value.match(offsetPattern);
  if (!match) return localTimezoneOffset();
  return match[1] === "Z" ? "+00:00" : match[1];
}

export function localTimezoneOffset(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function isoDateTimeWithTimezone(dateTimeLocal: string, timezoneOffset: string) {
  if (!dateTimeLocal) return "";
  const { date, time } = splitDateTimeLocal(dateTimeLocal);
  if (!date) return "";
  return `${date}T${time || "00:00"}:00${normalizeTimezoneOffset(timezoneOffset)}`;
}

export function routeStamp(date: string, time: string, timezoneOffset = localTimezoneOffset()) {
  return isoDateTimeWithTimezone(`${date}T${time || "00:00"}`, timezoneOffset);
}

export function routeStampFromDateTimeLocal(dateTimeLocal: string, timezoneOffset = localTimezoneOffset()) {
  return isoDateTimeWithTimezone(dateTimeLocal, timezoneOffset);
}

function normalizeTimezoneOffset(value: string) {
  if (value === "Z") return "+00:00";
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : localTimezoneOffset();
}

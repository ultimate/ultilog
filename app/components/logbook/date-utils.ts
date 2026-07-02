export function dateTimeLocalFromParts(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}

export function splitDateTimeLocal(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

export function dateTimeLocalFromStamp(value: string) {
  const withTime = value.match(/^(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2})/);
  if (withTime) return `${withTime[1]}T${withTime[2]}`;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? `${dateOnly[1]}T00:00` : "";
}

export function routeStamp(date: string, time: string) {
  return time ? `${date}, ${time}` : `${date}, time open`;
}

export function routeStampFromDateTimeLocal(dateTimeLocal: string) {
  const { date, time } = splitDateTimeLocal(dateTimeLocal);
  return date ? (time ? `${date}, ${time}` : `${date}, time open`) : "";
}

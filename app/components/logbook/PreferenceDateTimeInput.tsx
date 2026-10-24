import { useState, type InputHTMLAttributes, type ChangeEvent } from "react";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import { useI18n } from "../../lib/i18n";
import { parseFormattedDate, formatStoredDateTime } from "../../lib/date-time-format";

export function parsePreferenceDateTime(text: string, dateFormat: Parameters<typeof parseFormattedDate>[1], timeFormat: string, locale: string): string | undefined {
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

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & { value: string };
export function PreferenceDateTimeInput({ value, onChange, onBlur, ...props }: Props) {
  const { dateFormat, timeFormat } = useDateTimeFormat();
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState<{ value: string; text: string; format: string } | null>(null);
  const format = `${dateFormat} ${timeFormat} ${locale}`;
  const text = draft?.value === value && draft.format === format ? draft.text : formatStoredDateTime(value, dateFormat, timeFormat, locale);
  return <input {...props} type="text" value={text} placeholder={`${dateFormat} ${timeFormat}`} onChange={event => {
    const text = event.currentTarget.value;
    const parsed = text.trim() ? parsePreferenceDateTime(text, dateFormat, timeFormat, locale) : "";
    event.currentTarget.setCustomValidity(parsed === undefined ? t("details.invalidDateTime") : "");
    setDraft({ value: parsed ?? value, text, format });
    if (parsed !== undefined) onChange?.({ ...event, target: { ...event.target, value: parsed }, currentTarget: { ...event.currentTarget, value: parsed } } as ChangeEvent<HTMLInputElement>);
  }} onBlur={event => {
    if (event.currentTarget.validity.valid) setDraft(null);
    onBlur?.(event);
  }} />;
}

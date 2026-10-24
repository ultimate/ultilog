import { useRef, useState, type InputHTMLAttributes, type ChangeEvent } from "react";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import { useI18n } from "../../lib/i18n";
import { normalizeIsoDate } from "../../lib/iso-date";
import { dateTimeLocalFromStamp } from "./date-utils";
import { parseFormattedDate, parsePreferenceDateTime, formatStoredDate, formatStoredDateTime } from "../../lib/date-time-format";

export type PreferenceDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & {
  value: string;
  mode?: "date" | "datetime-local";
  containerClassName?: string;
};

/** Shared date/date-time editor: preference-formatted text with a native chooser. */
export function PreferenceDateInput({ value, mode = "date", containerClassName, onChange, onBlur, ...props }: PreferenceDateInputProps) {
  const { dateFormat, timeFormat } = useDateTimeFormat();
  const { locale, t } = useI18n();
  const textInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ value: string; text: string; format: string } | null>(null);
  const withTime = mode === "datetime-local";
  const format = `${mode} ${dateFormat} ${withTime ? timeFormat : ""} ${locale}`;
  const formatted = withTime ? formatStoredDateTime(value, dateFormat, timeFormat, locale) : formatStoredDate(value, dateFormat, locale);
  const text = draft?.value === value && draft.format === format ? draft.text : formatted;
  const parse = (text: string) => withTime ? parsePreferenceDateTime(text, dateFormat, timeFormat, locale) : parseFormattedDate(text, dateFormat, locale);
  const invalidText = Boolean(text.trim() && !parse(text));
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true" || invalidText;
  const pickerDisabled = props.disabled || props.readOnly;
  const label = props["aria-label"] ?? t(withTime ? "details.lineDateTime" : "logbooks.chooseDate");
  const pickerLabel = withTime ? `${t("details.chooseDateTime")}: ${label}` : `${label}: ${t("logbooks.chooseDate")}`;
  return <span className={["formatted-date-input", containerClassName].filter(Boolean).join(" ")}>
    <input {...props} ref={textInputRef} type="text" value={text} aria-invalid={invalid} placeholder={withTime ? `${dateFormat} ${timeFormat}` : dateFormat}
      onChange={event => {
        const text = event.currentTarget.value;
        const parsed = text.trim() ? parse(text) : "";
        event.currentTarget.setCustomValidity?.(parsed === undefined ? t(withTime ? "details.invalidDateTime" : "details.invalidDate") : "");
        setDraft({ value: parsed ?? value, text, format });
        if (parsed !== undefined) onChange?.({ ...event, target: { ...event.target, value: parsed }, currentTarget: { ...event.currentTarget, value: parsed } } as ChangeEvent<HTMLInputElement>);
      }} onBlur={event => {
        if (!invalidText && event.currentTarget.validity?.valid !== false) setDraft(null);
        onBlur?.(event);
      }} />
    <span className="formatted-date-calendar" data-disabled={pickerDisabled || undefined}>
      <span aria-hidden="true">📅</span>
      <input type={mode} aria-label={pickerLabel} title={pickerLabel} aria-describedby={props["aria-describedby"]} aria-invalid={invalid}
        value={withTime ? dateTimeLocalFromStamp(value) : normalizeIsoDate(value) ?? ""} disabled={pickerDisabled} min={props.min} max={props.max} step={withTime ? (timeFormat.includes("ss") ? 1 : 60) : undefined}
        onChange={event => {
          if (event.currentTarget?.validity?.badInput) return;
          textInputRef.current?.setCustomValidity("");
          setDraft(null);
          onChange?.(event);
        }} />
    </span>
  </span>;
}

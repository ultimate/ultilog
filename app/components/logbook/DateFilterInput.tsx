import { useState } from "react";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import { useI18n } from "../../lib/i18n";
import { parseFormattedDate } from "../../lib/date-time-format";

export function DateFilterInput({ value, onChange, label, min, max, invalid, describedBy }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const { formatDate, dateFormat } = useDateTimeFormat();
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState<{ text: string; value: string; format: string; locale: string } | null>(null);
  const text = draft && draft.value === value && draft.format === dateFormat && draft.locale === locale ? draft.text : formatDate(value);
  const invalidText = Boolean(text && !parseFormattedDate(text, dateFormat, locale));
  return <label>
    <span>{label}</span>
    <span className="formatted-date-filter">
      <input type="text" value={text} placeholder={dateFormat} aria-label={label} aria-invalid={invalid || invalidText} aria-describedby={describedBy}
        onChange={(event) => {
          const nextText = event.currentTarget.value;
          const parsed = parseFormattedDate(nextText, dateFormat, locale);
          const nextValue = nextText ? parsed ?? value : "";
          setDraft({ text: nextText, value: nextValue, format: dateFormat, locale });
          if (!nextText || parsed) onChange(nextValue);
        }}
        onBlur={(event) => {
          if (event.currentTarget.value && !parseFormattedDate(event.currentTarget.value, dateFormat, locale)) return;
          setDraft(null);
        }} />
      <span className="formatted-date-calendar">
        <span aria-hidden="true">📅</span>
        <input type="date" value={value} min={min} max={max} aria-label={`${label}: ${t("logbooks.chooseDate")}`} aria-invalid={invalid} aria-describedby={describedBy}
          onChange={(event) => { setDraft(null); onChange(event.currentTarget.value); }} />
      </span>
    </span>
  </label>;
}

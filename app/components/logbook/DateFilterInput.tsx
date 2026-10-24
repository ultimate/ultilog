import { PreferenceDateInput } from "./PreferenceDateInput";

export function DateFilterInput({ value, onChange, label, min, max, invalid, describedBy }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  invalid: boolean;
  describedBy?: string;
}) {
  return <label>
    <span>{label}</span>
    <PreferenceDateInput value={value} onChange={event => onChange(event.currentTarget.value)} aria-label={label}
      min={min} max={max} aria-invalid={invalid} aria-describedby={describedBy} containerClassName="formatted-date-filter" />
  </label>;
}

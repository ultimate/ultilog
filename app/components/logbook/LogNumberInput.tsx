import { useState, type InputHTMLAttributes } from "react";
import { formatDecimalInput, formatEngineHours, parseDecimalInput, parseHourInput } from "../../lib/log-input";
import { useI18n } from "../../lib/i18n";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { hours?: boolean };
export function LogNumberInput({ hours, value: controlledValue, defaultValue, onChange, onBlur, onFocus, ...props }: Props) {
  const { t, locale } = useI18n();
  const [localValue, setLocalValue] = useState(() => String(defaultValue ?? ""));
  const [draft, setDraft] = useState<{ source: string; text: string } | null>(null);
  const value = String(controlledValue ?? localValue);
  const format = (text: string) => {
    if (!hours) return formatDecimalInput(text, locale);
    try { return formatEngineHours(parseHourInput(text)); } catch { return text; }
  };
  const validate = (input: HTMLInputElement) => {
    try {
      const value = (hours ? parseHourInput : parseDecimalInput)(input.value);
      if (value !== null && ((props.min !== undefined && value < Number(props.min)) || (props.max !== undefined && value > Number(props.max)))) throw new Error();
      input.setCustomValidity("");
      return value;
    } catch {
      input.setCustomValidity(t(hours ? "details.invalidHours" : "details.invalidNumber"));
      return undefined;
    }
  };
  return <input {...props} type="text" value={draft?.source === value ? draft.text : format(value)} inputMode={hours ? "text" : "decimal"} placeholder={hours ? "HH:mm" : props.placeholder}
    onFocus={event => { setDraft({ source: value, text: event.currentTarget.value }); onFocus?.(event); }}
    onChange={event => {
      validate(event.currentTarget);
      setDraft({ source: event.currentTarget.value, text: event.currentTarget.value });
      if (controlledValue === undefined) setLocalValue(event.currentTarget.value);
      onChange?.(event);
    }}
    onBlur={event => {
      const parsed = validate(event.currentTarget);
      if (parsed !== undefined) {
        const formatted = format(event.currentTarget.value.trim());
        event.currentTarget.value = formatted;
        if (controlledValue === undefined) setLocalValue(formatted);
        if (formatted !== value) onChange?.(event);
      }
      setDraft(null);
      onBlur?.(event);
    }} />;
}

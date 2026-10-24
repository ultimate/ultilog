import type { InputHTMLAttributes } from "react";
import { formatEngineHours, parseDecimalInput, parseHourInput } from "../../lib/log-input";
import { useI18n } from "../../lib/i18n";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { hours?: boolean };
export function LogNumberInput({ hours, onChange, onBlur, ...props }: Props) {
  const { t } = useI18n();
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
  return <input {...props} type="text" inputMode={hours ? "text" : "decimal"} placeholder={hours ? "HH:mm" : props.placeholder}
    onChange={event => { validate(event.currentTarget); onChange?.(event); }}
    onBlur={event => {
      const value = validate(event.currentTarget);
      if (hours && value !== undefined) {
        event.currentTarget.value = formatEngineHours(value);
        onChange?.(event);
      }
      onBlur?.(event);
    }} />;
}

import { PreferenceDateInput, type PreferenceDateInputProps } from "./PreferenceDateInput";

export { parsePreferenceDateTime } from "../../lib/date-time-format";

export function PreferenceDateTimeInput(props: Omit<PreferenceDateInputProps, "mode">) {
  return <PreferenceDateInput {...props} mode="datetime-local" />;
}

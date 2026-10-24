import { useI18n } from "../../lib/i18n";
import { PreferenceDateTimeInput } from "./PreferenceDateTimeInput";

export function LogLineDateTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  return <PreferenceDateTimeInput aria-label={t("details.lineDateTime")} value={value} onChange={event => onChange(event.target.value)} />;
}

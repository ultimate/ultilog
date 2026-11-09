import { createContext, useContext, useRef, useState, type ButtonHTMLAttributes } from "react";
import { useI18n } from "../../lib/i18n";

export const SavingContext = createContext<ReadonlySet<string>>(new Set());

/** The ref closes the gap before React renders the disabled button. */
export function usePendingSaves() {
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  async function run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setPending(new Set(inFlight.current));
    try { return await action(); }
    finally { inFlight.current.delete(key); setPending(new Set(inFlight.current)); }
  }
  return { pending, run };
}

export function SaveButton({ saveKey, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { saveKey: string }) {
  const pending = useContext(SavingContext).has(saveKey);
  const { t } = useI18n();
  return <button {...props} disabled={disabled || pending} aria-busy={pending} aria-label={pending ? t("nav.saving") : props["aria-label"]}>
    {pending ? <><span className="save-spinner" aria-hidden="true" /><span role="status">{t("nav.saving")}</span></> : children}
  </button>;
}

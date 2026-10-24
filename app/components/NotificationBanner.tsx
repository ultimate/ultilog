"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useI18n } from "../lib/i18n";

type NotificationBannerProps = {
  message: string | null;
  kind?: "success" | "error";
  onDismiss: Dispatch<SetStateAction<string | null>>;
};

/** Success expires; errors remain available until explicitly dismissed. */
export function NotificationBanner({ message, kind = "success", onDismiss }: NotificationBannerProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!message || kind === "error") return;
    const timer = setTimeout(() => onDismiss(null), 5000);
    return () => clearTimeout(timer);
  }, [message, kind, onDismiss]);

  if (!message) return null;
  return (
    <div className={`toast-notification toast-notification-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{message}</span>
      <button type="button" aria-label={t("common.dismissNotification")} onClick={() => onDismiss(null)}>×</button>
    </div>
  );
}

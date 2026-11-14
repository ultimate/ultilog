import { describeTurns } from "../../../domain/logbook/turns";
import { emptyTurnState, type TurnState } from "../../../models/turn";
import { useI18n } from "../../../lib/i18n";
import { useDateTimeFormat } from "../../../lib/DateTimeFormatProvider";
import type { ReactNode } from "react";
import { DashboardPanel, type DashboardStats } from "../../../templates/DashboardPanel";
import type { Boat, LogSheet } from "../../../models/logbook";
import { DashboardComplianceProgress } from "../compliance/DashboardComplianceProgress";

export function DashboardPage({ stats, onboardingChecklist, sheets, boats = [], language, onOpenCompliance, turnState, now, onOpenTurns }: { turnState?: TurnState; now?: number; onOpenTurns?: (id?: string) => void; stats: DashboardStats; onboardingChecklist?: ReactNode; sheets: readonly LogSheet[]; boats?: readonly Boat[]; language: string; onOpenCompliance: () => void }) {
  const { t } = useI18n(); const { formatDate } = useDateTimeFormat();
  const turns = describeTurns([...sheets],turnState ?? emptyTurnState(),now ?? 0);
  const latest = turns.at(-1);
  return <><DashboardPanel stats={stats} onboardingChecklist={onboardingChecklist} /><section className="info-card turn-dashboard"><h2>{t("nav.turns")}: {turns.length}</h2>{latest && <><button type="button" onClick={() => onOpenTurns?.(latest.id)}>{latest.name || t("turns.unnamed")}</button><p>{formatDate(latest.start)} — {t("turns.through")} {formatDate(latest.through)} {latest.ongoing && <span className="status-pill">{t("turns.ongoing")}</span>} · {latest.totals.totalMiles.toFixed(1)} nm</p></>}<button type="button" onClick={() => onOpenTurns?.()}>{t("turns.all")}</button></section><DashboardComplianceProgress sheets={sheets} boats={boats} language={language} onOpenCompliance={onOpenCompliance} /></>;
}

import type { CSSProperties } from "react";
import type { RequirementStatusSummary } from "../../../domain/compliance/license-progress";
import { useI18n } from "../../../lib/i18n";

export function LicenseStatusPie({ summary, compact = false }: { summary: RequirementStatusSummary; compact?: boolean }) {
  const { t } = useI18n();
  const total = Math.max(summary.total, 1);
  const fulfilled = (summary.fulfilled / total) * 100;
  const inProgress = (summary.inProgress / total) * 100;
  const style = { "--fulfilled": `${fulfilled}%`, "--progress-end": `${fulfilled + inProgress}%` } as CSSProperties;
  return <div className={`license-status ${compact ? "license-status-compact" : ""}`}>
    <div className="license-status-pie" style={style} role="img" aria-label={`${summary.fulfilled} ${t("compliance.fulfilled")}, ${summary.inProgress} ${t("compliance.inProgress")}, ${summary.open} ${t("compliance.open")}`}><strong>{summary.fulfilled}/{summary.total}</strong></div>
    <dl className="license-status-legend">
      <div className="fulfilled"><dt>{t("compliance.fulfilled")}</dt><dd>{summary.fulfilled}</dd></div>
      <div className="in-progress"><dt>{t("compliance.inProgress")}</dt><dd>{summary.inProgress}</dd></div>
      <div className="open"><dt>{t("compliance.open")}</dt><dd>{summary.open}</dd></div>
    </dl>
  </div>;
}

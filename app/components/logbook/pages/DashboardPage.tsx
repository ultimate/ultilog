import type { ReactNode } from "react";
import { DashboardPanel, type DashboardStats } from "../../../templates/DashboardPanel";
import type { LogSheet } from "../../../models/logbook";
import { DashboardComplianceProgress } from "../compliance/DashboardComplianceProgress";

export function DashboardPage({ stats, onboardingChecklist, sheets, language, onOpenCompliance }: { stats: DashboardStats; onboardingChecklist?: ReactNode; sheets: readonly LogSheet[]; language: string; onOpenCompliance: () => void }) {
  return <><DashboardPanel stats={stats} onboardingChecklist={onboardingChecklist} /><DashboardComplianceProgress sheets={sheets} language={language} onOpenCompliance={onOpenCompliance} /></>;
}

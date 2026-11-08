import type { ReactNode } from "react";
import { DashboardPanel, type DashboardStats } from "../../../templates/DashboardPanel";
import type { Boat, LogSheet } from "../../../models/logbook";
import { DashboardComplianceProgress } from "../compliance/DashboardComplianceProgress";

export function DashboardPage({ stats, onboardingChecklist, sheets, boats = [], language, onOpenCompliance }: { stats: DashboardStats; onboardingChecklist?: ReactNode; sheets: readonly LogSheet[]; boats?: readonly Boat[]; language: string; onOpenCompliance: () => void }) {
  return <><DashboardPanel stats={stats} onboardingChecklist={onboardingChecklist} /><DashboardComplianceProgress sheets={sheets} boats={boats} language={language} onOpenCompliance={onOpenCompliance} /></>;
}

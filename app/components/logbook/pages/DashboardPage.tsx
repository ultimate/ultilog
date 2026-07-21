import type { ReactNode } from "react";
import { DashboardPanel, type DashboardStats } from "../../../templates/DashboardPanel";

export function DashboardPage({ stats, onboardingChecklist }: { stats: DashboardStats; onboardingChecklist?: ReactNode }) {
  return <DashboardPanel stats={stats} onboardingChecklist={onboardingChecklist} />;
}

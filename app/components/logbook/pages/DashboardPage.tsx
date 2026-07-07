import type { ReactNode } from "react";
import { DashboardPanel } from "../../../templates/DashboardPanel";

type DashboardStats = {
  totalNm: number;
  sailNm: number;
  motorNm: number;
  sheets: number;
  boats: number;
};

export function DashboardPage({ stats, onboardingChecklist }: { stats: DashboardStats; onboardingChecklist?: ReactNode }) {
  return <DashboardPanel stats={stats} onboardingChecklist={onboardingChecklist} />;
}

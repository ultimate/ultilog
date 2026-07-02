import { DashboardPanel } from "../../../templates/DashboardPanel";

type DashboardStats = {
  totalNm: number;
  sailNm: number;
  motorNm: number;
  sheets: number;
  boats: number;
};

export function DashboardPage({ stats }: { stats: DashboardStats }) {
  return <DashboardPanel stats={stats} />;
}

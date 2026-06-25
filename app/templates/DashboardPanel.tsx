type DashboardStats = {
  totalNm: number;
  sailNm: number;
  motorNm: number;
  sheets: number;
  boats: number;
};

type DashboardPanelProps = {
  stats: DashboardStats;
};

export function DashboardPanel({ stats }: DashboardPanelProps) {
  return (
    <section className="hero-panel">
      <div>
        <p className="eyebrow">Personal skipper logbook</p>
        <h1>Track ICC / Hochseeausweis miles across boats, crews, and passages.</h1>
        <p className="hero-text">Local-first draft: boats, sheets, and log lines now save in this browser&apos;s local storage until we add a database.</p>
      </div>
      <div className="stat-grid" aria-label="Personal log statistics">
        <article><span>Total miles</span><strong>{stats.totalNm} nm</strong></article>
        <article><span>Sail</span><strong>{stats.sailNm} nm</strong></article>
        <article><span>Motor</span><strong>{stats.motorNm} nm</strong></article>
        <article><span>Boats / sheets</span><strong>{stats.boats} / {stats.sheets}</strong></article>
      </div>
    </section>
  );
}

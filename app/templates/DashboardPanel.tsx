type DashboardStats = { totalNm: number; sailNm: number; motorNm: number; sheets: number; boats: number; };
type DashboardPanelProps = { stats: DashboardStats; };

export function DashboardPanel({ stats }: DashboardPanelProps) {
  const total = Math.max(stats.totalNm, 1);
  const sailPct = Math.round((stats.sailNm / total) * 100);
  const motorPct = Math.max(0, 100 - sailPct);
  return (
    <section className="dashboard-page">
      <div className="page-heading"><div><h1>Dashboard</h1><p>Overview of your sailing experience and progress</p></div><span className="sync-pill">● All synced</span></div>
      <div className="stat-grid" aria-label="Personal log statistics">
        <article><i>⛵</i><span>Total miles</span><strong>{stats.totalNm.toLocaleString()} nm</strong><small>All time</small></article>
        <article><i>△</i><span>Sail miles</span><strong>{stats.sailNm.toLocaleString()} nm</strong><small>{sailPct}% of total</small></article>
        <article><i>✚</i><span>Motor miles</span><strong>{stats.motorNm.toLocaleString()} nm</strong><small>{motorPct}% of total</small></article>
        <article><i>⚓</i><span>Boats</span><strong>{stats.boats}</strong><small>Active vessels</small></article>
        <article><i>♙</i><span>Crew</span><strong>12</strong><small>People sailed with</small></article>
      </div>
      <div className="dashboard-grid">
        <article className="chart-card"><h3>Mileage over time</h3><div className="chart-legend"><span>Sail miles</span><span>Motor miles</span></div><div className="line-chart" aria-hidden="true"><svg viewBox="0 0 600 220" role="img"><path className="grid-line" d="M0 40H600M0 90H600M0 140H600M0 190H600"/><path className="sail-line" d="M20 182 C90 165 110 142 170 126 S260 98 320 88 390 72 450 52 510 34 580 25"/><path className="motor-line" d="M20 204 C90 192 118 172 180 174 S270 155 330 140 400 133 460 120 530 114 580 108"/></svg></div></article>
        <article className="compliance-summary"><h3>Compliance progress</h3><small>ICC / Hochseeausweis</small><div className="progress-layout"><div className="progress-ring"><strong>72%</strong><span>Complete</span></div><dl><div><dt>Required total</dt><dd>3,000 nm</dd></div><div><dt>You have</dt><dd>2,173 nm</dd></div><div><dt>Remaining</dt><dd>827 nm</dd></div></dl></div><a>View compliance details →</a></article>
      </div>
    </section>
  );
}

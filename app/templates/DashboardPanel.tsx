"use client";

import { useI18n } from "../lib/i18n";

type DashboardStats = { totalNm: number; sailNm: number; motorNm: number; sheets: number; boats: number; };
type DashboardPanelProps = { stats: DashboardStats; };

export function DashboardPanel({ stats }: DashboardPanelProps) {
  const { t } = useI18n();
  const total = Math.max(stats.totalNm, 1);
  const sailPct = Math.round((stats.sailNm / total) * 100);
  const motorPct = Math.max(0, 100 - sailPct);

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.subtitle")}</p>
        </div>
        <span className="sync-pill">● {t("dashboard.allSynced")}</span>
      </div>
      <div className="stat-grid" aria-label={t("dashboard.personalStats")}>
        <article><i>⛵</i><span>{t("dashboard.totalMiles")}</span><strong>{stats.totalNm.toLocaleString()} nm</strong><small>{t("dashboard.allTime")}</small></article>
        <article><i>△</i><span>{t("dashboard.sailMiles")}</span><strong>{stats.sailNm.toLocaleString()} nm</strong><small>{sailPct}% {t("dashboard.ofTotal")}</small></article>
        <article><i>✚</i><span>{t("dashboard.motorMiles")}</span><strong>{stats.motorNm.toLocaleString()} nm</strong><small>{motorPct}% {t("dashboard.ofTotal")}</small></article>
        <article><i>⚓</i><span>{t("dashboard.boats")}</span><strong>{stats.boats}</strong><small>{t("dashboard.activeVessels")}</small></article>
        <article><i>♙</i><span>{t("dashboard.crew")}</span><strong>12</strong><small>{t("dashboard.peopleSailedWith")}</small></article>
      </div>
      <div className="dashboard-grid">
        <article className="chart-card">
          <h3>{t("dashboard.mileageOverTime")}</h3>
          <div className="chart-legend"><span>{t("dashboard.sailMiles")}</span><span>{t("dashboard.motorMiles")}</span></div>
          <div className="line-chart" aria-hidden="true"><svg viewBox="0 0 600 220" role="img"><path className="grid-line" d="M0 40H600M0 90H600M0 140H600M0 190H600"/><path className="sail-line" d="M20 182 C90 165 110 142 170 126 S260 98 320 88 390 72 450 52 510 34 580 25"/><path className="motor-line" d="M20 204 C90 192 118 172 180 174 S270 155 330 140 400 133 460 120 530 114 580 108"/></svg></div>
        </article>
        <article className="compliance-summary">
          <h3>{t("dashboard.complianceProgress")}</h3>
          <small>{t("dashboard.complianceLicense")}</small>
          <div className="progress-layout">
            <div className="progress-ring"><strong>72%</strong><span>{t("dashboard.complete")}</span></div>
            <dl>
              <div><dt>{t("dashboard.requiredTotal")}</dt><dd>3,000 nm</dd></div>
              <div><dt>{t("dashboard.youHave")}</dt><dd>2,173 nm</dd></div>
              <div><dt>{t("dashboard.remaining")}</dt><dd>827 nm</dd></div>
            </dl>
          </div>
          <a>{t("dashboard.viewComplianceDetails")} →</a>
        </article>
      </div>
    </section>
  );
}

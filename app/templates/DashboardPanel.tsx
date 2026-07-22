"use client";

import type React from "react";
import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";

export type DashboardStats = { totalNm: number; sailNm: number; motorNm: number; durationMinutes: number; motionDurationMinutes: number; motorHours: number; sheets: number; boats: number; timeline: { label: string; totalNm: number; sailNm: number; motorNm: number }[]; boatDistribution: { boatName: string; totalNm: number }[]; };
type DashboardPanelProps = { stats: DashboardStats; onboardingChecklist?: ReactNode; };

export function DashboardPanel({ stats, onboardingChecklist }: DashboardPanelProps) {
  const { t } = useI18n();
  const total = Math.max(stats.totalNm, 1);
  const sailPct = Math.round((stats.sailNm / total) * 100);
  const motorPct = Math.max(0, 100 - sailPct);
  const maxTimelineNm = Math.max(1, ...stats.timeline.map((item) => item.totalNm));
  const timelinePoints = stats.timeline.length > 1 ? stats.timeline.map((item, index) => `${20 + (index / (stats.timeline.length - 1)) * 560},${200 - (item.totalNm / maxTimelineNm) * 170}`).join(" ") : "20,200 580,200";
  const totalBoatNm = Math.max(1, stats.boatDistribution.reduce((sum, item) => sum + item.totalNm, 0));
  const boatPieSegments = stats.boatDistribution.reduce<{ boatName: string; totalNm: number; percent: number; offset: number; color: string }[]>((segments, item, index) => {
    const percent = (item.totalNm / totalBoatNm) * 100;
    const previousOffset = segments.at(-1)?.offset ?? 25;
    const previousPercent = segments.at(-1)?.percent ?? 0;
    return [...segments, { ...item, percent, offset: previousOffset - previousPercent, color: pieColors[index % pieColors.length] }];
  }, []);

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.subtitle")}</p>
        </div>
        <span className="sync-pill">● {t("dashboard.allSynced")}</span>
      </div>
      {onboardingChecklist}
      <div className="stat-grid" aria-label={t("dashboard.personalStats")}>
        <article><i>⛵</i><span>{t("dashboard.totalMiles")}</span><strong>{stats.totalNm.toLocaleString()} nm</strong><small>{t("dashboard.allTime")}</small></article>
        <article><i>△</i><span>{t("dashboard.sailMiles")}</span><strong>{stats.sailNm.toLocaleString()} nm</strong><small>{sailPct}% {t("dashboard.ofTotal")}</small></article>
        <article><i>✚</i><span>{t("dashboard.motorMiles")}</span><strong>{stats.motorNm.toLocaleString()} nm</strong><small>{motorPct}% {t("dashboard.ofTotal")}</small></article>
        <article><i>⏱</i><span>{t("dashboard.overallDuration")}</span><strong>{formatDuration(stats.durationMinutes)}</strong><small>{t("dashboard.allTime")}</small></article>
        <article><i>↬</i><span>{t("dashboard.motionDuration")}</span><strong>{formatDuration(stats.motionDurationMinutes)}</strong><small>{t("dashboard.inMotion")}</small></article>
        <article><i>⚙</i><span>{t("dashboard.motorHours")}</span><strong>{stats.motorHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}h</strong><small>{t("dashboard.allTime")}</small></article>
        <article><i>⚓</i><span>{t("dashboard.boats")}</span><strong>{stats.boats}</strong><small>{t("dashboard.activeVessels")}</small></article>
      </div>
      <div className="dashboard-grid">
        <article className="chart-card">
          <h3>{t("dashboard.mileageOverTime")}</h3>
          <div className="chart-legend"><span>{t("dashboard.totalMiles")}</span></div>
          <div className="line-chart" aria-hidden="true"><svg viewBox="0 0 600 220" role="img"><path className="grid-line" d="M0 40H600M0 90H600M0 140H600M0 190H600"/><polyline className="sail-line" points={timelinePoints}/></svg></div>
        </article>
        <article className="compliance-summary">
          <h3>{t("dashboard.distribution")}</h3>
          <div className="dashboard-pies">
            <div className="dashboard-pie" style={{ "--first": `${sailPct}%` } as React.CSSProperties}><strong>{sailPct}%</strong><span>{t("dashboard.sailMiles")}</span></div>
            <div className="dashboard-boat-pie" aria-hidden="true"><svg viewBox="0 0 180 180">{boatPieSegments.map((item) => <circle key={item.boatName} cx="90" cy="90" r="70" pathLength="100" style={{ stroke: item.color, strokeDasharray: `${item.percent} ${100 - item.percent}`, strokeDashoffset: item.offset }} />)}</svg></div>
            <dl>{boatPieSegments.map((item) => <div key={item.boatName}><dt><span style={{ background: item.color }} />{item.boatName}</dt><dd>{Math.round(item.percent)}% · {item.totalNm.toLocaleString()} nm</dd></div>)}</dl>
          </div>
        </article>
      </div>
    </section>
  );
}

function formatDuration(minutes: number) {
  const hours = Math.floor(Math.max(0, minutes) / 60);
  return `${hours.toLocaleString()}h`;
}

const pieColors = ["var(--blue)", "#58b7ff", "#7cc6a4", "#f2b84b", "#d987ff", "#ff8c8c"];

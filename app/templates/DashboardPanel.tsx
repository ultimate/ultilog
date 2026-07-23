"use client";

import type React from "react";
import { useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";

type TimelinePoint = { label: string; totalNm: number; sailNm: number; motorNm: number; overallMinutes: number; motionMinutes: number; motorMinutes: number };
export type DashboardStats = { totalNm: number; sailNm: number; motorNm: number; durationMinutes: number; motionDurationMinutes: number; motorHours: number; sheets: number; boats: number; timeline: TimelinePoint[]; boatDistribution: { boatName: string; totalNm: number }[]; };
type DashboardPanelProps = { stats: DashboardStats; onboardingChecklist?: ReactNode; };
type MilesSeries = "sail" | "motor" | "total" | "monthlySail" | "monthlyMotor";
type HoursSeries = "overall" | "motion" | "motor" | "monthlyOverall" | "monthlyMotion" | "monthlyMotor";

export function DashboardPanel({ stats, onboardingChecklist }: DashboardPanelProps) {
  const { t } = useI18n();
  const [visibleMiles, setVisibleMiles] = useState<Record<MilesSeries, boolean>>({ sail: true, motor: true, total: true, monthlySail: true, monthlyMotor: true });
  const [visibleHours, setVisibleHours] = useState<Record<HoursSeries, boolean>>({ overall: true, motion: true, motor: true, monthlyOverall: true, monthlyMotion: true, monthlyMotor: true });
  const total = Math.max(stats.totalNm, 1);
  const sailPct = Math.round((stats.sailNm / total) * 100);
  const motorPct = Math.max(0, 100 - sailPct);
  const monthlyTimeline = useMemo(() => buildMonthlyTimeline(stats.timeline), [stats.timeline]);
  const milesChart = buildMilesChart(monthlyTimeline);
  const hoursChart = buildHoursChart(monthlyTimeline);
  const totalBoatNm = Math.max(1, stats.boatDistribution.reduce((sum, item) => sum + item.totalNm, 0));
  const boatPieSegments = stats.boatDistribution.reduce<{ boatName: string; totalNm: number; percent: number; offset: number; color: string }[]>((segments, item, index) => {
    const percent = (item.totalNm / totalBoatNm) * 100;
    const previousOffset = segments.at(-1)?.offset ?? 25;
    const previousPercent = segments.at(-1)?.percent ?? 0;
    return [...segments, { ...item, percent, offset: previousOffset - previousPercent, color: pieColors[index % pieColors.length] }];
  }, []);

  function toggleMiles(series: MilesSeries) {
    setVisibleMiles((current) => ({ ...current, [series]: !current[series] }));
  }

  function toggleHours(series: HoursSeries) {
    setVisibleHours((current) => ({ ...current, [series]: !current[series] }));
  }

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
        <article><i>⚙</i><span>{t("dashboard.motorHours")}</span><strong>{formatDuration(stats.motorHours * 60)}</strong><small>{t("dashboard.allTime")}</small></article>
        <article><i>⚓</i><span>{t("dashboard.boats")}</span><strong>{stats.boats}</strong><small>{t("dashboard.activeVessels")}</small></article>
      </div>
      <div className="dashboard-grid dashboard-grid--charts">
        <article className="chart-card dashboard-chart-card">
          <h3>{t("dashboard.mileageOverTime")}</h3>
          <ChartLegend items={[
            { key: "sail", label: t("dashboard.cumulativeSailMiles"), color: "#7cc6a4", checked: visibleMiles.sail, onToggle: () => toggleMiles("sail") },
            { key: "motor", label: t("dashboard.cumulativeMotorMiles"), color: "#58b7ff", checked: visibleMiles.motor, onToggle: () => toggleMiles("motor") },
            { key: "total", label: t("dashboard.cumulativeTotalMiles"), color: "var(--blue)", checked: visibleMiles.total, onToggle: () => toggleMiles("total") },
            { key: "monthlySail", label: t("dashboard.monthlySailMiles"), color: "#a5d8bd", checked: visibleMiles.monthlySail, onToggle: () => toggleMiles("monthlySail") },
            { key: "monthlyMotor", label: t("dashboard.monthlyMotorMiles"), color: "#9fd4ff", checked: visibleMiles.monthlyMotor, onToggle: () => toggleMiles("monthlyMotor") },
          ]} />
          <div className="line-chart dashboard-combo-chart" aria-hidden="true"><svg viewBox="0 0 640 260" role="img"><ChartGrid />{visibleMiles.sail && <polygon className="chart-area-sail" points={milesChart.sailArea} />}{visibleMiles.motor && <polygon className="chart-area-motor" points={milesChart.motorArea} />}{visibleMiles.monthlySail && milesChart.bars.map((bar) => <rect key={`${bar.label}-sail`} className="chart-bar-sail" x={bar.x - 9} y={bar.sailY} width="8" height={bar.sailHeight} />)}{visibleMiles.monthlyMotor && milesChart.bars.map((bar) => <rect key={`${bar.label}-motor`} className="chart-bar-motor" x={bar.x + 1} y={bar.motorY} width="8" height={bar.motorHeight} />)}{visibleMiles.total && <polyline className="chart-line-total" points={milesChart.totalLine} />}</svg></div>
        </article>
        <article className="chart-card dashboard-chart-card">
          <h3>{t("dashboard.hoursOverTime")}</h3>
          <ChartLegend items={[
            { key: "overall", label: t("dashboard.cumulativeOverallHours"), color: "var(--blue)", checked: visibleHours.overall, onToggle: () => toggleHours("overall") },
            { key: "motion", label: t("dashboard.cumulativeMotionHours"), color: "#7cc6a4", checked: visibleHours.motion, onToggle: () => toggleHours("motion") },
            { key: "motor", label: t("dashboard.cumulativeMotorHours"), color: "#58b7ff", checked: visibleHours.motor, onToggle: () => toggleHours("motor") },
            { key: "monthlyOverall", label: t("dashboard.monthlyOverallHours"), color: "#8fb8ff", checked: visibleHours.monthlyOverall, onToggle: () => toggleHours("monthlyOverall") },
            { key: "monthlyMotion", label: t("dashboard.monthlyMotionHours"), color: "#a5d8bd", checked: visibleHours.monthlyMotion, onToggle: () => toggleHours("monthlyMotion") },
            { key: "monthlyMotor", label: t("dashboard.monthlyMotorHours"), color: "#9fd4ff", checked: visibleHours.monthlyMotor, onToggle: () => toggleHours("monthlyMotor") },
          ]} />
          <div className="line-chart dashboard-combo-chart" aria-hidden="true"><svg viewBox="0 0 640 260" role="img"><ChartGrid />{visibleHours.monthlyOverall && hoursChart.bars.map((bar) => <rect key={`${bar.label}-overall`} className="chart-bar-overall" x={bar.x - 14} y={bar.overallY} width="8" height={bar.overallHeight} />)}{visibleHours.monthlyMotion && hoursChart.bars.map((bar) => <rect key={`${bar.label}-motion`} className="chart-bar-sail" x={bar.x - 4} y={bar.motionY} width="8" height={bar.motionHeight} />)}{visibleHours.monthlyMotor && hoursChart.bars.map((bar) => <rect key={`${bar.label}-motor`} className="chart-bar-motor" x={bar.x + 6} y={bar.motorY} width="8" height={bar.motorHeight} />)}{visibleHours.overall && <polyline className="chart-line-total" points={hoursChart.overallLine} />}{visibleHours.motion && <polyline className="chart-line-motion" points={hoursChart.motionLine} />}{visibleHours.motor && <polyline className="chart-line-motor" points={hoursChart.motorLine} />}</svg></div>
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

function ChartLegend({ items }: { items: { key: string; label: string; color: string; checked: boolean; onToggle: () => void }[] }) {
  return <div className="chart-toggle-legend">{items.map((item) => <label key={item.key}><input type="checkbox" checked={item.checked} onChange={item.onToggle} /><span style={{ background: item.color }} />{item.label}</label>)}</div>;
}

function ChartGrid() {
  return <path className="grid-line" d="M40 30H620M40 80H620M40 130H620M40 180H620M40 230H620" />;
}

function buildMonthlyTimeline(points: TimelinePoint[]) {
  const months = new Map<string, TimelinePoint>();
  for (const point of points) {
    const current = months.get(point.label) ?? { label: point.label, totalNm: 0, sailNm: 0, motorNm: 0, overallMinutes: 0, motionMinutes: 0, motorMinutes: 0 };
    months.set(point.label, { label: point.label, totalNm: current.totalNm + point.totalNm, sailNm: current.sailNm + point.sailNm, motorNm: current.motorNm + point.motorNm, overallMinutes: current.overallMinutes + point.overallMinutes, motionMinutes: current.motionMinutes + point.motionMinutes, motorMinutes: current.motorMinutes + point.motorMinutes });
  }
  return [...months.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function buildMilesChart(points: TimelinePoint[]) {
  let cumulativeSail = 0;
  let cumulativeMotor = 0;
  const cumulative = points.map((point) => {
    cumulativeSail += point.sailNm;
    cumulativeMotor += point.motorNm;
    return { ...point, cumulativeSail, cumulativeMotor, cumulativeTotal: cumulativeSail + cumulativeMotor };
  });
  const maxValue = Math.max(1, ...cumulative.map((point) => point.cumulativeTotal), ...points.map((point) => point.totalNm));
  const coordinates = cumulative.map((point, index) => ({ ...chartPosition(index, Math.max(cumulative.length, 1)), sailY: chartY(point.cumulativeSail, maxValue), totalY: chartY(point.cumulativeTotal, maxValue) }));
  return {
    sailArea: areaPoints(coordinates.map((point) => ({ x: point.x, y: point.sailY }))),
    motorArea: areaPoints(coordinates.map((point) => ({ x: point.x, y: point.totalY }))),
    totalLine: coordinates.map((point) => `${point.x},${point.totalY}`).join(" "),
    bars: points.map((point, index) => monthlyBar(index, points.length, point.sailNm, point.motorNm, maxValue)),
  };
}

function buildHoursChart(points: TimelinePoint[]) {
  let cumulativeOverall = 0;
  let cumulativeMotion = 0;
  let cumulativeMotor = 0;
  const cumulative = points.map((point) => {
    cumulativeOverall += point.overallMinutes / 60;
    cumulativeMotion += point.motionMinutes / 60;
    cumulativeMotor += point.motorMinutes / 60;
    return { ...point, cumulativeOverall, cumulativeMotion, cumulativeMotor };
  });
  const monthlyValues = points.flatMap((point) => [point.overallMinutes / 60, point.motionMinutes / 60, point.motorMinutes / 60]);
  const maxValue = Math.max(1, ...cumulative.flatMap((point) => [point.cumulativeOverall, point.cumulativeMotion, point.cumulativeMotor]), ...monthlyValues);
  const coordinates = cumulative.map((point, index) => ({ ...chartPosition(index, Math.max(cumulative.length, 1)), overallY: chartY(point.cumulativeOverall, maxValue), motionY: chartY(point.cumulativeMotion, maxValue), motorY: chartY(point.cumulativeMotor, maxValue) }));
  return {
    overallLine: coordinates.map((point) => `${point.x},${point.overallY}`).join(" "),
    motionLine: coordinates.map((point) => `${point.x},${point.motionY}`).join(" "),
    motorLine: coordinates.map((point) => `${point.x},${point.motorY}`).join(" "),
    bars: points.map((point, index) => monthlyHoursBar(index, points.length, point, maxValue)),
  };
}

function chartPosition(index: number, count: number) {
  return { x: count <= 1 ? 40 : 40 + (index / (count - 1)) * 580 };
}

function chartY(value: number, maxValue: number) {
  return 230 - (Math.max(0, value) / maxValue) * 200;
}

function areaPoints(points: { x: number; y: number }[]) {
  if (!points.length) return "40,230 620,230";
  return `40,230 ${points.map((point) => `${point.x},${point.y}`).join(" ")} ${points.at(-1)?.x ?? 620},230`;
}

function monthlyBar(index: number, count: number, sail: number, motor: number, maxValue: number) {
  const { x } = chartPosition(index, Math.max(count, 1));
  const sailHeight = (sail / maxValue) * 200;
  const motorHeight = (motor / maxValue) * 200;
  return { label: String(index), x, sailY: 230 - sailHeight, sailHeight, motorY: 230 - motorHeight, motorHeight };
}

function monthlyHoursBar(index: number, count: number, point: TimelinePoint, maxValue: number) {
  const { x } = chartPosition(index, Math.max(count, 1));
  const overallHeight = (point.overallMinutes / 60 / maxValue) * 200;
  const motionHeight = (point.motionMinutes / 60 / maxValue) * 200;
  const motorHeight = (point.motorMinutes / 60 / maxValue) * 200;
  return { label: String(index), x, overallY: 230 - overallHeight, overallHeight, motionY: 230 - motionHeight, motionHeight, motorY: 230 - motorHeight, motorHeight };
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours.toLocaleString()}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

const pieColors = ["var(--blue)", "#58b7ff", "#7cc6a4", "#f2b84b", "#d987ff", "#ff8c8c"];

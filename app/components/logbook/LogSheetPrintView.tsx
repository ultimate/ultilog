import type { Boat, LogLine, LogSheet } from "../../models/logbook";
import { useI18n } from "../../lib/i18n";
import { paginatePrintLogLines, PRINT_LOG_ROWS_PER_PAGE } from "./print-pagination";
import type { LogSheetMetrics } from "../../domain/logbook/sheet-metrics";
import { calculateLogSheetMetrics, formatLogSheetDuration } from "../../domain/logbook/sheet-metrics";

export type LogSheetPrintSummary = LogSheetMetrics | {
  motorMiles: number;
  sailMiles: number;
  totalMiles: number;
  duration?: string;
  durationMinutes?: number | null;
};

export type LogSheetPrintViewProps =
  | {
      mode: "filled";
      sheet: LogSheet;
      boat?: Boat;
      summary?: LogSheetPrintSummary;
      linesPerPage?: number;
      showCourseColumns?: boolean;
    }
  | {
      mode: "empty";
      sheet?: LogSheet;
      boat?: Boat;
      summary?: LogSheetPrintSummary;
      linesPerPage?: number;
      showCourseColumns?: boolean;
    };


export function LogSheetPrintView(props: LogSheetPrintViewProps) {
  const { t } = useI18n();
  const showCourseColumns = props.showCourseColumns ?? true;
  const linesPerPage = Math.max(1, props.linesPerPage ?? PRINT_LOG_ROWS_PER_PAGE);
  const sheet = props.sheet;
  const sourceLines = props.mode === "filled" ? props.sheet.lines : [];
  const pages = paginatePrintLogLines(sourceLines, linesPerPage);
  const summary = getSummary(props.summary, sheet);

  return (
    <div className="log-sheet-print-view" aria-label={props.mode === "filled" ? `Printable log sheet ${props.sheet.title}` : "Blank printable log sheet"}>
      <p className="print-layout-hint screen-only no-print">{t("print.a4LandscapeHint")}</p>
      <style>{printStyles}</style>
      {pages.map((page) => (
        <section className="log-sheet-print-page print-page" key={page.pageIndex} aria-label={`Log sheet print page ${page.pageIndex + 1} of ${page.pageCount}`}>
          <header className="print-header">
            <div className="print-title-block">
              <p className="print-kicker">{props.mode === "filled" ? t("print.filledSheet") : t("print.emptySheet")}</p>
              <h1>{valueOrBlank(sheet?.title, t("print.emptySheet"))}</h1>
              <div className="print-master-grid">
                <PrintField label="Date" value={sheet?.dateRange} />
                <PrintField label="From dt" value={sheet?.route.departed} />
                <PrintField label="From" value={sheet?.route.from} />
                <PrintField label="To dt" value={sheet?.route.arrived} />
                <PrintField label="To" value={sheet?.route.to} />
                <PrintField label="Skipper" value={formatSkipper(sheet)} />
              </div>
            </div>
            <aside className="print-boat" aria-label="Boat">
              <PrintField label="Boat" value={props.boat?.name} />
              <PrintField label="Type" value={props.boat?.type} />
              <PrintField label="Reg" value={props.boat?.registration} />
              <PrintField label="Flag" value={props.boat?.flagState} />
              <PrintField label="Home" value={props.boat?.homePort} />
            </aside>
            <aside className="print-summary" aria-label="Summary">
              <PrintField label="Total" value={formatNumber(summary.totalMiles, " nm")} />
              <PrintField label="Sail" value={formatNumber(summary.sailMiles, " nm")} />
              <PrintField label="Motor" value={formatNumber(summary.motorMiles, " nm")} />
              <PrintField label="Dur" value={summary.duration} />
            </aside>
          </header>

          <table className={showCourseColumns ? "print-log-table print-loglines with-course-columns" : "print-log-table print-loglines compact-course"}>
            <colgroup>
              <col className="print-col-time" />
              <col className="print-col-position" />
              <col className="print-col-weather" />
              <col className="print-col-temp" />
              <col className="print-col-baro" />
              <col className="print-col-wind" />
              <col className="print-col-sea" />
              <col className="print-col-tide" />
              <col className="print-col-course" />
              {showCourseColumns ? (
                <>
                  <col className="print-col-course" />
                  <col className="print-col-course" />
                  <col className="print-col-course" />
                  <col className="print-col-course" />
                  <col className="print-col-course" />
                </>
              ) : null}
              <col className="print-col-course" />
              <col className="print-col-speed" />
              <col className="print-col-log" />
              <col className="print-col-sail" />
              <col className="print-col-motor" />
              <col className="print-col-remarks" />
            </colgroup>
            <thead>
              <tr>
                <th>Time</th>
                <th>Pos.</th>
                <th>Wx</th>
                <th>Temp</th>
                <th>Baro</th>
                <th>Wind</th>
                <th>Sea</th>
                <th>Tide</th>
                <th>CC</th>
                {showCourseColumns ? (
                  <>
                    <th>Dev</th>
                    <th>MC</th>
                    <th>Var</th>
                    <th>TC</th>
                    <th>CTW</th>
                  </>
                ) : null}
                <th>COG</th>
                <th>Spd</th>
                <th>Log</th>
                <th>Sail</th>
                <th>Mot</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {page.lines.map((line, index) => renderLogRow(line, index, showCourseColumns))}
            </tbody>
          </table>

          <footer className="print-footer">
            <section className="print-crew-box"><h2>{t("crew.list")}</h2>{renderCrew(sheet)}</section>
            <section className="print-tech-box"><h2>Tech log</h2>{renderList(sheet?.technicalChecks, t("print.truncated"))}</section>
            <section className="print-route-box"><h2>Route / map</h2></section>
            <section className="print-remarks-box"><h2>Remarks / signature</h2>{hasTruncatedRemark(page.lines) ? <small>{t("print.truncated")}</small> : null}</section>
            <span className="print-page-number">{formatPageOf(t("print.pageOf"), page.pageIndex + 1, page.pageCount)}</span>
          </footer>
        </section>
      ))}
    </div>
  );
}

function getSummary(summary: LogSheetPrintSummary | undefined, sheet: LogSheet | undefined) {
  const metrics = summary ?? (sheet ? sheet.metrics ?? calculateLogSheetMetrics(sheet.lines) : undefined);
  const duration = metrics && "duration" in metrics && metrics.duration ? metrics.duration : formatLogSheetDuration(metrics?.durationMinutes);
  return {
    motorMiles: metrics?.motorMiles ?? 0,
    sailMiles: metrics?.sailMiles ?? 0,
    totalMiles: metrics?.totalMiles ?? 0,
    duration,
  };
}

function renderLogRow(line: LogLine | undefined, index: number, showCourseColumns: boolean) {
  return (
    <tr key={index}>
      <td>{line?.time}</td>
      <td>{line?.position || formatLatLon(line)}</td>
      <td>{joinValues(line?.weather, line?.weatherRemark)}</td>
      <td>{formatNumber(line?.temperature, line?.temperatureUnit)}</td>
      <td>{formatNumber(line?.barometer)}</td>
      <td>{joinValues(line?.windDirection, formatNumber(line?.windStrength, line?.windUnit))}</td>
      <td>{formatNumber(line?.waves, line?.seaUnit)}</td>
      <td>{formatNumber(line?.tide, line?.tideUnit)}</td>
      <td>{formatDegrees(line?.compassCourse)}</td>
      {showCourseColumns ? (
        <>
          <td>{formatSigned(line?.deviation)}</td>
          <td>{formatDegrees(line?.magneticCourse)}</td>
          <td>{formatSigned(line?.variation)}</td>
          <td>{formatDegrees(line?.trueCourse)}</td>
          <td>{formatDegrees(line?.courseThroughWater)}</td>
        </>
      ) : null}
      <td>{formatDegrees(line?.courseOverGround)}</td>
      <td>{formatNumber(line?.speedKn)}</td>
      <td>{formatNumber(line?.logNm)}</td>
      <td>{formatNumber(line?.sailMiles)}</td>
      <td>{formatMotor(line)}</td>
      <td className="print-remarks-cell"><span className={remarkSizeClass(line?.remarks ?? "")}>{line?.remarks}</span></td>
    </tr>
  );
}

function hasTruncatedRemark(lines: Array<LogLine | undefined>) {
  return lines.some((line) => (line?.remarks.length ?? 0) > 70);
}

function remarkSizeClass(remark: string) {
  if (remark.length > 120) return "print-remark-text print-remark-tiny";
  if (remark.length > 70) return "print-remark-text print-remark-small";
  return "print-remark-text";
}

function PrintField({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="print-field"><span>{label}</span><strong>{valueOrBlank(value)}</strong></div>;
}

function renderList(items: string[] | undefined, truncatedLabel: string) {
  if (!items?.length) return <div className="print-writing-lines" aria-hidden="true" />;
  const visibleItems = items.slice(0, 5);
  return <ul>{visibleItems.map((item) => <li key={item}>{item}</li>)}{items.length > visibleItems.length ? <li>{truncatedLabel}</li> : null}</ul>;
}

function renderCrew(sheet: LogSheet | undefined) {
  if (!sheet?.crew.length) return <div className="print-writing-lines" aria-hidden="true" />;
  return <ul>{sheet.crew.slice(0, 5).map((member, index) => <li key={`${member.id}-${index}`}>{index + 1}. {member.name} · {member.role}</li>)}</ul>;
}

function formatPageOf(template: string, page: number, pageCount: number) {
  return template.replace("{page}", String(page)).replace("{pageCount}", String(pageCount));
}

function formatCrew(sheet: LogSheet | undefined) {
  if (!sheet?.crew.length) return undefined;
  return sheet.crew.map((member) => member.name).filter(Boolean).join(", ");
}

function formatSkipper(sheet: LogSheet | undefined) {
  return sheet?.crew.find((member) => member.role.toLowerCase().includes("skipper"))?.name;
}

function formatLatLon(line: LogLine | undefined) {
  if (!line) return undefined;
  return `${formatNumber(line.latitude)} / ${formatNumber(line.longitude)}`;
}

function formatMotor(line: LogLine | undefined) {
  return joinValues(formatNumber(line?.motorMiles), line?.motorHours ? `${formatNumber(line.motorHours)}h` : undefined);
}

function formatDegrees(value: number | undefined) {
  return value == null ? undefined : `${Math.round(value)}°`;
}

function formatSigned(value: number | undefined) {
  if (value == null) return undefined;
  return `${value > 0 ? "+" : ""}${Math.round(value)}°`;
}

function formatNumber(value: number | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return undefined;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function joinValues(...values: Array<string | number | undefined | null>) {
  return values.filter((value) => value !== undefined && value !== null && value !== "").join(" ") || undefined;
}

function valueOrBlank(value: string | number | undefined | null, fallback = "—") {
  return value === undefined || value === null || value === "" ? fallback : value;
}

const printStyles = `
.log-sheet-print-view { color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; }
.log-sheet-print-page { box-sizing: border-box; display: grid; grid-template-rows: 32mm 1fr 40mm; gap: 2mm; width: 297mm; height: 210mm; padding: 6mm; border: 0.3mm solid #000; page-break-after: always; break-after: page; background: #fff; color: #000; }
.log-sheet-print-page:last-child { page-break-after: auto; break-after: auto; }
.print-header, .print-footer { display: grid; gap: 2mm; }
.print-header { grid-template-columns: 1fr 46mm 46mm; border: 0.25mm solid #000; padding: 1.2mm; }
.print-kicker, .print-field span { margin: 0; font-size: 7pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.print-title-block h1 { margin: 0 0 1mm; font-size: 13pt; line-height: 1.05; }
.print-master-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1mm; }
.print-boat, .print-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1mm; border-left: 0.25mm solid #000; padding-left: 1.2mm; }
.print-field { min-width: 0; border-bottom: 0.2mm solid #000; }
.print-field strong { display: block; min-height: 11pt; overflow: hidden; font-size: 8pt; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.print-log-table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.6pt; line-height: 1.05; }
.print-log-table col.print-col-time { width: 4%; }
.print-log-table col.print-col-position { width: 10%; }
.print-log-table col.print-col-weather, .print-log-table col.print-col-wind { width: 7%; }
.print-log-table col.print-col-temp, .print-log-table col.print-col-baro, .print-log-table col.print-col-tide { width: 3.5%; }
.print-log-table col.print-col-sea { width: 5%; }
.print-log-table col.print-col-course { width: 2.5%; }
.print-log-table col.print-col-speed, .print-log-table col.print-col-log, .print-log-table col.print-col-sail { width: 3%; }
.print-log-table col.print-col-motor { width: 4%; }
.print-log-table col.print-col-remarks { width: 26%; }
.print-log-table.compact-course col.print-col-position { width: 11%; }
.print-log-table.compact-course col.print-col-weather, .print-log-table.compact-course col.print-col-wind { width: 8%; }
.print-log-table.compact-course col.print-col-remarks { width: 38%; }
.print-log-table tr { height: 6mm; max-height: 6mm; }
.print-log-table th, .print-log-table td { box-sizing: border-box; height: 6mm; max-height: 6mm; overflow: hidden; border: 0.2mm solid #000; padding: .55mm; text-align: left; vertical-align: top; background: #fff; color: #000; }
.print-log-table th { font-size: 6.4pt; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
.print-log-table td { white-space: nowrap; text-overflow: ellipsis; }
.print-remarks-cell { white-space: nowrap; }
.print-remark-text { display: block; overflow: hidden; width: 100%; max-height: 5.2mm; font-size: 6.3pt; line-height: 1.05; text-overflow: ellipsis; white-space: nowrap; }
.print-remark-small { font-size: 5.5pt; }
.print-remark-tiny { font-size: 4.8pt; }
.print-footer { position: relative; grid-template-columns: 54mm 58mm 64mm 1fr; }
.print-footer section { border: 0.25mm solid #000; padding: 1.2mm; background: #fff; color: #000; }
.print-footer h2 { margin: 0 0 2mm; font-size: 8pt; text-transform: uppercase; }
.print-route-box { background: #fff; }
.print-crew-box ul, .print-tech-box ul { margin: 0; padding-left: 3.5mm; font-size: 7pt; }
.print-writing-lines { height: 21mm; background: repeating-linear-gradient(to bottom, transparent 0, transparent 7mm, #000 7.2mm); }
.print-page-number { position: absolute; right: 1.5mm; bottom: 1mm; font-size: 7pt; font-weight: 700; }
@media print { body { margin: 0; } @page { size: A4 landscape; size: 297mm 210mm; page-orientation: landscape; margin: 8mm; } .log-sheet-print-view { width: 281mm; min-width: 281mm; max-width: none; } .log-sheet-print-page { width: 281mm; min-width: 281mm; height: 194mm; min-height: 194mm; padding: 0; } }
`;

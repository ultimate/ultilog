import type { Boat, LogLine, LogSheet } from "../../models/logbook";
import { useI18n } from "../../lib/i18n";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import { paginatePrintLogLines, PRINT_LOG_ROWS_PER_PAGE } from "./print-pagination";
import type { LogSheetMetrics } from "../../domain/logbook/sheet-metrics";
import { calculateLogSheetMetrics, formatLogSheetDuration } from "../../domain/logbook/sheet-metrics";
import {
  formatLogSheetPrintTemplateMarker,
  getPrintLogColumns,
  LOG_SHEET_PRINT_TEMPLATE_ID,
  LOG_SHEET_PRINT_TEMPLATE_REVISION,
  type LogSheetPrintVariant,
  type PrintLogColumn,
} from "../../domain/logbook/print-template";

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
  const { locale, t } = useI18n();
  const { formatDate, formatDateTime, formatTime } = useDateTimeFormat();
  const showCourseColumns = props.showCourseColumns ?? true;
  const templateVariant: LogSheetPrintVariant = showCourseColumns ? "full" : "compact";
  const logColumns = getPrintLogColumns(templateVariant);
  const templateMarker = formatLogSheetPrintTemplateMarker(templateVariant, locale);
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
        <section
          className="log-sheet-print-page print-page"
          key={page.pageIndex}
          aria-label={`Log sheet print page ${page.pageIndex + 1} of ${page.pageCount}`}
          data-template-id={LOG_SHEET_PRINT_TEMPLATE_ID}
          data-template-locale={locale}
          data-template-revision={LOG_SHEET_PRINT_TEMPLATE_REVISION}
          data-template-variant={templateVariant}
        >
          <header className="print-header">
            <div className="print-title-block">
              <p className="print-kicker">{props.mode === "filled" ? t("print.filledSheet") : t("print.emptySheet")}</p>
              <h1>{valueOrBlank(sheet?.title, t("print.emptySheet"))}</h1>
              <div className="print-master-grid">
                <PrintField label={t("print.field.date")} value={formatDate(sheet?.dateRange)} />
                <PrintField label={t("print.field.departed")} value={formatDateTime(sheet?.route.departed)} />
                <PrintField label={t("print.field.from")} value={sheet?.route.from} />
                <PrintField label={t("print.field.arrived")} value={formatDateTime(sheet?.route.arrived)} />
                <PrintField label={t("print.field.to")} value={sheet?.route.to} />
                <PrintField label={t("print.field.skipper")} value={formatSkipper(sheet)} />
              </div>
            </div>
            <aside className="print-boat" aria-label="Boat">
              <PrintField label={t("print.field.boat")} value={props.boat?.name} />
              <PrintField label={t("print.field.type")} value={props.boat?.type} />
              <PrintField label={t("print.field.registration")} value={props.boat?.registration} />
              <PrintField label={t("print.field.flag")} value={props.boat?.flagState} />
              <PrintField label={t("print.field.homePort")} value={props.boat?.homePort} />
            </aside>
            <aside className="print-summary" aria-label="Summary">
              <PrintField label={t("print.field.total")} value={formatNumber(summary.totalMiles, " nm")} />
              <PrintField label={t("print.field.sail")} value={formatNumber(summary.sailMiles, " nm")} />
              <PrintField label={t("print.field.motor")} value={formatNumber(summary.motorMiles, " nm")} />
              <PrintField label={t("print.field.duration")} value={summary.duration} />
            </aside>
          </header>

          <table className={showCourseColumns ? "print-log-table print-loglines with-course-columns" : "print-log-table print-loglines compact-course"}>
            <colgroup>
              {logColumns.map((column) => (
                <col className={column.className} key={column.id} style={{ width: `${column.width[templateVariant]}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {logColumns.map((column) => <th key={column.id}>{t(column.headingKey)}</th>)}
              </tr>
            </thead>
            <tbody>
              {page.lines.map((line, index) => renderLogRow(line, index, logColumns, formatTime))}
            </tbody>
          </table>

          <footer className="print-footer">
            <section className="print-crew-box"><h2>{t("crew.list")}</h2>{renderCrew(sheet)}</section>
            <section className="print-tech-box"><h2>{t("print.footer.techLog")}</h2>{renderList(sheet?.technicalChecks, t("print.truncated"))}</section>
            <section className="print-route-box"><h2>{t("print.footer.routeMap")}</h2></section>
            <section className="print-remarks-box"><h2>{t("print.footer.remarksSignature")}</h2>{hasTruncatedRemark(page.lines) ? <small>{t("print.truncated")}</small> : null}</section>
            <span className="print-page-number">{formatPageOf(t("print.pageOf"), page.pageIndex + 1, page.pageCount)}</span>
          </footer>
          <span className="print-template-marker" aria-label="UltiLog print template marker">{templateMarker}</span>
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

function renderLogRow(line: LogLine | undefined, index: number, columns: readonly PrintLogColumn[], formatTime: (value?: string | null) => string) {
  return (
    <tr key={index}>
      {columns.map((column) => renderLogCell(column, line, formatTime))}
    </tr>
  );
}

function renderLogCell(column: PrintLogColumn, line: LogLine | undefined, formatTime: (value?: string | null) => string) {
  const value = (() => {
    switch (column.id) {
      case "time": return formatTime(line?.time);
      case "position": return line?.position || formatLatLon(line);
      case "weather": return joinValues(line?.weather, line?.weatherRemark);
      case "temperature": return formatNumber(line?.temperature, line?.temperatureUnit);
      case "barometer": return formatNumber(line?.barometer);
      case "wind": return joinValues(line?.windDirection, formatNumber(line?.windStrength, line?.windUnit));
      case "waves": return formatNumber(line?.waves, line?.seaUnit);
      case "tide": return formatNumber(line?.tide, line?.tideUnit);
      case "compassCourse": return formatDegrees(line?.compassCourse);
      case "deviation": return formatSigned(line?.deviation);
      case "magneticCourse": return formatDegrees(line?.magneticCourse);
      case "variation": return formatSigned(line?.variation);
      case "trueCourse": return formatDegrees(line?.trueCourse);
      case "windDrift": return formatSigned(line?.windDrift);
      case "courseThroughWater": return formatDegrees(line?.courseThroughWater);
      case "currentDrift": return formatSigned(line?.currentDrift);
      case "courseOverGround": return formatDegrees(line?.courseOverGround);
      case "speedKn": return formatNumber(line?.speedKn);
      case "logNm": return formatNumber(line?.logNm);
      case "sailMiles": return formatNumber(line?.sailMiles);
      case "motor": return formatMotor(line);
      case "remarks": return <span className={remarkSizeClass(line?.remarks ?? "")}>{line?.remarks}</span>;
    }
  })();

  return <td className={column.id === "remarks" ? "print-remarks-cell" : undefined} key={column.id}>{value}</td>;
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
.log-sheet-print-page { position: relative; box-sizing: border-box; display: grid; grid-template-rows: 32mm 1fr 40mm; gap: 2mm; width: 297mm; height: 210mm; padding: 6mm; border: 0.3mm solid #000; page-break-after: always; break-after: page; background: #fff; color: #000; }
.log-sheet-print-page:last-child { page-break-after: auto; break-after: auto; }
.print-header, .print-footer { box-sizing: border-box; display: grid; gap: 2mm; width: 100%; min-width: 0; max-width: 100%; }
.print-header { grid-template-columns: 1fr 46mm 46mm; border: 0.25mm solid #000; padding: 1.2mm; }
.print-kicker, .print-field span { margin: 0; font-size: 7pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.print-title-block h1 { margin: 0 0 1mm; font-size: 13pt; line-height: 1.05; }
.print-master-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1mm; }
.print-boat, .print-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1mm; border-left: 0.25mm solid #000; padding-left: 1.2mm; }
.print-field { min-width: 0; border-bottom: 0.2mm solid #000; }
.print-field strong { display: block; min-height: 11pt; overflow: hidden; font-size: 8pt; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.print-log-table { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.6pt; line-height: 1.05; }
.print-log-table tr { height: 6mm; max-height: 6mm; }
.print-log-table th, .print-log-table td { box-sizing: border-box; height: 6mm; max-height: 6mm; overflow: hidden; border: 0.2mm solid #000; padding: .55mm; text-align: left; vertical-align: top; background: #fff; color: #000; }
.print-log-table th { font-size: 6.4pt; font-weight: 700; text-transform: uppercase; white-space: normal; overflow-wrap: anywhere; }
.print-log-table td { white-space: nowrap; text-overflow: ellipsis; }
.print-remarks-cell { white-space: nowrap; }
.print-remark-text { display: block; overflow: hidden; width: 100%; max-height: 5.2mm; font-size: 6.3pt; line-height: 1.05; text-overflow: ellipsis; white-space: nowrap; }
.print-remark-small { font-size: 5.5pt; }
.print-remark-tiny { font-size: 4.8pt; }
.print-footer { position: relative; grid-template-columns: 54mm 58mm 64mm 1fr; }
.print-footer section { min-width: 0; border: 0.25mm solid #000; padding: 1.2mm; background: #fff; color: #000; }
.print-footer h2 { margin: 0 0 2mm; font-size: 8pt; text-transform: uppercase; }
.print-route-box { background: #fff; }
.print-crew-box ul, .print-tech-box ul { margin: 0; padding-left: 3.5mm; font-size: 7pt; }
.print-writing-lines { height: 21mm; background: repeating-linear-gradient(to bottom, transparent 0, transparent 7mm, #000 7.2mm); }
.print-page-number { position: absolute; right: 1.5mm; bottom: 1mm; font-size: 7pt; font-weight: 700; }
.print-template-marker { position: absolute; left: 1.5mm; bottom: .8mm; font-family: monospace; font-size: 4.5pt; font-weight: 400; letter-spacing: 0; white-space: nowrap; }
@media print { body { margin: 0; } @page { size: A4 landscape; size: 297mm 210mm; page-orientation: landscape; margin: 8mm; } .log-sheet-print-view { width: 281mm; min-width: 281mm; max-width: none; } .log-sheet-print-page { width: 281mm; min-width: 281mm; height: 194mm; min-height: 194mm; padding: 0; } .print-header, .print-footer { width: 281mm; } .print-log-table { width: 281mm !important; min-width: 0 !important; max-width: 281mm !important; } }
`;

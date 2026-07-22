import type { Boat, LogLine, LogSheet } from "../../models/logbook";
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
    }
  | {
      mode: "empty";
      sheet?: LogSheet;
      boat?: Boat;
      summary?: LogSheetPrintSummary;
      linesPerPage?: number;
    };


export function LogSheetPrintView(props: LogSheetPrintViewProps) {
  const linesPerPage = Math.max(1, props.linesPerPage ?? PRINT_LOG_ROWS_PER_PAGE);
  const sheet = props.sheet;
  const sourceLines = props.mode === "filled" ? props.sheet.lines : [];
  const pages = paginatePrintLogLines(sourceLines, linesPerPage);
  const summary = getSummary(props.summary, sheet);

  return (
    <div className="log-sheet-print-view" aria-label={props.mode === "filled" ? `Printable log sheet ${props.sheet.title}` : "Blank printable log sheet"}>
      <style>{printStyles}</style>
      {pages.map((page) => (
        <section className="log-sheet-print-page" key={page.pageIndex} aria-label={`Log sheet print page ${page.pageIndex + 1} of ${page.pageCount}`}>
          <header className="print-header">
            <div className="print-title-block">
              <p className="print-kicker">Log sheet</p>
              <h1>{valueOrBlank(sheet?.title, "Blank passage")}</h1>
              <div className="print-master-grid">
                <PrintField label="Date" value={sheet?.dateRange} />
                <PrintField label="From" value={sheet?.route.from} />
                <PrintField label="To" value={sheet?.route.to} />
                <PrintField label="Dep" value={sheet?.route.departed} />
                <PrintField label="Arr" value={sheet?.route.arrived} />
                <PrintField label="Boat" value={props.boat?.name} />
                <PrintField label="Type" value={props.boat?.type} />
                <PrintField label="Reg" value={props.boat?.registration} />
                <PrintField label="Flag" value={props.boat?.flagState} />
                <PrintField label="Home" value={props.boat?.homePort} />
              </div>
            </div>
            <aside className="print-summary" aria-label="Summary">
              <PrintField label="Total" value={formatNumber(summary.totalMiles, " nm")} />
              <PrintField label="Sail" value={formatNumber(summary.sailMiles, " nm")} />
              <PrintField label="Motor" value={formatNumber(summary.motorMiles, " nm")} />
              <PrintField label="Dur" value={summary.duration} />
              <PrintField label="Crew" value={formatCrew(sheet)} />
              <PrintField label="Skipper" value={formatSkipper(sheet)} />
            </aside>
          </header>

          <table className="print-log-table">
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
              <col className="print-col-course" />
              <col className="print-col-course" />
              <col className="print-col-course" />
              <col className="print-col-course" />
              <col className="print-col-course" />
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
                <th>Dev</th>
                <th>MC</th>
                <th>Var</th>
                <th>TC</th>
                <th>CTW</th>
                <th>COG</th>
                <th>Spd</th>
                <th>Log</th>
                <th>Sail</th>
                <th>Mot</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {page.lines.map((line, index) => renderLogRow(line, index))}
            </tbody>
          </table>

          <footer className="print-footer">
            <section className="print-route-box"><h2>Route / map</h2></section>
            <section className="print-tech-box"><h2>Tech log</h2>{renderList(sheet?.technicalChecks)}</section>
            <section className="print-remarks-box"><h2>Remarks / signature</h2></section>
            <span className="print-page-number">Page {page.pageIndex + 1} of {page.pageCount}</span>
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

function renderLogRow(line: LogLine | undefined, index: number) {
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
      <td>{formatSigned(line?.deviation)}</td>
      <td>{formatDegrees(line?.magneticCourse)}</td>
      <td>{formatSigned(line?.variation)}</td>
      <td>{formatDegrees(line?.trueCourse)}</td>
      <td>{formatDegrees(line?.courseThroughWater)}</td>
      <td>{formatDegrees(line?.courseOverGround)}</td>
      <td>{formatNumber(line?.speedKn)}</td>
      <td>{formatNumber(line?.logNm)}</td>
      <td>{formatNumber(line?.sailMiles)}</td>
      <td>{formatMotor(line)}</td>
      <td className="print-remarks-cell"><span className={remarkSizeClass(line?.remarks ?? "")}>{line?.remarks}</span></td>
    </tr>
  );
}

function remarkSizeClass(remark: string) {
  if (remark.length > 120) return "print-remark-text print-remark-tiny";
  if (remark.length > 70) return "print-remark-text print-remark-small";
  return "print-remark-text";
}

function PrintField({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="print-field"><span>{label}</span><strong>{valueOrBlank(value)}</strong></div>;
}

function renderList(items: string[] | undefined) {
  if (!items?.length) return <div className="print-writing-lines" aria-hidden="true" />;
  return <ul>{items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>;
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
.log-sheet-print-page { box-sizing: border-box; display: grid; grid-template-rows: 31mm 1fr 42mm; gap: 3mm; width: 297mm; height: 210mm; padding: 8mm; page-break-after: always; break-after: page; background: #fff; color: #000; }
.log-sheet-print-page:last-child { page-break-after: auto; break-after: auto; }
.print-header, .print-footer { display: grid; gap: 3mm; }
.print-header { grid-template-columns: 1fr 62mm; border: 1px solid #000; padding: 2mm; }
.print-kicker, .print-field span { margin: 0; font-size: 7pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.print-title-block h1 { margin: 0 0 1.5mm; font-size: 15pt; line-height: 1.1; }
.print-master-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5mm; }
.print-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5mm; border-left: 1px solid #000; padding-left: 2mm; }
.print-field { min-width: 0; border-bottom: 1px solid #000; }
.print-field strong { display: block; min-height: 11pt; overflow: hidden; font-size: 8pt; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.print-log-table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.6pt; line-height: 1.05; }
.print-log-table col.print-col-time { width: 4%; }
.print-log-table col.print-col-position { width: 11%; }
.print-log-table col.print-col-weather, .print-log-table col.print-col-wind { width: 7%; }
.print-log-table col.print-col-temp, .print-log-table col.print-col-baro, .print-log-table col.print-col-tide { width: 4%; }
.print-log-table col.print-col-sea { width: 6%; }
.print-log-table col.print-col-course { width: 3%; }
.print-log-table col.print-col-speed, .print-log-table col.print-col-log, .print-log-table col.print-col-sail { width: 3.5%; }
.print-log-table col.print-col-motor { width: 4.5%; }
.print-log-table col.print-col-remarks { width: 17%; }
.print-log-table tr { height: 7mm; max-height: 7mm; }
.print-log-table th, .print-log-table td { box-sizing: border-box; height: 7mm; max-height: 7mm; overflow: hidden; border: 1px solid #000; padding: .8mm; text-align: left; vertical-align: top; }
.print-log-table th { font-size: 6.4pt; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
.print-log-table td { white-space: nowrap; text-overflow: ellipsis; }
.print-remarks-cell { white-space: nowrap; }
.print-remark-text { display: block; overflow: hidden; width: 100%; max-height: 5.2mm; font-size: 6.3pt; line-height: 1.05; text-overflow: ellipsis; white-space: nowrap; }
.print-remark-small { font-size: 5.5pt; }
.print-remark-tiny { font-size: 4.8pt; }
.print-footer { position: relative; grid-template-columns: 72mm 1fr 82mm; }
.print-footer section { border: 1px solid #000; padding: 2mm; }
.print-footer h2 { margin: 0 0 2mm; font-size: 8pt; text-transform: uppercase; }
.print-route-box { background-image: linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px); background-size: 10mm 10mm; }
.print-tech-box ul { margin: 0; padding-left: 4mm; font-size: 7pt; }
.print-writing-lines { height: 25mm; background: repeating-linear-gradient(to bottom, transparent 0, transparent 7mm, #000 7.2mm); }
.print-page-number { position: absolute; right: 2mm; bottom: 1.5mm; font-size: 7pt; font-weight: 700; }
@media print { body { margin: 0; } @page { size: A4 landscape; margin: 0; } .log-sheet-print-page { width: 297mm; height: 210mm; } }
`;

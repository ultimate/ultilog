import { auth } from "../../../auth";
import { readSharedLogSheet } from "../../lib/logbook-store";
import { EntityImage } from "../../components/logbook/EntityImage";
import { LogLinesMapView } from "../../components/logbook/OpenSeaMapView";
import { formatLogSheetDuration } from "../../domain/logbook/sheet-metrics";
import { formatMiles } from "../../lib/format-number";

export default async function SharedLogbookPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const { ownerId, sheetId } = parseShareSegments(segments);
  const session = await auth();
  const shared = sheetId ? await readSharedLogSheet(sheetId, Boolean(session?.user?.id), ownerId) : undefined;

  if (!shared) {
    return (
      <main className="app-shell shared-logbook-page">
        <section className="app-content">
          <article className="logbook-section">
            <p className="eyebrow">Shared logbook</p>
            <h1>Logbook not available</h1>
            <p>This logbook is private, restricted to registered users, or does not exist.</p>
          </article>
        </section>
      </main>
    );
  }

  const { sheet, boatName } = shared;
  const metrics = sheet.metrics;
  const hasCrew = sheet.crew.length > 0;
  const hasTechnicalLog = sheet.technicalChecks.length > 0;
  const hasLogLines = sheet.lines.length > 0;
  const hasMetrics = Boolean(metrics);
  const hasSupportContent = hasCrew || hasTechnicalLog || hasLogLines;

  return (
    <main className="app-shell shared-logbook-page">
      <section className="app-content">
        <article className="logbook-section sheet-master-header">
          {sheet.image ? <EntityImage image={sheet.image} entityType="sheet" alt={`${sheet.title} image`} variant="header" /> : null}
          <div className="sheet-master-title">
            <p className="eyebrow">Shared logbook</p>
            <h1>{sheet.title}</h1>
            <p>{sheet.dateRange}</p>
          </div>
          {(boatName || sheet.route.from || sheet.route.to) && (
            <div className="paper-header header-table">
              {boatName ? <div className="header-table-row"><span>Boat</span><strong>{boatName}</strong></div> : null}
              {(sheet.route.departed || sheet.route.from) ? <div className="header-table-row"><span>From</span><strong>{sheet.route.departed}</strong><strong>{sheet.route.from}</strong></div> : null}
              {(sheet.route.arrived || sheet.route.to) ? <div className="header-table-row"><span>To</span><strong>{sheet.route.arrived}</strong><strong>{sheet.route.to}</strong></div> : null}
            </div>
          )}
        </article>

        {hasMetrics ? (
          <section className="entry-metrics logbook-section" aria-label="Shared logbook summary">
            <article><span>Motor miles</span><strong>{formatMiles(metrics?.motorMiles ?? 0)} nm</strong></article>
            <article><span>Sail miles</span><strong>{formatMiles(metrics?.sailMiles ?? 0)} nm</strong></article>
            <article><span>Total miles</span><strong>{formatMiles(metrics?.totalMiles ?? 0)} nm</strong></article>
            <article><span>Duration</span><strong>{formatLogSheetDuration(metrics?.durationMinutes)}</strong></article>
          </section>
        ) : null}

        {hasLogLines ? (
          <article className="table-card">
            <div className="table-header"><h2>Log lines</h2></div>
            <div className="table-scroll">
              <table className="log-lines-table">
                <thead><tr><th>Time</th><th>Lat</th><th>Lon</th><th>Weather</th><th>Wind</th><th>Log</th><th>Remarks</th></tr></thead>
                <tbody>{sheet.lines.map((line, index) => <tr key={`${line.time}-${index}`}><td>{line.time}</td><td>{line.latitude}</td><td>{line.longitude}</td><td>{line.weather} {line.weatherRemark}</td><td>{line.windDirection} {line.windStrength} {line.windUnit}</td><td>{line.logNm} nm</td><td>{line.remarks}</td></tr>)}</tbody>
              </table>
            </div>
          </article>
        ) : null}

        {hasSupportContent ? (
          <section className="sheet-support-grid logbook-section" aria-label="Shared logbook support information">
            {hasCrew ? (
              <article className="info-card logbook-section">
                <h2>Crew</h2>
                <ul className="stack-list crew-assignment-list">
                  {sheet.crew.map((person, index) => (
                    <li key={`${person.id}-${index}`}>
                      <div className="crew-assignment-main">
                        <strong>{index + 1}. {index === 0 ? "⭐ Skipper · " : ""}{person.name}</strong>
                        <span>{[person.nationality, person.role].filter(Boolean).join(" · ")}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {hasTechnicalLog ? (
              <article className="info-card logbook-section">
                <h2>Technical log</h2>
                <ul className="stack-list">{sheet.technicalChecks.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
              </article>
            ) : null}

            {hasLogLines ? (
              <article className="map-card logbook-section logbook-sheet-map-section">
                <div className="logbook-map-heading"><h2>Positions</h2></div>
                <LogLinesMapView logLines={sheet.lines} />
              </article>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function parseShareSegments(segments: string[]) {
  if (segments.length === 1) return { sheetId: segments[0] };
  if (segments.length === 2) return { ownerId: segments[0], sheetId: segments[1] };
  return {};
}

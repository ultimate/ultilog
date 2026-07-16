import { auth } from "../../../auth";
import { readSharedLogSheet } from "../../lib/logbook-store";
import { EntityImage } from "../../components/logbook/EntityImage";

export default async function SharedLogbookPage({ params }: { params: Promise<{ sheetId: string; ownerId?: string }> }) {
  const { sheetId, ownerId } = await params;
  const session = await auth();
  const shared = await readSharedLogSheet(sheetId, Boolean(session?.user?.id), ownerId);

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
  const skipper = sheet.crew[0];

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

        {skipper ? <article className="logbook-section info-card"><h2>Skipper</h2><p>{skipper.name}</p></article> : null}

        {sheet.crew.length > (skipper ? 1 : 0) ? (
          <article className="logbook-section info-card">
            <h2>Crew</h2>
            <ul className="stack-list">{sheet.crew.slice(skipper ? 1 : 0).map((crew, index) => <li key={`${crew.id}-${index}`}>{crew.name} · {crew.role}</li>)}</ul>
          </article>
        ) : null}

        {sheet.lines.length ? (
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

        {sheet.technicalChecks.length ? <article className="logbook-section info-card"><h2>Technical log</h2><ul className="stack-list">{sheet.technicalChecks.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></article> : null}
      </section>
    </main>
  );
}

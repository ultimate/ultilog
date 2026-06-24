"use client";

import { useMemo, useState } from "react";
import { boats, logSheets } from "../data/logbook";

const legalRequirements = [
  "Boat registration, flag state, home port, owner, and vessel particulars",
  "Skipper identity, address, nationality, and certificate details",
  "Crew identities, nationalities, roles, embarkation and disembarkation ports/dates",
  "Port departures and arrivals with place and date",
  "Passage reports: weather, courses, log readings, sail plan, engine operation, and positions",
  "Watch plan plus important events, observations, accidents, and damage",
];

const yachtDataOrder = [
  "Class / type",
  "MMSI",
  "Manufacturer",
  "Hull length",
  "Beam",
  "Draft",
  "Displacement",
  "Rig / sail area",
  "Engine",
  "Propeller",
  "Electronics",
  "Safety",
];

export function LogbookApp() {
  const [activeSheetId, setActiveSheetId] = useState(logSheets[0].id);
  const [showCourseTable, setShowCourseTable] = useState(false);
  const activeSheet = logSheets.find((sheet) => sheet.id === activeSheetId) ?? logSheets[0];
  const activeBoat = boats.find((boat) => boat.id === activeSheet.boatId) ?? boats[0];

  const stats = useMemo(() => {
    const totalNm = logSheets.reduce((sum, sheet) => sum + Math.max(...sheet.lines.map((line) => line.logNm)), 0);
    const sailNm = logSheets
      .filter((sheet) => boats.find((boat) => boat.id === sheet.boatId)?.type === "Sail")
      .reduce((sum, sheet) => sum + Math.max(...sheet.lines.map((line) => line.logNm)), 0);
    return { totalNm, sailNm, motorNm: totalNm - sailNm, sheets: logSheets.length };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Personal skipper logbook</p>
          <h1>Track ICC / Hochseeausweis miles across boats, crews, and passages.</h1>
          <p className="hero-text">
            Ultilog is now shaped around the Swiss Hochseeausweis logbook requirements: one skipper can manage multiple boats,
            create trip sheets, capture legally relevant log lines, and keep a long-term personal sailing history.
          </p>
        </div>
        <div className="stat-grid" aria-label="Personal log statistics">
          <article><span>Total miles</span><strong>{stats.totalNm} nm</strong></article>
          <article><span>Sail</span><strong>{stats.sailNm} nm</strong></article>
          <article><span>Motor</span><strong>{stats.motorNm} nm</strong></article>
          <article><span>Sheets</span><strong>{stats.sheets}</strong></article>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar" aria-label="Log sheets">
          <div className="sidebar-header">
            <p className="eyebrow">Sheets</p>
            <button type="button">+ New sheet</button>
          </div>
          {logSheets.map((sheet) => {
            const boat = boats.find((candidate) => candidate.id === sheet.boatId);
            return (
              <button
                className={`sheet-button ${sheet.id === activeSheet.id ? "active" : ""}`}
                key={sheet.id}
                onClick={() => setActiveSheetId(sheet.id)}
                type="button"
              >
                <span>{sheet.title}</span>
                <small>{sheet.dateRange} · {boat?.name}</small>
              </button>
            );
          })}
        </aside>

        <section className="sheet-detail" aria-labelledby="sheet-title">
          <div className="sheet-title-row">
            <div>
              <p className="eyebrow">Active sheet</p>
              <h2 id="sheet-title">{activeSheet.title}</h2>
              <p>{activeSheet.route.from} → {activeSheet.route.to} · {activeSheet.dateRange}</p>
            </div>
            <span className="status-pill">{activeSheet.status}</span>
          </div>

          <section className="paper-header" aria-label="Daily paper log header">
            <div><span>Day goal</span><strong>{activeSheet.route.dayGoal}</strong></div>
            <div><span>Date</span><strong>{activeSheet.dateRange}</strong></div>
            <div><span>Daily logbook lead</span><strong>{activeSheet.skipper.name}</strong></div>
            <div><span>Stage / sheet</span><strong>{activeSheet.id}</strong></div>
            <div><span>Position morning</span><strong>{activeSheet.route.morningPosition}</strong></div>
            <div><span>Position evening</span><strong>{activeSheet.route.eveningPosition}</strong></div>
          </section>

          <div className="detail-grid">
            <article className="info-card">
              <h3>Boat</h3>
              <dl>
                <div><dt>Name</dt><dd>{activeBoat.name}</dd></div>
                <div><dt>Type</dt><dd>{activeBoat.type}</dd></div>
                <div><dt>Registration</dt><dd>{activeBoat.registration}</dd></div>
                <div><dt>Flag / home port</dt><dd>{activeBoat.flagState} · {activeBoat.homePort}</dd></div>
                <div><dt>Owner</dt><dd>{activeBoat.owner}</dd></div>
                <div><dt>Ship data</dt><dd>{activeBoat.dimensions}</dd></div>
              </dl>
            </article>

            <article className="info-card">
              <h3>Skipper & ports</h3>
              <dl>
                <div><dt>Skipper</dt><dd>{activeSheet.skipper.name}</dd></div>
                <div><dt>Address</dt><dd>{activeSheet.skipper.address}</dd></div>
                <div><dt>Nationality</dt><dd>{activeSheet.skipper.nationality}</dd></div>
                <div><dt>Certificate</dt><dd>{activeSheet.skipper.certificate}</dd></div>
                <div><dt>Departure</dt><dd>{activeSheet.route.departed}</dd></div>
                <div><dt>Arrival</dt><dd>{activeSheet.route.arrived}</dd></div>
              </dl>
            </article>
          </div>

          <article className="yacht-card">
            <div>
              <p className="eyebrow">Yacht data</p>
              <h3>Boat master data inspired by the paper examples</h3>
            </div>
            <dl className="yacht-data-grid">
              {yachtDataOrder.map((label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{activeBoat.yachtData[label]}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="map-card">
            <div>
              <p className="eyebrow">Route map draft</p>
              <h3>Positions connected from log lines</h3>
            </div>
            <div className="route-map" aria-label="Stylized route map preview">
              {activeSheet.lines.map((line, index) => (
                <span
                  className="map-marker"
                  key={`${line.time}-${line.position}`}
                  style={{ left: `${12 + index * (76 / Math.max(activeSheet.lines.length - 1, 1))}%`, top: `${62 - index * 8}%` }}
                  title={`${line.time} · ${line.position}`}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </article>

          <article className="weather-card">
            <div>
              <p className="eyebrow">Weather briefing</p>
              <h3>Forecast, warnings, and planning context</h3>
            </div>
            <div className="briefing-grid">
              <div><span>Station</span><strong>{activeSheet.weatherBriefing.station}</strong></div>
              <div><span>Time</span><strong>{activeSheet.weatherBriefing.time}</strong></div>
              <div><span>Area</span><strong>{activeSheet.weatherBriefing.area}</strong></div>
              <div className="wide"><span>Forecast</span><strong>{activeSheet.weatherBriefing.forecast}</strong></div>
              <div className="wide"><span>Warnings</span><strong>{activeSheet.weatherBriefing.warnings}</strong></div>
            </div>
          </article>

          <article className="table-card">
            <div className="table-header">
              <div>
                <p className="eyebrow">Combined day sheet</p>
                <h3>Meteorological and nautical log lines</h3>
              </div>
              <button type="button">+ Add line</button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Weather</th>
                    <th>Baro</th>
                    <th>Sea</th>
                    <th>Wind</th>
                    <th>MgK</th>
                    <th>Course</th>
                    <th>Log</th>
                    <th>Sail</th>
                    <th>Motor</th>
                    <th>Position</th>
                    <th>Lat / Lon</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.lines.map((line) => (
                    <tr key={`${line.time}-${line.position}`}>
                      <td>{line.time}</td>
                      <td>{line.weather}</td>
                      <td>{line.barometer}</td>
                      <td>{line.seaState}</td>
                      <td>{line.wind}</td>
                      <td>{line.magneticCourse}</td>
                      <td>{line.course}</td>
                      <td>{line.logNm} nm</td>
                      <td>{line.sails}</td>
                      <td>{line.engine}</td>
                      <td>{line.position}</td>
                      <td>{line.latitude.toFixed(3)} / {line.longitude.toFixed(3)}</td>
                      <td>{line.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="paper-grid">
            <article className="remarks-card">
              <div>
                <p className="eyebrow">Remarks</p>
                <h3>Maneuvers, observations, events, and lightkeeping</h3>
              </div>
              <ol>
                {activeSheet.remarks.map((remark) => <li key={remark}>{remark}</li>)}
              </ol>
            </article>

            <article className="summary-card">
              <div>
                <p className="eyebrow">Tour summary</p>
                <h3>Törnzusammenfassung</h3>
              </div>
              <dl>
                <div><dt>Area</dt><dd>{activeSheet.daySummary.area}</dd></div>
                <div><dt>Night hours</dt><dd>{activeSheet.daySummary.nightHours}</dd></div>
                <div><dt>Days on board</dt><dd>{activeSheet.daySummary.daysOnBoard}</dd></div>
                <div><dt>Sailing miles</dt><dd>{activeSheet.daySummary.sailingMiles} nm</dd></div>
                <div><dt>Motor miles</dt><dd>{activeSheet.daySummary.motorMiles} nm</dd></div>
                <div><dt>Outside FB2</dt><dd>{activeSheet.daySummary.outsideFb2Miles} nm</dd></div>
                <div><dt>Engine hours</dt><dd>{activeSheet.daySummary.engineHoursStart} → {activeSheet.daySummary.engineHoursEnd}</dd></div>
              </dl>
            </article>
          </div>

          <div className="bottom-grid">
            <article className="info-card">
              <h3>Crew for this sheet</h3>
              <ul className="stack-list">
                {activeSheet.crew.map((person) => (
                  <li key={person.name}>
                    <strong>{person.name}</strong>
                    <span>{person.nationality} · {person.role}</span>
                    <small>{person.embarkation} → {person.disembarkation}</small>
                  </li>
                ))}
              </ul>
            </article>

            <article className="info-card">
              <h3>Watch & daily checks</h3>
              <ul className="check-list">
                {[...activeSheet.watchPlan, ...activeSheet.technicalChecks].map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          </div>

          <article className="compliance-card">
            <div>
              <p className="eyebrow">Swiss compliance checklist</p>
              <h3>Built from Hochseeausweis logbook requirements</h3>
            </div>
            <ul>
              {legalRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
            </ul>
          </article>

          <article className="signature-card">
            <div><span>Logbook lead</span><strong>{activeSheet.skipper.name}</strong></div>
            <div><span>Skipper</span><strong>{activeSheet.skipper.name}</strong></div>
            <div><span>Digital personal-log status</span><strong>{activeSheet.status}</strong></div>
          </article>

          <article className="optional-card">
            <button type="button" onClick={() => setShowCourseTable((current) => !current)}>
              {showCourseTable ? "Hide" : "Show"} optional course conversion table
            </button>
            {showCourseTable && (
              <div className="course-table">
                <span>Magnetic course</span><span>Deviation</span><span>Variation</span><span>Course over ground</span>
                <strong>214°</strong><strong>-2°</strong><strong>+4° E</strong><strong>216°</strong>
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

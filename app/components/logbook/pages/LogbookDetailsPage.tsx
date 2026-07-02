import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  Boat,
  LineForm,
  LogSheet,
  PersistedLogbook,
} from "../../../models/logbook";
import { courseConversionColumns } from "../../../domain/nautical/course-conversion";
import { coordinateToInput, decimalToDmsParts, dmsPartsToDecimal, parseCoordinate, type CoordinateFormat, type DmsParts } from "../../../domain/nautical/coordinates";
import { boatToForm, sheetToForm } from "../forms";
import { dateTimeLocalFromParts, splitDateTimeLocal } from "../date-utils";
import { updateLogLineFormForInput } from "../../../domain/log-lines/log-line-editor";
import { LogLinesMapView } from "../OpenSeaMapView";

type LogbookDetailsPageProps = Record<string, any>;

export function LogbookDetailsPage(props: LogbookDetailsPageProps) {
  const {
    isBackendReady,
    showNewSheet,
    editingSheetId,
    saveSheet,
    sheetForm,
    setSheetForm,
    setSelectedBoatId,
    setEditingBoatId,
    setBoatForm,
    setShowBoatManager,
    navigate,
    cancelSheetEdit,
    renderInlineTextField,
    isActiveSheetLocked,
    updateActiveSheetStatus,
    renderInlineBoatField,
    renderInlineDateField,
    activeSheetSummary,
    showCourseColumns,
    startAddingLine,
    startAddingLineHereNow,
    showAddLine,
    saveLineFromFields,
    editingLineIndex,
    cancelLineEdit,
    startEditingLine,
    deleteLine,
    updateCrewAssignment,
    moveCrewOnActiveSheet,
    deleteCrewFromActiveSheet,
    addCrewToActiveSheet,
  } = props;
  const activeBoat = props.activeBoat as Boat;
  const activeSheet = props.activeSheet as LogSheet;
  const lineForm = props.lineForm as LineForm;
  const logbook = props.logbook as PersistedLogbook;
  const setLineForm = props.setLineForm as Dispatch<SetStateAction<LineForm>>;
  const setShowCourseColumns = props.setShowCourseColumns as Dispatch<
    SetStateAction<boolean>
  >;
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>("decimal");
  const courseConversionSequence = useRef(0);

  const renderNumberInput = (field: keyof LineForm, options?: { min?: number; max?: number; step?: string }) => (
    <input type="number" min={options?.min} max={options?.max} step={options?.step ?? "1"} value={lineForm[field]} onChange={(e) => setLineForm({ ...lineForm, [field]: e.target.value })} />
  );
  const renderTextInput = (field: keyof LineForm, label?: string) => (
    <input aria-label={label} value={lineForm[field]} onChange={(e) => setLineForm({ ...lineForm, [field]: e.target.value })} />
  );


  const updateLineFormField = (field: keyof LineForm, value: string) => {
    const sequence = courseConversionSequence.current + 1;
    courseConversionSequence.current = sequence;
    const updated = updateLogLineFormForInput(lineForm, { field, value }, { boat: activeBoat });
    Promise.resolve(updated)
      .then((result) => {
        if (courseConversionSequence.current !== sequence) return;
        setLineForm(result);
      })
      .catch(() => setLineForm({ ...lineForm, [field]: value }));
  };

  const renderCourseInput = (field: keyof LineForm, options: { min?: number; max?: number }) => (
    <input
      type="number"
      min={options.min}
      max={options.max}
      step="1"
      value={lineForm[field]}
      onChange={(e) => updateLineFormField(field, e.target.value)}
    />
  );


  const updateCoordinateField = (field: "latitude" | "longitude", value: string) => {
    if (!value.trim()) {
      updateLineFormField(field, "");
      return;
    }
    updateLineFormField(field, value);
  };

  const renderCoordinateInput = (field: "latitude" | "longitude", label: string) => {
    if (coordinateFormat === "decimal") return <input aria-label={label} value={lineForm[field]} onChange={(e) => updateCoordinateField(field, e.target.value)} />;
    const parts = lineForm[field].trim() ? decimalToDmsParts(parseCoordinate(lineForm[field])) : { degrees: "", minutes: "", seconds: "" };
    const updatePart = (part: keyof DmsParts, value: string) => {
      const nextParts = { ...parts, [part]: value };
      updateCoordinateField(field, String(dmsPartsToDecimal(nextParts)));
    };
    return (
      <div className="compound-inputs dms-inputs" aria-label={label}>
        <label><span>[°]</span><input aria-label={`${label} degrees`} type="number" value={parts.degrees} onChange={(e) => updatePart("degrees", e.target.value)} /></label>
        <label><span>[&prime;]</span><input aria-label={`${label} minutes`} type="number" value={parts.minutes} onChange={(e) => updatePart("minutes", e.target.value)} /></label>
        <label><span>[&Prime;]</span><input aria-label={`${label} seconds`} type="number" step="0.1" value={parts.seconds} onChange={(e) => updatePart("seconds", e.target.value)} /></label>
      </div>
    );
  };

  const renderLineEditor = (key: string) => (
    <tr key={key} className="inline-line-row">
      <td><input type="datetime-local" value={lineForm.time} onChange={(e) => updateLineFormField("time", e.target.value)} /></td><td>{renderCoordinateInput("latitude", "Latitude")}</td><td>{renderCoordinateInput("longitude", "Longitude")}</td>
      <td><select value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })}><option value="">—</option>{weatherEmojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></td>
      <td>{renderNumberInput("barometer", { min: 800, max: 1200 })}</td>
      <td><div className="compound-inputs"><select aria-label="Wind direction" value={lineForm.windDirection} onChange={(e) => setLineForm({ ...lineForm, windDirection: e.target.value })}><option value="">—</option>{compassDirections.map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select>{renderNumberInput("windStrength")}<select value={lineForm.windUnit} onChange={(e) => setLineForm({ ...lineForm, windUnit: e.target.value })}><option value="bft">bft</option><option value="kn">kn</option></select></div></td>
      <td><div className="compound-inputs">{renderNumberInput("seaState", { step: "0.1" })}<select value={lineForm.seaUnit} onChange={(e) => setLineForm({ ...lineForm, seaUnit: e.target.value })}><option value="m">m</option><option value="ft">ft</option></select></div></td>
      <td><div className="compound-inputs">{renderNumberInput("tide", { step: "0.1" })}<select value={lineForm.tideUnit} onChange={(e) => setLineForm({ ...lineForm, tideUnit: e.target.value })}><option value="m">m</option><option value="ft">ft</option></select></div></td>
      <td><select value={lineForm.moon} onChange={(e) => setLineForm({ ...lineForm, moon: e.target.value })}><option value="">—</option>{moonEmojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></td>
      <td>{renderCourseInput("magneticCourse", { min: 0, max: 359 })}</td>
      {showCourseColumns && courseFieldNames.map((field) => <td className="optional-course-cell" key={field}>{renderCourseInput(field, courseSignedFields.has(field) ? { min: -180, max: 180 } : { min: 0, max: 359 })}</td>)}
      <td>{renderCourseInput("courseOverGround", { min: 0, max: 359 })}</td><td>{renderNumberInput("speedKn", { step: "0.1" })}</td><td>{renderNumberInput("logNm", { step: "0.1" })}</td>
      <td><div className="compound-inputs labeled-inputs"><label><span>[sm]</span>{renderNumberInput("sailSm", { step: "0.1" })}</label><label><span>[note]</span>{renderTextInput("sailNote", "Sail note")}</label></div></td>
      <td><div className="compound-inputs labeled-inputs"><label><span>[sm]</span>{renderNumberInput("motorSm", { step: "0.1" })}</label><label><span>[h]</span>{renderNumberInput("motorHours", { step: "0.1" })}</label><label><span>[note]</span>{renderTextInput("motorNote", "Motor note")}</label></div></td>
      <td>{renderTextInput("remarks")}</td><td colSpan={2}><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "💾"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td>
    </tr>
  );

  return (
    <>
      {!isBackendReady && (
        <section className="sheet-detail" aria-label="Loading logbook sheet">
          <form className="sheet-title-row inline-edit-card">
            <div className="inline-edit-grid">
              <p className="eyebrow">Loading sheet</p>
              <label>
                Title
                <input disabled value="" readOnly />
              </label>
              <div className="header-edit-row">
                <span>Boat</span>
                <select aria-label="Boat" disabled value="">
                  <option value=""> </option>
                </select>
                <button type="button" className="edit-chip" disabled>
                  Jump to boat
                </button>
              </div>
              <div className="header-edit-row">
                <span>From</span>
                <input
                  aria-label="From datetime"
                  type="datetime-local"
                  disabled
                  value=""
                  readOnly
                />
                <input aria-label="From position" disabled value="" readOnly />
              </div>
              <div className="header-edit-row">
                <span>To</span>
                <input
                  aria-label="To datetime"
                  type="datetime-local"
                  disabled
                  value=""
                  readOnly
                />
                <input aria-label="To position" disabled value="" readOnly />
              </div>
            </div>
          </form>
        </section>
      )}

      {isBackendReady && (
        <section className="sheet-detail" aria-labelledby="sheet-title">
          {showNewSheet || editingSheetId ? (
            <form
              className="sheet-title-row inline-edit-card"
              onSubmit={saveSheet}
            >
              <div className="inline-edit-grid">
                <p className="eyebrow">
                  {editingSheetId ? "Edit sheet" : "New sheet"}
                </p>
                <label>
                  Title
                  <input
                    required
                    value={sheetForm.title}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, title: e.target.value })
                    }
                  />
                </label>
                <div className="header-edit-row">
                  <span>Boat</span>
                  <select
                    aria-label="Boat"
                    value={sheetForm.boatId}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, boatId: e.target.value })
                    }
                  >
                    {logbook.boats.map((boat) => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name}
                      </option>
                    ))}
                  </select>
                  {editingSheetId && (
                    <button
                      type="button"
                      className="edit-chip"
                      onClick={() => {
                        setSelectedBoatId(sheetForm.boatId);
                        setEditingBoatId(sheetForm.boatId);
                        const boat = logbook.boats.find(
                          (candidate) => candidate.id === sheetForm.boatId,
                        );
                        if (boat) setBoatForm(boatToForm(boat));
                        setShowBoatManager(false);
                        navigate("boats", sheetForm.boatId);
                      }}
                    >
                      Jump to boat
                    </button>
                  )}
                </div>
                <div className="header-edit-row">
                  <span>From</span>
                  <input
                    aria-label="From datetime"
                    type="datetime-local"
                    value={dateTimeLocalFromParts(
                      sheetForm.dateRange,
                      sheetForm.fromTime,
                    )}
                    onChange={(e) => {
                      const { date, time } = splitDateTimeLocal(e.target.value);
                      setSheetForm({
                        ...sheetForm,
                        dateRange: date || sheetForm.dateRange,
                        fromTime: time,
                      });
                    }}
                  />
                  <input
                    aria-label="From position"
                    value={sheetForm.from}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, from: e.target.value })
                    }
                  />
                </div>
                <div className="header-edit-row">
                  <span>To</span>
                  <input
                    aria-label="To datetime"
                    type="datetime-local"
                    value={dateTimeLocalFromParts(
                      sheetForm.dateRange,
                      sheetForm.toTime,
                    )}
                    onChange={(e) => {
                      const { date, time } = splitDateTimeLocal(e.target.value);
                      setSheetForm({
                        ...sheetForm,
                        dateRange: date || sheetForm.dateRange,
                        toTime: time,
                      });
                    }}
                  />
                  <input
                    aria-label="To position"
                    value={sheetForm.to}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, to: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="inline-edit-actions">
                <button type="submit">Save</button>
                {showNewSheet ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      cancelSheetEdit();
                      navigate("logbooks");
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setSheetForm(sheetToForm(activeSheet))}
                  >
                    Discard changes
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <section
                className="sheet-title-row logbook-section sheet-master-header"
                aria-label="Logbook sheet header"
              >
                <div className="sheet-master-title">
                  <h2 id="sheet-title">
                    {renderInlineTextField(
                      "title",
                      activeSheet.title,
                      "Untitled sheet",
                    )}
                  </h2>
                </div>
                <div className="inline-edit-actions sheet-master-actions">
                  <span className="status-pill">{activeSheet.status}</span>
                  {isActiveSheetLocked ? (
                    <button
                      type="button"
                      className="edit-chip compact-chip"
                      onClick={() => updateActiveSheetStatus("Draft")}
                    >
                      Unlock
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="edit-chip compact-chip"
                      onClick={() => updateActiveSheetStatus("Locked")}
                    >
                      Lock
                    </button>
                  )}
                </div>
                <div className="paper-header header-table">
                  <div className="header-table-row">
                    <span>Boat</span>
                    <strong>{renderInlineBoatField()}</strong>
                    <button
                      type="button"
                      className="edit-chip icon-chip"
                      aria-label="Jump to boat"
                      title="Jump to boat"
                      onClick={() => {
                        setSelectedBoatId(activeBoat.id);
                        setEditingBoatId(activeBoat.id);
                        setBoatForm(boatToForm(activeBoat));
                        setShowBoatManager(false);
                        navigate("boats", activeBoat.id);
                      }}
                    >
                      ↗
                    </button>
                  </div>
                  <div className="header-table-row">
                    <span>From</span>
                    <strong>
                      {renderInlineDateField(
                        "departed",
                        activeSheet.route.departed,
                      )}
                    </strong>
                    <strong>
                      {renderInlineTextField("from", activeSheet.route.from)}
                    </strong>
                  </div>
                  <div className="header-table-row">
                    <span>To</span>
                    <strong>
                      {renderInlineDateField(
                        "arrived",
                        activeSheet.route.arrived,
                      )}
                    </strong>
                    <strong>
                      {renderInlineTextField("to", activeSheet.route.to)}
                    </strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {!showNewSheet && (
            <>
              <section
                className="entry-metrics logbook-section"
                aria-label="Summary calculated from log lines"
              >
                <article>
                  <span>Motor miles</span>
                  <strong>{activeSheetSummary.motorMiles} nm</strong>
                </article>
                <article>
                  <span>Sail miles</span>
                  <strong>{activeSheetSummary.sailMiles} nm</strong>
                </article>
                <article>
                  <span>Total miles</span>
                  <strong>{activeSheetSummary.totalMiles} nm</strong>
                </article>
                <article>
                  <span>Duration</span>
                  <strong>{activeSheetSummary.duration}</strong>
                </article>
              </section>

              <article className="table-card">
                <div className="table-header">
                  <div><h3>Meteorological and nautical log</h3></div>
                  <div className="table-actions">
                    <button type="button" onClick={() => setCoordinateFormat((format) => format === "decimal" ? "dms" : "decimal")}>Coordinates: {coordinateFormat === "decimal" ? "Decimal" : "DMS"}</button>
                    <button type="button" onClick={() => setShowCourseColumns((show) => !show)}>{showCourseColumns ? "Hide" : "Show"} course conversion columns</button>
                    <button type="button" disabled={isActiveSheetLocked} onClick={startAddingLine}>+ Add line</button>
                    <button type="button" disabled={isActiveSheetLocked} onClick={startAddingLineHereNow}>+ Add line here & now</button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className={showCourseColumns ? "log-lines-table with-course-columns" : "log-lines-table"}>
                    <thead>
                      <tr className="column-groups">
                        <th colSpan={3}>Time &amp; Pos</th><th colSpan={6}>Weather &amp; Sea</th><th colSpan={showCourseColumns ? 9 : 2}>Course</th><th colSpan={4}>Travel</th><th>Remarks</th><th colSpan={2}>Actions</th>
                      </tr>
                      <tr>
                        <th>Time</th><th>Lat</th><th>Lon</th><th>Weather</th><th>Baro</th><th>Wind</th><th>Sea</th><th>Tide</th><th>Moon</th><th>MgK / CC</th>
                        {showCourseColumns && courseConversionColumns.map((column) => <th key={column}>{column}</th>)}
                        <th>KüG / COG</th><th>Speed [kn]</th><th>Log [sm]</th><th>Sail</th><th>Motor</th><th>Remarks, Maneuver, Event</th><th>Edit</th><th>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showAddLine && renderLineEditor("new")}
                      {activeSheet.lines.map((line, index) => editingLineIndex === index ? renderLineEditor(`edit-${index}`) : (
                        <tr key={`${line.time}-${line.position}-${index}`}>
                          <td>{line.time}</td><td>{coordinateToInput(line.latitude, "lat", coordinateFormat)}</td><td>{coordinateToInput(line.longitude, "lon", coordinateFormat)}</td><td>{line.weather}</td><td>{line.barometer}</td><td>{line.windDirection} {line.windStrength} {line.windUnit}</td><td>{line.seaState} {line.seaUnit}</td><td>{line.tide} {line.tideUnit}</td><td>{line.moon}</td><td>{line.magneticCourse}</td>
                          {showCourseColumns && [line.deviation, line.magneticCourseCorrected, line.variation, line.trueCourse, line.driftAngle, line.courseThroughWater, line.currentDrift].map((value, courseIndex) => <td className="optional-course-cell" key={`${line.time}-${index}-${courseIndex}`}>{value}</td>)}
                          <td>{line.courseOverGround}</td><td>{line.speedKn}</td><td>{line.logNm}</td><td>{line.sailSm} sm {line.sailNote}</td><td>{line.motorSm} sm · {line.motorHours} h {line.motorNote}</td><td>{line.remarks}</td>
                          <td><button type="button" className="edit-chip" disabled={isActiveSheetLocked} onClick={() => startEditingLine(line, index)}>✏️</button></td>
                          <td><button type="button" className="edit-chip" disabled={isActiveSheetLocked} onClick={() => deleteLine(index)}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <section
                className="sheet-support-grid logbook-section"
                aria-label="Sheet support sections"
              >
                <article className="info-card logbook-section">
                  <h3>Crew list</h3>
                  <ul className="stack-list crew-assignment-list">
                    {activeSheet.crew.map((person, index) => {
                      return (
                        <li key={`${person.id}-${index}`}>
                          <div className="crew-assignment-main">
                            <strong>
                              {index + 1}. {index === 0 ? "⭐ Skipper · " : ""}
                              {person.name}
                            </strong>
                            <span>
                              {person.nationality} · {person.role}
                            </span>
                            <div className="crew-assignment-fields">
                              <span>From</span>
                              <input
                                aria-label={`Crew ${index + 1} from datetime`}
                                type="datetime-local"
                                disabled={isActiveSheetLocked}
                                value={person.embarkationDateTime}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "embarkationDateTime",
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                aria-label={`Crew ${index + 1} from position`}
                                disabled={isActiveSheetLocked}
                                value={person.embarkationPosition}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "embarkationPosition",
                                    e.target.value,
                                  )
                                }
                              />
                              <span>To</span>
                              <input
                                aria-label={`Crew ${index + 1} to datetime`}
                                type="datetime-local"
                                disabled={isActiveSheetLocked}
                                value={person.disembarkationDateTime}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "disembarkationDateTime",
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                aria-label={`Crew ${index + 1} to position`}
                                disabled={isActiveSheetLocked}
                                value={person.disembarkationPosition}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "disembarkationPosition",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="crew-assignment-actions">
                            <button
                              type="button"
                              className="edit-chip"
                              disabled={isActiveSheetLocked || index === 0}
                              onClick={() => moveCrewOnActiveSheet(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="edit-chip"
                              disabled={
                                isActiveSheetLocked ||
                                index === activeSheet.crew.length - 1
                              }
                              onClick={() => moveCrewOnActiveSheet(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="edit-chip"
                              aria-label={`Delete ${person.name}`}
                              disabled={isActiveSheetLocked}
                              onClick={() => deleteCrewFromActiveSheet(index)}
                            >
                              🗑️
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <label>
                    Add crew member
                    <select
                      disabled={isActiveSheetLocked}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          addCrewToActiveSheet(e.target.value);
                        e.currentTarget.value = "";
                      }}
                    >
                      <option value="">Select crew…</option>
                      {logbook.crewMembers
                        .filter(
                          (member) =>
                            !activeSheet.crew.some(
                              (crew) => crew.id === member.id,
                            ),
                        )
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </article>
                <article className="info-card logbook-section">
                  <h3>Technical log / daily checks</h3>
                  <ul className="check-list">
                    {[
                      ...activeSheet.watchPlan,
                      ...activeSheet.technicalChecks,
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="map-card logbook-section">
                  <div>
                    <p className="eyebrow">Map</p>
                    <h3>Positions connected from log lines</h3>
                  </div>
                  <LogLinesMapView logLines={activeSheet.lines} />
                </article>
              </section>
            </>
          )}
        </section>
      )}
    </>
  );
}

const compassDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const weatherEmojis = ["☁️", "⛅", "⛈️", "🌤️", "🌥️", "🌦️", "🌧️", "🌨️", "🌩️", "🌪️", "🌫️", "☀️", "❄️", "⭐"];
const moonEmojis = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌘"];
const courseFieldNames = ["deviation", "magneticCourseCorrected", "variation", "trueCourse", "driftAngle", "courseThroughWater", "currentDrift"] as const;
const courseSignedFields = new Set<keyof LineForm>(["deviation", "variation", "driftAngle", "currentDrift"]);

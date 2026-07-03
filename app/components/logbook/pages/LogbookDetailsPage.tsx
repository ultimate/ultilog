import { useI18n } from "../../../lib/i18n";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  Boat,
  LineForm,
  LogSheet,
  PersistedLogbook,
} from "../../../models/logbook";
import { coordinateToInput, decimalToDmsParts, dmsPartsToDecimal, parseCoordinate, type CoordinateFormat, type DmsParts } from "../../../domain/nautical/coordinates";
import { boatToForm, sheetToForm } from "../forms";
import { dateTimeLocalFromParts, splitDateTimeLocal } from "../date-utils";
import { updateLogLineFormForInput } from "../../../domain/log-lines/log-line-editor";
import { LogLinesMapView } from "../OpenSeaMapView";

const courseConversionColumnKeys = [
  "details.course.deviation",
  "details.course.magnetic",
  "details.course.variation",
  "details.course.true",
  "details.course.windDrift",
  "details.course.throughWater",
  "details.course.currentDrift",
] as const;

type LogbookDetailsPageProps = Record<string, any>;

export function LogbookDetailsPage(props: LogbookDetailsPageProps) {
  const { t } = useI18n();
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
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const scannerWarnings = activeSheet.scannerWarnings ?? [];
  const showScannerDraftNotice =
    activeSheet.source === "scanner" && activeSheet.status === "Draft";
  const courseConversionSequence = useRef(0);

  useEffect(() => {
    if (!isMapExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

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
      <td><input type="datetime-local" value={lineForm.time} onChange={(e) => updateLineFormField("time", e.target.value)} /></td><td>{renderCoordinateInput("latitude", t("details.lat"))}</td><td>{renderCoordinateInput("longitude", t("details.lon"))}</td>
      <td><select value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })}><option value="">—</option>{weatherEmojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></td>
      <td>{renderNumberInput("barometer", { min: 800, max: 1200 })}</td>
      <td><div className="compound-inputs"><select aria-label={t("details.windDirection")} value={lineForm.windDirection} onChange={(e) => setLineForm({ ...lineForm, windDirection: e.target.value })}><option value="">—</option>{compassDirections.map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select>{renderNumberInput("windStrength")}<select value={lineForm.windUnit} onChange={(e) => setLineForm({ ...lineForm, windUnit: e.target.value })}><option value="bft">bft</option><option value="kn">kn</option></select></div></td>
      <td><div className="compound-inputs">{renderNumberInput("seaState", { step: "0.1" })}<select value={lineForm.seaUnit} onChange={(e) => setLineForm({ ...lineForm, seaUnit: e.target.value })}><option value="m">m</option><option value="ft">ft</option></select></div></td>
      <td><div className="compound-inputs">{renderNumberInput("tide", { step: "0.1" })}<select value={lineForm.tideUnit} onChange={(e) => setLineForm({ ...lineForm, tideUnit: e.target.value })}><option value="m">m</option><option value="ft">ft</option></select></div></td>
      <td><select value={lineForm.moon} onChange={(e) => setLineForm({ ...lineForm, moon: e.target.value })}><option value="">—</option>{moonEmojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></td>
      <td>{renderCourseInput("magneticCourse", { min: 0, max: 359 })}</td>
      {showCourseColumns && courseFieldNames.map((field) => <td className="optional-course-cell" key={field}>{renderCourseInput(field, courseSignedFields.has(field) ? { min: -180, max: 180 } : { min: 0, max: 359 })}</td>)}
      <td>{renderCourseInput("courseOverGround", { min: 0, max: 359 })}</td><td>{renderNumberInput("speedKn", { step: "0.1" })}</td><td>{renderNumberInput("logNm", { step: "0.1" })}</td>
      <td><div className="compound-inputs labeled-inputs"><label><span>[sm]</span>{renderNumberInput("sailSm", { step: "0.1" })}</label><label><span>[note]</span>{renderTextInput("sailNote", t("details.sailNote"))}</label></div></td>
      <td><div className="compound-inputs labeled-inputs"><label><span>[sm]</span>{renderNumberInput("motorSm", { step: "0.1" })}</label><label><span>[h]</span>{renderNumberInput("motorHours", { step: "0.1" })}</label><label><span>[note]</span>{renderTextInput("motorNote", t("details.motorNote"))}</label></div></td>
      <td>{renderTextInput("remarks")}</td><td colSpan={2}><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? t("details.saveLine") : "💾"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>{t("common.cancel")}</button></div></td>
    </tr>
  );

  return (
    <>
      {!isBackendReady && (
        <section className="sheet-detail" aria-label={t("details.loadingAria")}>
          <form className="sheet-title-row inline-edit-card">
            <div className="inline-edit-grid">
              <p className="eyebrow">{t("details.loading")}</p>
              <label>
                {t("common.title")}
                <input disabled value="" readOnly />
              </label>
              <div className="header-edit-row">
                <span>{t("common.boat")}</span>
                <select aria-label={t("common.boat")} disabled value="">
                  <option value=""> </option>
                </select>
                <button type="button" className="edit-chip" disabled>
                  {t("details.jumpToBoat")}
                </button>
              </div>
              <div className="header-edit-row">
                <span>{t("common.from")}</span>
                <input
                  aria-label={t("details.fromDateTime")}
                  type="datetime-local"
                  disabled
                  value=""
                  readOnly
                />
                <input aria-label={t("details.fromPosition")} disabled value="" readOnly />
              </div>
              <div className="header-edit-row">
                <span>{t("common.to")}</span>
                <input
                  aria-label={t("details.toDateTime")}
                  type="datetime-local"
                  disabled
                  value=""
                  readOnly
                />
                <input aria-label={t("details.toPosition")} disabled value="" readOnly />
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
                  {editingSheetId ? t("details.editSheet") : t("details.newSheet")}
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
                  <span>{t("common.boat")}</span>
                  <select
                    aria-label={t("common.boat")}
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
                  <span>{t("common.from")}</span>
                  <input
                    aria-label={t("details.fromDateTime")}
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
                    aria-label={t("details.fromPosition")}
                    value={sheetForm.from}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, from: e.target.value })
                    }
                  />
                </div>
                <div className="header-edit-row">
                  <span>{t("common.to")}</span>
                  <input
                    aria-label={t("details.toDateTime")}
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
                    aria-label={t("details.toPosition")}
                    value={sheetForm.to}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, to: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="inline-edit-actions">
                <button type="submit">{t("common.save")}</button>
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
                aria-label={t("details.headerAria")}
              >
                <div className="sheet-master-title">
                  <h2 id="sheet-title">
                    {renderInlineTextField(
                      "title",
                      activeSheet.title,
                      t("details.untitled"),
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
                    <span>{t("common.boat")}</span>
                    <strong>{renderInlineBoatField()}</strong>
                    <button
                      type="button"
                      className="edit-chip icon-chip"
                      aria-label={t("details.jumpToBoat")}
                      title={t("details.jumpToBoat")}
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
                    <span>{t("common.from")}</span>
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
                    <span>{t("common.to")}</span>
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
              {showScannerDraftNotice && (
                <aside
                  className="scanner-draft-notice logbook-section"
                  aria-label="Scanned draft verification notice"
                >
                  <div className="scanner-draft-notice-icon" aria-hidden="true">
                    ⚠️
                  </div>
                  <div>
                    <h3>Please verify scanned information before locking this sheet.</h3>
                    {scannerWarnings.length > 0 && (
                      <ul>
                        {scannerWarnings.map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    )}
                    <p>
                      All fields and lines can be corrected using the normal editing controls.
                    </p>
                  </div>
                </aside>
              )}

              <section
                className="entry-metrics logbook-section"
                aria-label={t("details.summaryAria")}
              >
                <article>
                  <span>{t("compliance.motorMiles")}</span>
                  <strong>{activeSheetSummary.motorMiles} nm</strong>
                </article>
                <article>
                  <span>{t("compliance.sailMiles")}</span>
                  <strong>{activeSheetSummary.sailMiles} nm</strong>
                </article>
                <article>
                  <span>{t("logbooks.totalMiles")}</span>
                  <strong>{activeSheetSummary.totalMiles} nm</strong>
                </article>
                <article>
                  <span>{t("details.duration")}</span>
                  <strong>{activeSheetSummary.duration}</strong>
                </article>
              </section>

              <article className="table-card">
                <div className="table-header">
                  <div><h3>{t("details.logTitle")}</h3></div>
                  <div className="table-actions">
                    <button type="button" onClick={() => setCoordinateFormat((format) => format === "decimal" ? "dms" : "decimal")}>{t("details.coordinates")}: {coordinateFormat === "decimal" ? t("details.decimal") : "DMS"}</button>
                    <button type="button" onClick={() => setShowCourseColumns((show) => !show)}>{showCourseColumns ? t("details.hide") : t("details.show")} {t("details.courseColumns")}</button>
                    <button type="button" disabled={isActiveSheetLocked} onClick={startAddingLine}>{t("details.addLine")}</button>
                    <button type="button" disabled={isActiveSheetLocked} onClick={startAddingLineHereNow}>{t("details.addLineHereNow")}</button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className={showCourseColumns ? "log-lines-table with-course-columns" : "log-lines-table"}>
                    <thead>
                      <tr className="column-groups">
                        <th colSpan={3}>{t("details.timePos")}</th><th colSpan={6}>{t("details.weatherSea")}</th><th colSpan={showCourseColumns ? 9 : 2}>{t("details.course")}</th><th colSpan={4}>{t("details.travel")}</th><th>{t("details.remarks")}</th><th colSpan={2}>{t("details.actions")}</th>
                      </tr>
                      <tr>
                        <th>{t("details.time")}</th><th>{t("details.lat")}</th><th>{t("details.lon")}</th><th>{t("details.weather")}</th><th>{t("details.baro")}</th><th>{t("details.wind")}</th><th>{t("details.sea")}</th><th>{t("details.tide")}</th><th>{t("details.moon")}</th><th>{t("details.course.compass")}</th>
                        {showCourseColumns && courseConversionColumnKeys.map((key) => <th key={key}>{t(key)}</th>)}
                        <th>{t("details.course.overGround")}</th><th>{t("details.speed")}</th><th>{t("details.log")}</th><th>{t("details.sail")}</th><th>{t("details.motor")}</th><th>{t("details.remarksEvent")}</th><th>{t("details.edit")}</th><th>{t("common.delete")}</th>
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
                aria-label={t("details.sheetSupport")}
              >
                <article className="info-card logbook-section">
                  <h3>{t("crew.list")}</h3>
                  <ul className="stack-list crew-assignment-list">
                    {activeSheet.crew.map((person, index) => {
                      return (
                        <li key={`${person.id}-${index}`}>
                          <div className="crew-assignment-main">
                            <strong>
                              {index + 1}. {index === 0 ? `⭐ ${t("crew.skipper")} · ` : ""}
                              {person.name}
                            </strong>
                            <span>
                              {person.nationality} · {person.role}
                            </span>
                            <div className="crew-assignment-fields">
                              <span>{t("common.from")}</span>
                              <input
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.fromDateTime")}`}
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
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.fromPosition")}`}
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
                              <span>{t("common.to")}</span>
                              <input
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.toDateTime")}`}
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
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.toPosition")}`}
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
                    {t("crew.addMember")}
                    <select
                      disabled={isActiveSheetLocked}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          addCrewToActiveSheet(e.target.value);
                        e.currentTarget.value = "";
                      }}
                    >
                      <option value="">{t("crew.select")}</option>
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
                  <h3>{t("details.technicalLog")}</h3>
                  <ul className="check-list">
                    {[
                      ...activeSheet.watchPlan,
                      ...activeSheet.technicalChecks,
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="map-card logbook-section logbook-sheet-map-section">
                  <div className="logbook-map-heading">
                    <h3>{t("details.positions")}</h3>
                    <button
                      className="edit-chip"
                      type="button"
                      onClick={() => setIsMapExpanded(true)}
                    >
                      {t("details.fullMap")}
                    </button>
                  </div>
                  <LogLinesMapView logLines={activeSheet.lines} />
                </article>
              </section>
              {isMapExpanded && (
                <div
                  className="logbook-map-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="logbook-map-modal-title"
                >
                  <div className="logbook-map-modal-panel">
                    <div className="logbook-map-modal-heading">
                      <h2 id="logbook-map-modal-title">
                        {t("details.positions")}
                      </h2>
                      <button
                        className="edit-chip"
                        type="button"
                        onClick={() => setIsMapExpanded(false)}
                      >
                        {t("details.closeMap")}
                      </button>
                    </div>
                    <LogLinesMapView
                      className="open-seamap-expanded"
                      logLines={activeSheet.lines}
                    />
                  </div>
                </div>
              )}
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

"use client";

import { useState } from "react";
import type { LogSheet } from "../../models/logbook";
import { coordinateToInput, nextCoordinateFormat, type CoordinateFormat } from "../../domain/nautical/coordinates";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import { useI18n } from "../../lib/i18n";

const courseColumns = [
  ["compassCourse", "compass"], ["deviation", "deviation"], ["magneticCourse", "magnetic"],
  ["variation", "variation"], ["trueCourse", "true"], ["windDrift", "windDrift"],
  ["courseThroughWater", "throughWater"], ["currentDrift", "currentDrift"], ["courseOverGround", "overGround"],
] as const;

type Props = { sheet: LogSheet; engineLabels?: Record<string, string> };

export function SharedLogSheetDetails({ sheet, engineLabels = {}, initialCoordinateFormat = "decimal", initialShowCourseColumns = false }: Props & { initialCoordinateFormat?: CoordinateFormat; initialShowCourseColumns?: boolean }) {
  const { t } = useI18n();
  const { formatTime } = useDateTimeFormat();
  const [coordinateFormat, setCoordinateFormat] = useState(initialCoordinateFormat);
  const [showCourseColumns, setShowCourseColumns] = useState(initialShowCourseColumns);
  const columns = courseColumns.filter(([field]) => showCourseColumns || field === "compassCourse" || field === "courseOverGround");
  return <article className="table-card">
    <div className="table-header"><h3>{t("details.logTitle")}</h3><div className="table-actions">
      <button type="button" onClick={() => setCoordinateFormat(nextCoordinateFormat(coordinateFormat))}>{t("details.coordinates")}: {t(coordinateFormat === "decimal" ? "profile.coordinateDecimal" : coordinateFormat === "ddm" ? "profile.coordinateDdm" : "profile.coordinateDms")}</button>
      <button type="button" aria-expanded={showCourseColumns} onClick={() => setShowCourseColumns(!showCourseColumns)}>{t(showCourseColumns ? "details.hide" : "details.show")} {t("details.courseColumns")}</button>
    </div></div>
    <div className="table-scroll"><table className={showCourseColumns ? "log-lines-table with-course-columns" : "log-lines-table"}>
      <thead><tr className="column-groups"><th colSpan={4}>{t("details.timePos")}</th><th colSpan={8}>{t("details.weatherSea")}</th><th colSpan={columns.length}>{t("details.course")}</th><th colSpan={4}>{t("details.travel")}</th><th>{t("details.remarks")}</th></tr>
        <tr><th scope="col" aria-label="Log line number">#</th>{(["time", "lat", "lon", "weather", "weatherRemark", "temperature", "baro", "wind", "sea", "tide", "moon"] as const).map(key => <th scope="col" key={key}>{t(`details.${key}`)}</th>)}
          {columns.map(([field, key]) => <th scope="col" key={field} title={t(`details.course.${key}.description`)} className={field !== "compassCourse" && field !== "courseOverGround" ? "optional-course-cell" : undefined}>{t(`details.course.${key}`)}</th>)}
          {(["speed", "log", "sail", "motor", "remarksEvent"] as const).map(key => <th scope="col" key={key}>{t(`details.${key}`)}</th>)}
        </tr></thead>
      <tbody>{sheet.lines.map((line, index) => <tr key={line.id}>
        <td>{index + 1}</td><td>{formatTime(line.time)}</td><td>{coordinateToInput(line.latitude, "lat", coordinateFormat)}{line.position ? <div className="shared-log-text">{line.position}</div> : null}</td><td>{coordinateToInput(line.longitude, "lon", coordinateFormat)}</td>
        <td>{line.weather}</td><td className="shared-log-text">{line.weatherRemark}</td><td>{line.temperature} {line.temperatureUnit}</td><td>{line.barometer}</td><td>{line.windDirection} {line.windStrength} {line.windUnit}</td><td>{line.waves} {line.seaUnit}</td><td>{line.tide} {line.tideUnit}</td><td>{line.moon}</td>
        {columns.map(([field]) => <td key={field} className={field !== "compassCourse" && field !== "courseOverGround" ? "optional-course-cell" : undefined}>{line[field]}</td>)}
        <td>{line.speedKn}</td><td>{line.logNm}</td><td><span className="log-line-distance-summary">{line.sailMiles} nm</span><div className="shared-log-text">{line.sailNote}</div></td>
        <td><span className="log-line-distance-summary">{line.motorMiles} nm{Object.entries(line.engineHours ?? {}).map(([id, hours]) => ` · ${engineLabels[id] ?? id} ${hours} h`)}</span><div className="shared-log-text">{line.motorNote}</div></td><td className="shared-log-text">{line.remarks}</td>
      </tr>)}</tbody>
    </table></div>
  </article>;
}

export function SharedTechnicalLog({ sheet, engineLabels = {} }: Props) {
  const { t } = useI18n();
  const counters = Object.entries(sheet.engineHourCounters ?? {});
  return <article className="info-card logbook-section"><h3>{t("details.technicalLog")}</h3>
    {counters.length > 0 ? <section className="engine-hour-counter-section"><h4>{t("details.engineHourCounters")}</h4><div className="table-scroll"><table className="engine-hour-counter-table">
      <thead><tr><th scope="col">{t("details.counterReading")}</th>{counters.map(([id]) => <th scope="col" key={id}>{engineLabels[id] ?? id}</th>)}</tr></thead>
      <tbody>{(["start", "end"] as const).map(boundary => <tr key={boundary}><th scope="row">{t(boundary === "start" ? "details.counterStart" : "details.counterEnd")}</th>{counters.map(([id, reading]) => <td key={id}>{reading[boundary] === undefined ? "—" : `${reading[boundary]} h`}</td>)}</tr>)}
        <tr><th scope="row">{t("details.counterDifference")}</th>{counters.map(([id, reading]) => <td key={id}>{reading.start === undefined || reading.end === undefined ? "—" : `${(reading.end - reading.start).toFixed(1)} h`}</td>)}</tr>
        {sheet.lines.length > 0 ? <tr><th scope="row">{t("details.trackedOnSheet")}</th>{counters.map(([id]) => <td key={id}>{sheet.lines.reduce((total, line) => total + (line.engineHours?.[id] ?? 0), 0).toFixed(1)} h</td>)}</tr> : null}
      </tbody></table></div></section> : null}
    <h4>{t("details.checks")}</h4><ul className="stack-list">{sheet.technicalChecks.map((item, index) => <li key={index}><span aria-label={`Check status ${index + 1}`}>{item.status}</span><span className="shared-log-text">{item.text}</span></li>)}</ul>
  </article>;
}

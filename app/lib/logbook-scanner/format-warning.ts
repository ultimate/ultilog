import type { TranslationKey } from "../i18n";
import type { ScannerWarning } from "../../models/logbook";
import type { LineFormField } from "../../models/logbook-forms";

const fieldKeys: Partial<Record<LineFormField, TranslationKey>> = {
  time: "details.time", position: "details.scanner.field.position", latitude: "details.lat", longitude: "details.lon",
  compassCourse: "details.course.compass", deviation: "details.course.deviation", magneticCourse: "details.course.magnetic",
  variation: "details.course.variation", trueCourse: "details.course.true", windDrift: "details.course.windDrift",
  courseThroughWater: "details.course.throughWater", currentDrift: "details.course.currentDrift", courseOverGround: "details.course.overGround",
  weather: "details.weather", weatherRemark: "details.weatherRemark", temperature: "details.temperature", temperatureUnit: "details.temperature",
  barometer: "details.baro", windDirection: "details.wind", windStrength: "details.wind", windUnit: "details.wind",
  waves: "details.sea", seaUnit: "details.sea", tide: "details.tide", tideUnit: "details.tide", moon: "details.moon",
  speedKn: "details.speed", logNm: "details.log", sailMiles: "details.sail", sailNote: "details.sail",
  motorMiles: "details.motor", motorHours: "details.motor", motorNote: "details.motor", remarks: "details.remarksEvent",
};

export function formatScannerWarning(warning: ScannerWarning, t: (key: TranslationKey) => string) {
  if (warning.code === "scannerGenerated") return warning.fallbackMessage ?? t("details.scanner.warning.unknown");
  const template = t(`details.scanner.warning.${warning.code}` as TranslationKey);
  const fields = (warning.fields ?? []).map(field => fieldKeys[field] ? t(fieldKeys[field]!) : field).join(", ");
  return template.replace("{row}", String(warning.row ?? "")).replace("{fields}", fields);
}

import { lineFormToLogLine } from "../../domain/log-lines/log-line-form";
import type {
  CrewMember,
  LineForm,
  LogLine,
  LogSheet,
  PersistedLogbook,
  ScannerResult,
  SheetCrewMember,
  TemperatureUnit,
  WindUnit,
} from "../../models/logbook";
import type { UserPreferences } from "../users";
import { normalizeIsoDate } from "../iso-date";
import { normalizeScannedWeather } from "./weather";
import { normalizeTechnicalCheck } from "../../domain/logbook/technical-log";

type CurrentUserCrew = Partial<CrewMember> & Pick<CrewMember, "name">;

export type CreateScannedSheetInput = {
  scannerResult: ScannerResult;
  boatId: string;
  currentUser?: CurrentUserCrew;
  primaryCrew?: CrewMember;
  logbook: PersistedLogbook;
  userPreferences?: ScannerUnitPreferences;
  technicalLogTemplate?: LogSheet["technicalChecks"];
  engineIds?: string[];
};

type ScannerUnitPreferences = Pick<UserPreferences, "windUnit" | "waterHeightUnit" | "temperatureUnit">;

const verificationNote = "Please verify scanned information before locking this sheet.";
const rolloverEndDateWarning = { code: "rolloverExceededEndDate" } as const;

const defaultLineForm: LineForm = {
  id: "",
  time: "",
  position: "",
  latitude: "",
  longitude: "",
  weather: "",
  weatherRemark: "",
  temperature: "",
  temperatureUnit: "°C",
  barometer: "",
  windDirection: "",
  windStrength: "",
  windUnit: "bft",
  waves: "",
  seaUnit: "m",
  tide: "",
  tideUnit: "m",
  moon: "",
  compassCourse: "",
  deviation: "",
  magneticCourse: "",
  variation: "",
  trueCourse: "",
  windDrift: "",
  courseThroughWater: "",
  currentDrift: "",
  courseOverGround: "",
  speedKn: "",
  logNm: "",
  sailMiles: "",
  sailNote: "",
  motorMiles: "",
  motorHours: "",
  engineHours: {},
  motorNote: "",
  remarks: "",
};

export function createScannedSheet({
  scannerResult,
  boatId,
  currentUser,
  primaryCrew,
  logbook,
  userPreferences,
  technicalLogTemplate = [],
  engineIds = [],
}: CreateScannedSheetInput): LogSheet {
  const draft = scannerResult.draft;
  const extractedRoute = {
    from: draft.route?.from ?? "",
    to: draft.route?.to ?? "",
    departed: draft.route?.departed ?? "",
    arrived: draft.route?.arrived ?? "",
  };
  const { startDate, endDate } = dateBoundsFromSheetMasterData(draft.dateText, extractedRoute);
  const fallbackDate = startDate || new Date().toISOString().slice(0, 10);
  const route = {
    ...extractedRoute,
    departed: normalizeScannerRouteStamp(extractedRoute.departed, fallbackDate),
    arrived: normalizeScannerRouteStamp(extractedRoute.arrived, endDate || fallbackDate),
  };
  const normalizedLines = scannedLinesToLogLines(draft.lines, userPreferences, startDate, endDate);
  const warningDiagnostics = [...scannerResult.warnings];
  if (normalizedLines.rolloverExceededEndDate && !warningDiagnostics.some(warning => warning.code === rolloverEndDateWarning.code)) warningDiagnostics.push(rolloverEndDateWarning);
  const scannerWarnings = warningDiagnostics.map((warning) => ({ id: createId(), ...warning }));

  return {
    id: createId(),
    title: draft.title?.trim() || "Scanned log sheet",
    status: "Draft",
    source: "scanner",
    verificationNote,
    scannerWarnings,
    boatId,
    route,
    crew: createInitialCrew({ logbook, primaryCrew, currentUser, route }),
    watchPlan: [],
    technicalChecks: mergeTechnicalChecks(technicalLogTemplate, draft.technicalChecks ?? []),
    engineHourCounters: scannedEngineHourCounters(draft.engineHourCounters ?? [], engineIds),
    lines: normalizedLines.lines,
  };
}

function mergeTechnicalChecks(template: LogSheet["technicalChecks"], scanned: LogSheet["technicalChecks"]) {
  const validScanned = scanned.map(normalizeTechnicalCheck).filter((check): check is NonNullable<typeof check> => Boolean(check));
  const byText = new Map(validScanned.map((check) => [normalizeLabel(check.text), check]));
  const configured = template.map((check) => byText.get(normalizeLabel(check.text)) ?? check);
  const configuredLabels = new Set(template.map((check) => normalizeLabel(check.text)));
  return [...configured, ...validScanned.filter((check) => !configuredLabels.has(normalizeLabel(check.text)))];
}

function normalizeLabel(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

function scannedEngineHourCounters(scanned: NonNullable<ScannerResult["draft"]["engineHourCounters"]>, engineIds: string[]) {
  const allowed = new Set(engineIds);
  return Object.fromEntries(scanned.flatMap(({ engineId, start, end }) => {
    if (!allowed.has(engineId)) return [];
    const values = { start: parseCounter(start), end: parseCounter(end) };
    const counter = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== undefined));
    return Object.keys(counter).length ? [[engineId, counter]] : [];
  }));
}

function parseCounter(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function scannedLinesToLogLines(
  scannedLines: ScannerResult["draft"]["lines"],
  userPreferences: ScannerUnitPreferences | undefined,
  startDate: string,
  endDate: string,
) {
  let activeDate = startDate;
  let previousMinutes: number | undefined;
  let rolloverExceededEndDate = false;

  const lines = scannedLines.map((scannedLine) => {
    const scannedTime = scannedLine.time ?? "";
    const explicitDate = normalizeScannedDate(scannedTime);
    const timeOnly = parseTimeOnly(scannedTime);
    const explicitMinutes = minutesFromTimestamp(scannedTime);

    if (explicitDate) {
      activeDate = explicitDate;
      previousMinutes = explicitMinutes;
      return scannedLineToLogLine(scannedLine, userPreferences, scannedTime);
    }

    if (timeOnly && activeDate) {
      if (previousMinutes !== undefined && timeOnly.minutes < previousMinutes) {
        const nextDate = addDays(activeDate, 1);
        if (endDate && nextDate > endDate) {
          activeDate = endDate;
          rolloverExceededEndDate = true;
        } else {
          activeDate = nextDate;
        }
      }
      previousMinutes = timeOnly.minutes;
      return scannedLineToLogLine(scannedLine, userPreferences, `${activeDate}T${timeOnly.text}`);
    }

    return scannedLineToLogLine(scannedLine, userPreferences, scannedTime);
  });

  return { lines, rolloverExceededEndDate };
}

function scannedLineToLogLine(scannedLine: ScannerResult["draft"]["lines"][number], userPreferences: ScannerUnitPreferences | undefined, normalizedTime: string): LogLine {
  return lineFormToLogLine({
    ...defaultLineForm,
    ...scannerUnitDefaults(userPreferences),
    ...scannedLine,
    time: normalizedTime,
    weather: normalizeScannedWeather(scannedLine.weather),
    ...missingScannerUnitDefaults(scannedLine, userPreferences),
  });
}

function scannerUnitDefaults(userPreferences?: ScannerUnitPreferences): Pick<LineForm, "windUnit" | "seaUnit" | "tideUnit" | "temperatureUnit"> {
  return {
    windUnit: userPreferences?.windUnit ?? defaultLineForm.windUnit as WindUnit,
    seaUnit: userPreferences?.waterHeightUnit ?? defaultLineForm.seaUnit,
    tideUnit: userPreferences?.waterHeightUnit ?? defaultLineForm.tideUnit,
    temperatureUnit: userPreferences?.temperatureUnit ?? defaultLineForm.temperatureUnit as TemperatureUnit,
  };
}

function missingScannerUnitDefaults(scannedLine: ScannerResult["draft"]["lines"][number], userPreferences?: ScannerUnitPreferences): Partial<Pick<LineForm, "windUnit" | "seaUnit" | "tideUnit" | "temperatureUnit">> {
  const defaults = scannerUnitDefaults(userPreferences);
  return Object.fromEntries(
    (Object.keys(defaults) as (keyof typeof defaults)[])
      .filter((unitField) => !scannedLine[unitField]?.trim())
      .map((unitField) => [unitField, defaults[unitField]]),
  );
}

function createInitialCrew({
  logbook,
  primaryCrew,
  currentUser,
  route,
}: Pick<CreateScannedSheetInput, "logbook" | "primaryCrew" | "currentUser"> & { route: LogSheet["route"] }): SheetCrewMember[] {
  const crew = primaryCrew ?? logbook.crewMembers.find((member) => member.isPrimary) ?? currentUser;
  if (!crew) return [];

  return [
    {
      id: crew.id ?? createId(),
      name: crew.name,
      nationality: crew.nationality ?? "",
      role: crew.role ?? "",
      address: crew.address ?? "",
      certificate: crew.certificate ?? "",
      isPrimary: crew.isPrimary ?? true,
      embarkationDateTime: dateTimeLocalFromStamp(route.departed),
      embarkationPosition: route.from,
      disembarkationDateTime: dateTimeLocalFromStamp(route.arrived),
      disembarkationPosition: route.to,
    },
  ];
}

function createId() {
  return crypto.randomUUID();
}

function dateBoundsFromSheetMasterData(dateText: string | undefined, route: LogSheet["route"]) {
  const rangeDates = scannedDates(dateText ?? "");
  const departureDate = normalizeScannedDate(route.departed);
  const arrivalDate = normalizeScannedDate(route.arrived);
  return {
    startDate: rangeDates[0] || departureDate || arrivalDate,
    endDate: arrivalDate || (rangeDates.length > 1 ? rangeDates[rangeDates.length - 1] : ""),
  };
}

function normalizeScannedDate(value: string) {
  return scannedDates(value)[0] ?? normalizeIsoDate(value.split(",")[0]) ?? "";
}

function normalizeScannerRouteStamp(value: string, fallbackDate: string) {
  if (!value.trim()) return `${fallbackDate}T00:00:00+00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.trim())) return value.trim();
  const date = normalizeScannedDate(value) || fallbackDate;
  const time = value.match(/(?:T|,?\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!time) return `${date}T00:00:00+00:00`;
  return `${date}T${time[1].padStart(2, "0")}:${time[2]}:${time[3] ?? "00"}+00:00`;
}

function scannedDates(value: string) {
  const isoDates = [...value.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)]
    .map((match) => `${match[1]}-${match[2]}-${match[3]}`);
  if (isoDates.length > 0) return isoDates;

  const normalizedDate = normalizeIsoDate(value);
  if (normalizedDate) return [normalizedDate];

  return [...value.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/g)].map((match) => {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  });
}

function parseTimeOnly(value: string) {
  const timeOnly = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeOnly) return undefined;

  const hours = timeOnly[1].padStart(2, "0");
  const seconds = timeOnly[3] ? `:${timeOnly[3]}` : "";
  return { text: `${hours}:${timeOnly[2]}${seconds}`, minutes: Number(hours) * 60 + Number(timeOnly[2]) };
}

function minutesFromTimestamp(value: string) {
  const time = value.match(/[T, ](\d{1,2}):(\d{2})/);
  return time ? Number(time[1]) * 60 + Number(time[2]) : undefined;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateTimeLocalFromStamp(value: string) {
  const withTime = value.match(/^(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2})/);
  if (withTime) return `${withTime[1]}T${withTime[2]}`;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? `${dateOnly[1]}T00:00` : "";
}

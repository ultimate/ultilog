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

type CurrentUserCrew = Partial<CrewMember> & Pick<CrewMember, "name">;

export type CreateScannedSheetInput = {
  scannerResult: ScannerResult;
  boatId: string;
  currentUser?: CurrentUserCrew;
  primaryCrew?: CrewMember;
  logbook: PersistedLogbook;
  userPreferences?: ScannerUnitPreferences;
};

type ScannerUnitPreferences = Pick<UserPreferences, "windUnit" | "waterHeightUnit" | "temperatureUnit">;

const verificationNote = "Please verify scanned information before locking this sheet.";

const defaultLineForm: LineForm = {
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
}: CreateScannedSheetInput): LogSheet {
  const draft = scannerResult.draft;
  const route = {
    from: draft.route?.from ?? "",
    to: draft.route?.to ?? "",
    departed: draft.route?.departed ?? "",
    arrived: draft.route?.arrived ?? "",
  };
  const scannedDate = dateFromSheetMasterData(draft.dateRange, route);
  const dateRange = draft.dateRange?.trim() || scannedDate || new Date().toISOString().slice(0, 10);

  return {
    id: createId(),
    title: draft.title?.trim() || "Scanned log sheet",
    dateRange,
    status: "Draft",
    source: "scanner",
    verificationNote,
    scannerWarnings: scannerResult.warnings,
    boatId,
    route,
    crew: createInitialCrew({ logbook, primaryCrew, currentUser, route }),
    watchPlan: [],
    technicalChecks: [],
    lines: draft.lines.map((line) => scannedLineToLogLine(line, userPreferences, scannedDate)),
  };
}

function scannedLineToLogLine(scannedLine: ScannerResult["draft"]["lines"][number], userPreferences?: ScannerUnitPreferences, scannedDate = ""): LogLine {
  return lineFormToLogLine({
    ...defaultLineForm,
    ...scannerUnitDefaults(userPreferences),
    ...scannedLine,
    time: dateTimeFromScannedMasterDate(scannedLine.time ?? "", scannedDate),
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

function dateFromSheetMasterData(dateRange: string | undefined, route: LogSheet["route"]) {
  return normalizeScannedDate(dateRange ?? "") || normalizeScannedDate(route.departed) || normalizeScannedDate(route.arrived);
}

function normalizeScannedDate(value: string) {
  const isoDate = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const dayFirstDate = value.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/);
  if (!dayFirstDate) return "";
  const year = dayFirstDate[3].length === 2 ? `20${dayFirstDate[3]}` : dayFirstDate[3];
  const month = dayFirstDate[2].padStart(2, "0");
  const day = dayFirstDate[1].padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeFromScannedMasterDate(value: string, scannedDate: string) {
  if (!scannedDate) return value;
  const timeOnly = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeOnly) return value;

  const hours = timeOnly[1].padStart(2, "0");
  const seconds = timeOnly[3] ? `:${timeOnly[3]}` : "";
  return `${scannedDate}T${hours}:${timeOnly[2]}${seconds}`;
}

function dateTimeLocalFromStamp(value: string) {
  const withTime = value.match(/^(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2})/);
  if (withTime) return `${withTime[1]}T${withTime[2]}`;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? `${dateOnly[1]}T00:00` : "";
}

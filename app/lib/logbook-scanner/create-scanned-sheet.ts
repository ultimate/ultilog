import { lineFormToLogLine } from "../../domain/log-lines/log-line-form";
import type {
  CrewMember,
  LineForm,
  LogLine,
  LogSheet,
  PersistedLogbook,
  ScannerResult,
  SheetCrewMember,
} from "../../models/logbook";

type CurrentUserCrew = Partial<CrewMember> & Pick<CrewMember, "name">;

export type CreateScannedSheetInput = {
  scannerResult: ScannerResult;
  boatId: string;
  currentUser?: CurrentUserCrew;
  primaryCrew?: CrewMember;
  logbook: PersistedLogbook;
};

const verificationNote = "Please verify scanned information before locking this sheet.";

const defaultLineForm: LineForm = {
  time: "",
  position: "",
  latitude: "",
  longitude: "",
  weather: "",
  weatherRemark: "",
  temperature: "",
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
  sailSm: "",
  sailNote: "",
  motorSm: "",
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
}: CreateScannedSheetInput): LogSheet {
  const draft = scannerResult.draft;
  const route = {
    from: draft.route?.from ?? "",
    to: draft.route?.to ?? "",
    departed: draft.route?.departed ?? "",
    arrived: draft.route?.arrived ?? "",
  };

  return {
    id: createId(),
    title: draft.title?.trim() || "Scanned log sheet",
    dateRange: draft.dateRange?.trim() || dateFromRoute(route.departed) || dateFromRoute(route.arrived) || new Date().toISOString().slice(0, 10),
    status: "Draft",
    source: "scanner",
    verificationNote,
    scannerWarnings: scannerResult.warnings,
    boatId,
    route,
    crew: createInitialCrew({ logbook, primaryCrew, currentUser, route }),
    watchPlan: [],
    technicalChecks: [],
    lines: draft.lines.map(scannedLineToLogLine),
  };
}

function scannedLineToLogLine(scannedLine: ScannerResult["draft"]["lines"][number]): LogLine {
  return lineFormToLogLine({ ...defaultLineForm, ...scannedLine });
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

function dateFromRoute(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function dateTimeLocalFromStamp(value: string) {
  const withTime = value.match(/^(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2})/);
  if (withTime) return `${withTime[1]}T${withTime[2]}`;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? `${dateOnly[1]}T00:00` : "";
}

import { defaultDeviationTable, normalizeDeviationTable, type Boat, type BoatForm, type CrewForm, type LineForm, type LogLine, type LogSheet, type PersistedLogbook, type SheetForm } from "../../models/logbook";
import { sampleBoats, sampleLogSheets } from "../../../resources/sample-data/logbook";

export const seedBoats = sampleBoats;
export const seedSheets = sampleLogSheets;
export const defaultLogbook: PersistedLogbook = { boats: seedBoats, crewMembers: crewProfilesFromSheets(seedSheets), sheets: seedSheets };

export const defaultSheetForm = (boatId: string): SheetForm => ({ title: "", status: "Draft", dateRange: new Date().toISOString().slice(0, 10), boatId, from: "", to: "", fromTime: "", toTime: "" });
export const defaultBoatForm: BoatForm = { name: "", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", manufacturer: "", mmsi: "", engine: "", safety: "", deviationTable: defaultDeviationTable() };
export const defaultLineForm: LineForm = { time: "", position: "", latitude: "", longitude: "", weather: "", weatherRemark: "", temperature: "", temperatureUnit: "°C", barometer: "", windDirection: "", windStrength: "", windUnit: "bft", waves: "", seaUnit: "m", tide: "", tideUnit: "m", moon: "", compassCourse: "", deviation: "", magneticCourse: "", variation: "", trueCourse: "", windDrift: "", courseThroughWater: "", currentDrift: "", courseOverGround: "", speedKn: "", logNm: "", sailMiles: "", sailNote: "", motorMiles: "", motorHours: "", motorNote: "", remarks: "" };
export const defaultCrewForm: CrewForm = { id: "", name: "", nationality: "", role: "", address: "", certificate: "", isPrimary: false };

export const boatToForm = (boat: Boat): BoatForm => ({ name: boat.name, type: boat.type, registration: boat.registration, flagState: boat.flagState, homePort: boat.homePort, owner: boat.owner, dimensions: boat.dimensions, manufacturer: boat.yachtData.Manufacturer === "—" ? "" : boat.yachtData.Manufacturer, mmsi: boat.yachtData.MMSI === "—" ? "" : boat.yachtData.MMSI, engine: boat.yachtData.Engine === "—" ? "" : boat.yachtData.Engine, safety: boat.yachtData.Safety === "To be completed" ? "" : boat.yachtData.Safety, deviationTable: normalizeDeviationTable(boat.deviationTable) });
export const sheetToForm = (sheet: LogSheet): SheetForm => ({ title: sheet.title, status: sheet.status, dateRange: sheet.dateRange, boatId: sheet.boatId, from: sheet.route.from, to: sheet.route.to, fromTime: timeFromRouteStamp(sheet.route.departed), toTime: timeFromRouteStamp(sheet.route.arrived) });
export const lineToForm = (line: LogLine): LineForm => Object.fromEntries(Object.entries(line).map(([key, value]) => [key, String(value ?? "")])) as LineForm;
export const crewToForm = (crew: Partial<CrewForm>): CrewForm => ({ id: crew.id ?? "", name: crew.name ?? "", nationality: crew.nationality ?? "", role: crew.role ?? "", address: crew.address ?? "", certificate: crew.certificate ?? "", isPrimary: crew.isPrimary ?? false });

function timeFromRouteStamp(value: string) {
  return value.match(/(\d{1,2}:\d{2})/)?.[1] ?? "";
}

function crewProfilesFromSheets(sheets: LogSheet[]) {
  const profiles = new Map<string, PersistedLogbook["crewMembers"][number]>();
  for (const sheet of sheets) {
    for (const member of sheet.crew) {
      const id = member.id || `${member.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${member.nationality.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (!profiles.has(id)) profiles.set(id, { id, name: member.name, nationality: member.nationality, role: member.role, address: member.address ?? "", certificate: member.certificate ?? "", isPrimary: member.isPrimary ?? false });
    }
  }
  return [...profiles.values()];
}

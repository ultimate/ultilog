import { defaultDeviationTable, normalizeDeviationTable, type Boat, type BoatForm, type CrewForm, type LineForm, type LogLine, type LogSheet, type PersistedLogbook, type SheetForm } from "../../models/logbook";
import { sampleBoats, sampleLogSheets } from "../../../resources/sample-data/logbook";

export const seedBoats = sampleBoats;
export const seedSheets = sampleLogSheets;
export const defaultLogbook: PersistedLogbook = { boats: seedBoats, sheets: seedSheets };

export const defaultSheetForm = (boatId: string): SheetForm => ({ title: "", dateRange: new Date().toISOString().slice(0, 10), boatId, dayGoal: "", from: "", to: "", morningPosition: "", eveningPosition: "" });
export const defaultBoatForm: BoatForm = { name: "", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", manufacturer: "", mmsi: "", engine: "", safety: "", deviationTable: defaultDeviationTable() };
export const defaultLineForm: LineForm = { time: "", position: "", latitude: "", longitude: "", logNm: "", course: "", magneticCourse: "", seaState: "", barometer: "", wind: "", weather: "", sails: "", engine: "", remarks: "" };
export const defaultCrewForm: CrewForm = { name: "", nationality: "", role: "", embarkation: "", disembarkation: "" };

export const boatToForm = (boat: Boat): BoatForm => ({ name: boat.name, type: boat.type, registration: boat.registration, flagState: boat.flagState, homePort: boat.homePort, owner: boat.owner, dimensions: boat.dimensions, manufacturer: boat.yachtData.Manufacturer === "—" ? "" : boat.yachtData.Manufacturer, mmsi: boat.yachtData.MMSI === "—" ? "" : boat.yachtData.MMSI, engine: boat.yachtData.Engine === "—" ? "" : boat.yachtData.Engine, safety: boat.yachtData.Safety === "To be completed" ? "" : boat.yachtData.Safety, deviationTable: normalizeDeviationTable(boat.deviationTable) });
export const sheetToForm = (sheet: LogSheet): SheetForm => ({ title: sheet.title, dateRange: sheet.dateRange, boatId: sheet.boatId, dayGoal: sheet.route.dayGoal, from: sheet.route.from, to: sheet.route.to, morningPosition: sheet.route.morningPosition, eveningPosition: sheet.route.eveningPosition });
export const lineToForm = (line: LogLine): LineForm => ({ time: line.time, position: line.position, latitude: line.latitude.toString(), longitude: line.longitude.toString(), logNm: line.logNm.toString(), course: line.course, magneticCourse: line.magneticCourse, seaState: line.seaState, barometer: line.barometer, wind: line.wind, weather: line.weather, sails: line.sails, engine: line.engine, remarks: line.remarks });
export const crewToForm = (crew: CrewForm): CrewForm => ({ name: crew.name, nationality: crew.nationality, role: crew.role, embarkation: crew.embarkation, disembarkation: crew.disembarkation });

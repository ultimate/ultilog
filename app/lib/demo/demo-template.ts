import {
  type Boat,
  type CrewMember,
  type LogLine,
  type LogSheet,
  type PersistedLogbook,
  type SheetCrewMember,
} from "../../models/logbook";

export const DEMO_TEMPLATE_VERSION = 1;

export const DEMO_WEATHER_PROVENANCE = deepFreeze({
  source: "Open-Meteo Historical Weather API",
  url: "https://open-meteo.com/en/docs/historical-weather-api",
  note: "Weather values are representative historical-model demo data for the recorded positions and dates; they are not certified ship observations.",
});

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

type Waypoint = { name: string; latitude: number; longitude: number };
type Weather = { icon: string; remark: string; temperature: number; pressure: number; windDirection: string; windBft: number; waves: number };
type Day = {
  id: string;
  date: string;
  title: string;
  from: Waypoint;
  via: Waypoint;
  to: Waypoint;
  departure: string;
  midpoint: string;
  arrival: string;
  distance: number;
  course: number;
  weather: [Weather, Weather, Weather];
  summary: string;
};

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value as DeepReadonly<T>;
}

function demoDeviationTable(phaseShiftDegrees: number): Boat["deviationTable"] {
  return Array.from({ length: 36 }, (_, index) => {
    const heading = index * 10;
    const radians = ((heading + phaseShiftDegrees) * Math.PI) / 180;
    return { heading, deviation: Math.round(15 * Math.sin(radians)).toString() };
  });
}

const boats: Boat[] = [
  {
    id: "demo-boat-boreas",
    name: "SY Boreas",
    type: "Sail",
    registration: "CHE-7421",
    flagState: "Switzerland",
    homePort: "Basel",
    owner: "Ultilog Sailing Club",
    dimensions: "12.4 m · 7.8 t · CE category A",
    logfactor: 1.05,
    yachtData: {
      Manufacturer: "Hallberg-Rassy 40",
      MMSI: "269123456",
      Engine: "Volvo Penta D2-55 · 55 HP",
      Safety: "6-person liferaft, EPIRB, jacklines, MOB beacon",
    },
    deviationTable: demoDeviationTable(40),
  },
  {
    id: "demo-boat-aurora",
    name: "MY Aurora",
    type: "Motor",
    registration: "ST-19884",
    flagState: "Croatia",
    homePort: "Split",
    owner: "Ultilog Yacht Club",
    dimensions: "10.8 m · 6.1 t · CE category B",
    logfactor: 0.98,
    yachtData: {
      Manufacturer: "Beneteau Antares 11",
      MMSI: "238987650",
      Engine: "Twin Volvo Penta D4 · 2 × 220 HP",
      Safety: "6-person liferaft, EPIRB, flares, lifejackets",
    },
    deviationTable: demoDeviationTable(-70),
  },
];

const crewMembers: CrewMember[] = [
  { id: "demo-crew-nina", name: "Nina Baumann", nationality: "Swiss", role: "Skipper", address: "Seestrasse 10, 8002 Zürich", certificate: "ICC Coastal Waters · SRC", isPrimary: true },
  { id: "demo-crew-luca", name: "Luca Frei", nationality: "Swiss", role: "Co-skipper / navigation", certificate: "RYA Day Skipper · SRC" },
  { id: "demo-crew-sofia", name: "Sofia Marin", nationality: "Italian", role: "Watch leader", certificate: "Patente nautica · VHF" },
  { id: "demo-crew-jonas", name: "Jonas Meier", nationality: "German", role: "Deck crew / trainee" },
  { id: "demo-crew-mara", name: "Mara Novak", nationality: "Croatian", role: "Engineer / local pilot", certificate: "Boat Leader B · GMDSS" },
];

const ionianWeather: [Weather, Weather, Weather][] = [
  [{ icon: "☀️", remark: "Clear, light morning breeze and excellent visibility", temperature: 24, pressure: 1016, windDirection: "NNW", windBft: 2, waves: 0.3 }, { icon: "🌤️", remark: "Sunny intervals; afternoon sea breeze established", temperature: 29, pressure: 1015, windDirection: "NW", windBft: 4, waves: 0.8 }, { icon: "☀️", remark: "Clear and sheltered on approach", temperature: 27, pressure: 1014, windDirection: "NW", windBft: 3, waves: 0.3 }],
  [{ icon: "🌤️", remark: "Scattered high cloud, good visibility", temperature: 25, pressure: 1014, windDirection: "NW", windBft: 2, waves: 0.3 }, { icon: "☀️", remark: "Dry with a fresh northwesterly", temperature: 29, pressure: 1013, windDirection: "NW", windBft: 5, waves: 1.2 }, { icon: "🌤️", remark: "Wind easing close to the island", temperature: 27, pressure: 1013, windDirection: "WNW", windBft: 3, waves: 0.5 }],
  [{ icon: "⛅", remark: "Broken cloud with a gentle northerly", temperature: 24, pressure: 1015, windDirection: "N", windBft: 3, waves: 0.5 }, { icon: "🌤️", remark: "Bright intervals and moderate sea breeze", temperature: 28, pressure: 1014, windDirection: "NW", windBft: 4, waves: 0.9 }, { icon: "☀️", remark: "Clear evening; smooth water in the bay", temperature: 26, pressure: 1014, windDirection: "NW", windBft: 2, waves: 0.2 }],
  [{ icon: "☀️", remark: "Clear with calm water at departure", temperature: 23, pressure: 1017, windDirection: "N", windBft: 2, waves: 0.2 }, { icon: "🌤️", remark: "Northwesterly sea breeze, visibility over 10 NM", temperature: 28, pressure: 1016, windDirection: "NW", windBft: 4, waves: 0.8 }, { icon: "☀️", remark: "Clear, wind easing after sunset", temperature: 26, pressure: 1016, windDirection: "NW", windBft: 2, waves: 0.2 }],
];

const adriaticWeather: [Weather, Weather, Weather][] = [
  [{ icon: "🌤️", remark: "Thin cloud, calm harbor and good visibility", temperature: 22, pressure: 1018, windDirection: "NE", windBft: 2, waves: 0.2 }, { icon: "☀️", remark: "Dry and sunny with a westerly sea breeze", temperature: 27, pressure: 1017, windDirection: "W", windBft: 3, waves: 0.6 }, { icon: "☀️", remark: "Clear and sheltered in Vis harbor", temperature: 26, pressure: 1016, windDirection: "W", windBft: 2, waves: 0.2 }],
  [{ icon: "⛅", remark: "Broken cloud and light southeasterly", temperature: 22, pressure: 1015, windDirection: "SE", windBft: 2, waves: 0.3 }, { icon: "🌦️", remark: "Brief shower nearby; visibility remained good", temperature: 25, pressure: 1014, windDirection: "S", windBft: 4, waves: 0.9 }, { icon: "🌤️", remark: "Cloud clearing from the west", temperature: 24, pressure: 1014, windDirection: "SW", windBft: 2, waves: 0.3 }],
  [{ icon: "☀️", remark: "Clear morning and a light easterly", temperature: 21, pressure: 1017, windDirection: "E", windBft: 2, waves: 0.2 }, { icon: "☀️", remark: "Warm, dry and moderate west-northwesterly", temperature: 28, pressure: 1016, windDirection: "WNW", windBft: 3, waves: 0.6 }, { icon: "🌤️", remark: "Fair weather and good visibility", temperature: 26, pressure: 1016, windDirection: "W", windBft: 2, waves: 0.3 }],
  [{ icon: "🌤️", remark: "High cloud with a gentle bora", temperature: 22, pressure: 1019, windDirection: "NE", windBft: 3, waves: 0.4 }, { icon: "☀️", remark: "Sunny; moderate northwesterly offshore", temperature: 27, pressure: 1018, windDirection: "NW", windBft: 4, waves: 0.8 }, { icon: "☀️", remark: "Clear on final approach to Split", temperature: 25, pressure: 1018, windDirection: "NW", windBft: 2, waves: 0.2 }],
];

const ionianDays: Day[] = [
  day("ionian-1", "2025-09-08", "Ionian Islands training cruise · Day 1", ["Preveza Marina", 38.956, 20.754], ["Lefkada Canal", 38.84, 20.72], ["Nidri", 38.708, 20.716], "07:40", "11:15", "15:50", 28, 176, ionianWeather[0], "Canal transit and close-quarters sail handling practice."),
  day("ionian-2", "2025-09-09", "Ionian Islands training cruise · Day 2", ["Nidri", 38.708, 20.716], ["Meganisi east coast", 38.657, 20.794], ["Kioni, Ithaca", 38.448, 20.69], "08:10", "12:05", "16:35", 31, 190, ionianWeather[1], "Reefing drill followed by a passage south to Ithaca."),
  day("ionian-3", "2025-09-10", "Ionian Islands training cruise · Day 3", ["Kioni, Ithaca", 38.448, 20.69], ["North Kefalonia", 38.505, 20.615], ["Fiskardo", 38.459, 20.577], "08:35", "11:20", "14:45", 19, 252, ionianWeather[2], "Pilotage exercise around the Ithaca Channel and harbor approach."),
  day("ionian-4", "2025-09-11", "Ionian Islands training cruise · Day 4", ["Fiskardo", 38.459, 20.577], ["Lefkada west coast", 38.68, 20.56], ["Preveza Marina", 38.956, 20.754], "07:25", "12:30", "18:05", 48, 334, ionianWeather[3], "Return passage under sail with night-entry preparation review."),
];

const adriaticDays: Day[] = [
  day("adriatic-1", "2025-09-15", "Central Dalmatia motor cruise · Day 1", ["Split ACI Marina", 43.501, 16.429], ["Maslinica, Šolta", 43.398, 16.208], ["Vis town quay", 43.061, 16.184], "08:20", "11:30", "15:40", 36, 207, adriaticWeather[0], "Engine familiarization and open-water navigation to Vis."),
  day("adriatic-2", "2025-09-16", "Central Dalmatia motor cruise · Day 2", ["Vis town quay", 43.061, 16.184], ["Stiniva Bay", 43.022, 16.177], ["Komiža", 43.043, 16.09], "09:00", "12:10", "16:20", 21, 245, adriaticWeather[1], "Coastal pilotage and anchoring exercise on the south coast of Vis."),
  day("adriatic-3", "2025-09-17", "Central Dalmatia motor cruise · Day 3", ["Komiža", 43.043, 16.09], ["Biševo", 42.98, 16.01], ["Stari Grad, Hvar", 43.184, 16.599], "07:50", "12:00", "16:55", 43, 72, adriaticWeather[2], "Offshore leg via Biševo with radar and collision-avoidance practice."),
  day("adriatic-4", "2025-09-18", "Central Dalmatia motor cruise · Day 4", ["Stari Grad, Hvar", 43.184, 16.599], ["Milna, Brač", 43.327, 16.45], ["Split ACI Marina", 43.501, 16.429], "08:30", "12:15", "16:10", 32, 326, adriaticWeather[3], "Final return leg with MOB recovery and fuel-consumption check."),
];

function day(id: string, date: string, title: string, from: [string, number, number], via: [string, number, number], to: [string, number, number], departure: string, midpoint: string, arrival: string, distance: number, course: number, weather: [Weather, Weather, Weather], summary: string): Day {
  const waypoint = ([name, latitude, longitude]: [string, number, number]): Waypoint => ({ name, latitude, longitude });
  return { id, date, title, from: waypoint(from), via: waypoint(via), to: waypoint(to), departure, midpoint, arrival, distance, course, weather, summary };
}

function sheetCrew(memberIds: string[], from: Waypoint, to: Waypoint, date: string): SheetCrewMember[] {
  return memberIds.map((id) => ({
    ...crewMembers.find((member) => member.id === id)!,
    embarkationDateTime: `${date}T07:00`,
    embarkationPosition: from.name,
    disembarkationDateTime: `${date}T19:00`,
    disembarkationPosition: to.name,
  }));
}

function interpolateWaypoint(dayData: Day, fraction: number): Waypoint {
  const start = fraction <= 0.5 ? dayData.from : dayData.via;
  const end = fraction <= 0.5 ? dayData.via : dayData.to;
  const legFraction = fraction <= 0.5 ? fraction * 2 : (fraction - 0.5) * 2;
  if (fraction === 0) return dayData.from;
  if (fraction === 0.5) return dayData.via;
  if (fraction === 1) return dayData.to;
  return {
    name: `Underway · position ${Math.round(fraction * 100)}%`,
    latitude: start.latitude + ((end.latitude - start.latitude) * legFraction),
    longitude: start.longitude + ((end.longitude - start.longitude) * legFraction),
  };
}

function interpolateTime(date: string, departure: string, arrival: string, fraction: number): string {
  const start = new Date(`${date}T${departure}:00Z`).getTime();
  const end = new Date(`${date}T${arrival}:00Z`).getTime();
  return new Date(start + ((end - start) * fraction)).toISOString().slice(0, 16);
}

function weatherAt(dayData: Day, fraction: number): Weather {
  const scaled = fraction * 2;
  const lowerIndex = Math.min(Math.floor(scaled), 1);
  const upperIndex = Math.min(lowerIndex + 1, 2);
  const localFraction = scaled - lowerIndex;
  const lower = dayData.weather[lowerIndex];
  const upper = dayData.weather[upperIndex];
  const interpolate = (from: number, to: number) => Math.round((from + ((to - from) * localFraction)) * 10) / 10;
  const closest = localFraction < 0.5 ? lower : upper;
  return { ...closest, temperature: interpolate(lower.temperature, upper.temperature), pressure: interpolate(lower.pressure, upper.pressure), waves: interpolate(lower.waves, upper.waves) };
}

function logLine(dayData: Day, waypoint: Waypoint, time: string, index: number, count: number, boat: Boat): LogLine {
  const fraction = index / (count - 1);
  const weather = weatherAt(dayData, fraction);
  const underway = index < count - 1;
  const motorBoat = boat.type === "Motor";
  const distance = Math.round(dayData.distance * fraction * 10) / 10;
  const magneticCourse = underway ? (dayData.course + 356) % 360 : 0;
  const closestDeviation = underway ? boat.deviationTable.reduce((closest, row) => Math.abs(row.heading - magneticCourse) < Math.abs(closest.heading - magneticCourse) ? row : closest) : undefined;
  const deviation = Number(closestDeviation?.deviation ?? 0);
  const compassCourse = underway ? (magneticCourse - deviation + 360) % 360 : 0;
  const legDistance = index === 0 ? 0 : Math.round((dayData.distance / (count - 1)) * 10) / 10;
  return {
    time,
    position: waypoint.name,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    weather: weather.icon,
    weatherRemark: weather.remark,
    temperature: weather.temperature,
    temperatureUnit: "°C",
    barometer: weather.pressure,
    windDirection: weather.windDirection,
    windStrength: weather.windBft,
    windUnit: "bft",
    waves: weather.waves,
    seaUnit: "m",
    tide: 0.1,
    tideUnit: "m",
    moon: "🌘",
    compassCourse,
    deviation,
    magneticCourse,
    variation: underway ? 4 : 0,
    trueCourse: underway ? dayData.course : 0,
    windDrift: underway && !motorBoat ? 2 : 0,
    courseThroughWater: underway ? (dayData.course + (motorBoat ? 0 : 2)) % 360 : 0,
    currentDrift: underway ? 1 : 0,
    courseOverGround: underway ? dayData.course : 0,
    speedKn: index === count - 1 ? 0 : motorBoat ? 9.2 : 6.1,
    logNm: distance,
    sailMiles: motorBoat || index === 0 ? 0 : index === count - 1 ? Math.min(2, legDistance) : legDistance,
    sailNote: motorBoat ? "n/a" : index === 0 ? "Main and genoa set after departure" : index === count - 1 ? "Sails stowed" : "Main and genoa",
    motorMiles: motorBoat && index > 0 ? legDistance : !motorBoat && index === count - 1 ? 2 : 0,
    motorHours: motorBoat ? index === 0 ? 0.2 : Math.round((legDistance / 9.2) * 10) / 10 : index === count - 1 ? 0.4 : 0,
    motorNote: motorBoat ? (index === count - 1 ? "Engines stopped after mooring" : "Both engines, 1,900 rpm") : index === count - 1 ? "Harbor maneuver" : "Engine off",
    remarks: index === 0 ? `Departed after checks. ${dayData.summary}` : index === count - 1 ? "Moored safely; engine, shore power and passage records checked." : "Position fixed by GNSS and visual bearings; log and weather recorded.",
  };
}

function createSheet(dayData: Day, boat: Boat, memberIds: string[], index: number): LogSheet {
  const people = sheetCrew(memberIds, dayData.from, dayData.to, dayData.date);
  const lineCount = 7;
  const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
    const fraction = lineIndex / (lineCount - 1);
    return logLine(dayData, interpolateWaypoint(dayData, fraction), interpolateTime(dayData.date, dayData.departure, dayData.arrival, fraction), lineIndex, lineCount, boat);
  });
  const motorBoat = boat.type === "Motor";
  return {
    id: `demo-sheet-${dayData.id}`,
    title: dayData.title,
    dateRange: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dayData.date}T00:00:00Z`)),
    status: index === 3 ? "Draft" : "Locked",
    source: "manual",
    verificationNote: `Demo record. ${DEMO_WEATHER_PROVENANCE.note}`,
    boatId: boat.id,
    route: { from: dayData.from.name, to: dayData.to.name, departed: `${dayData.date}T${dayData.departure}`, arrived: `${dayData.date}T${dayData.arrival}` },
    crew: people,
    watchPlan: motorBoat ? [`${dayData.departure}–12:00: Mara / Nina`, `12:00–${dayData.arrival}: Nina / ${index % 2 ? "Jonas" : "Luca"}`] : [`${dayData.departure}–12:00: Nina / Jonas`, `12:00–16:00: Luca / Sofia`, `16:00–${dayData.arrival}: Sofia / Nina`],
    technicalChecks: motorBoat ? ["Engine oil and coolant checked", "Fuel valves and raw-water seacocks open", "Bilges dry", "Steering and trim tabs tested", "VHF radio check completed"] : ["Engine oil and cooling water checked", "Rig and running rigging inspected", "Bilges dry", "Navigation lights and VHF tested", "Water and fuel levels logged"],
    lines,
  };
}

const ionianCrew = ["demo-crew-nina", "demo-crew-luca", "demo-crew-sofia", "demo-crew-jonas"];
const adriaticCrewByDay = [
  ["demo-crew-nina", "demo-crew-mara", "demo-crew-luca"],
  ["demo-crew-nina", "demo-crew-mara", "demo-crew-jonas"],
  ["demo-crew-nina", "demo-crew-mara", "demo-crew-sofia"],
  ["demo-crew-nina", "demo-crew-mara", "demo-crew-luca", "demo-crew-jonas"],
];

const template: PersistedLogbook = {
  boats,
  crewMembers,
  sheets: [
    ...ionianDays.map((dayData, index) => createSheet(dayData, boats[0], ionianCrew, index)),
    ...adriaticDays.map((dayData, index) => createSheet(dayData, boats[1], adriaticCrewByDay[index], index)),
  ],
};

export const DEMO_LOGBOOK_TEMPLATE: DeepReadonly<PersistedLogbook> = deepFreeze(template);

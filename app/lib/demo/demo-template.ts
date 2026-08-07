import {
  type Boat,
  type CrewMember,
  type LogLine,
  type LogSheet,
  type PersistedLogbook,
  type SheetCrewMember,
} from "../../models/logbook";

export const DEMO_TEMPLATE_VERSION = 2;

export const DEMO_WEATHER_PROVENANCE = deepFreeze({
  source: "Open-Meteo Historical Weather API",
  url: "https://open-meteo.com/en/docs/historical-weather-api",
  note: "Weather values are representative historical-model demo data for the recorded positions and dates; they are not certified ship observations.",
});

export const DEMO_ROUTE_PROVENANCE = deepFreeze({
  source: "Natural Earth 1:10m Land polygons",
  url: "https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/",
  note: "Every demo position and the straight connection to the following position was checked against the land polygons; harbor positions use navigable outer approaches where the coastline dataset does not resolve marina basins.",
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
type DemoWindDriftTable = {
  windSpeedLimits: { fullSail: string; secondReef: string; stormSail: string };
  rows: Array<{
    angle: "closeHauled" | "beamReach" | "broadReach";
    values: { fullSail: string; secondReef: string; stormSail: string };
  }>;
};
type DemoBoat = Boat & { windDriftTable: DemoWindDriftTable };
type Day = {
  id: string;
  date: string;
  title: string;
  from: Waypoint;
  via: Waypoint;
  to: Waypoint;
  track: Waypoint[];
  departure: string;
  midpoint: string;
  arrival: string;
  distance: number;
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

const boats: DemoBoat[] = [
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
      Safety: "6-person liferaft, EPIRB, jacklines, MOB beacon",
    },
    engines: [{ id: "main-engine", name: "Main engine", label: "Main", role: "propulsion", manufacturer: "Volvo Penta", model: "D2-55 · 55 HP" }],
    deviationTable: demoDeviationTable(40),
    windDriftTable: {
      windSpeedLimits: { fullSail: "0", secondReef: "17", stormSail: "28" },
      rows: [
        { angle: "closeHauled", values: { fullSail: "4", secondReef: "7", stormSail: "11" } },
        { angle: "beamReach", values: { fullSail: "3", secondReef: "5", stormSail: "8" } },
        { angle: "broadReach", values: { fullSail: "2", secondReef: "3", stormSail: "5" } },
      ],
    },
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
      Safety: "6-person liferaft, EPIRB, flares, lifejackets",
    },
    engines: [
      { id: "port-engine", name: "Port engine", label: "Port", role: "propulsion", manufacturer: "Volvo Penta", model: "D4 · 220 HP" },
      { id: "starboard-engine", name: "Starboard engine", label: "Stbd", role: "propulsion", manufacturer: "Volvo Penta", model: "D4 · 220 HP" },
    ],
    deviationTable: demoDeviationTable(-70),
    windDriftTable: {
      windSpeedLimits: { fullSail: "0", secondReef: "20", stormSail: "35" },
      rows: [
        { angle: "closeHauled", values: { fullSail: "1", secondReef: "2", stormSail: "3" } },
        { angle: "beamReach", values: { fullSail: "2", secondReef: "3", stormSail: "5" } },
        { angle: "broadReach", values: { fullSail: "1", secondReef: "2", stormSail: "3" } },
      ],
    },
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
  day("ionian-1", "2025-09-08", "Ionian Islands training cruise · Day 1", [["Preveza Marina", 38.956, 20.754], ["Preveza roads", 38.873, 20.74], ["Lefkada Canal north approach", 38.8315, 20.733], ["Lefkada Canal", 38.79, 20.726], ["Lefkada Canal south exit", 38.782, 20.73], ["Lefkada east coast", 38.73, 20.73], ["Nidri", 38.708, 20.716]], "07:40", "11:15", "15:50", 15, ionianWeather[0], "Canal transit and close-quarters sail handling practice."),
  day("ionian-2", "2025-09-09", "Ionian Islands training cruise · Day 2", [["Nidri", 38.708, 20.716], ["Nidri roads", 38.71, 20.72], ["Lefkada east coast", 38.706, 20.724], ["Meganisi west channel", 38.659, 20.724], ["Meganisi west channel", 38.612, 20.724], ["Ithaca north approach", 38.518, 20.724], ["Kioni approach, Ithaca", 38.456, 20.694]], "08:10", "12:05", "16:35", 16, ionianWeather[1], "Reefing drill followed by a passage south to Ithaca."),
  day("ionian-3", "2025-09-10", "Ionian Islands training cruise · Day 3", [["Kioni approach, Ithaca", 38.456, 20.694], ["Ithaca northeast coast", 38.48, 20.71], ["Ithaca north cape", 38.505, 20.7], ["Ithaca Channel north", 38.52, 20.66], ["North Kefalonia", 38.51, 20.62], ["Fiskardo approach", 38.48, 20.59], ["Fiskardo", 38.459, 20.58]], "08:35", "11:20", "14:45", 11, ionianWeather[2], "Pilotage exercise around the Ithaca Channel and harbor approach."),
  day("ionian-4", "2025-09-11", "Ionian Islands training cruise · Day 4", [["Fiskardo", 38.459, 20.58], ["North Kefalonia offing", 38.53, 20.62], ["Kefalonia northwest offing", 38.58, 20.48], ["Lefkada southwest offing", 38.7, 20.45], ["Lefkada west coast", 38.8, 20.5], ["Lefkada north approach", 38.88, 20.7], ["Preveza Marina", 38.956, 20.754]], "07:25", "12:30", "18:05", 41, ionianWeather[3], "Return passage under sail with night-entry preparation review."),
];

const adriaticDays: Day[] = [
  day("adriatic-1", "2025-09-15", "Central Dalmatia motor cruise · Day 1", [["Split ACI Marina", 43.501, 16.429], ["Split roads", 43.46, 16.36], ["Šolta north coast", 43.44, 16.25], ["Šolta northwest offing", 43.42, 16.15], ["Šolta west offing", 43.32, 16.13], ["Vis north approach", 43.15, 16.17], ["Vis harbour approach", 43.08, 16.2]], "08:20", "11:30", "15:40", 34, adriaticWeather[0], "Engine familiarization and open-water navigation to Vis."),
  day("adriatic-2", "2025-09-16", "Central Dalmatia motor cruise · Day 2", [["Vis harbour approach", 43.08, 16.2], ["Vis northeast offing", 43.1, 16.25], ["Vis east offing", 43.04, 16.28], ["Stiniva offing", 42.98, 16.25], ["Vis south coast", 42.96, 16.15], ["Komiža southwest offing", 43.02, 16.02], ["Komiža approach", 43.06, 16.04]], "09:00", "12:10", "16:20", 24, adriaticWeather[1], "Coastal pilotage and anchoring exercise on the south coast of Vis."),
  day("adriatic-3", "2025-09-17", "Central Dalmatia motor cruise · Day 3", [["Komiža approach", 43.06, 16.04], ["Biševo south offing", 42.97, 15.98], ["Biševo northwest offing", 43.1, 15.94], ["Vis northwest offing", 43.24, 16.1], ["Pakleni channel west", 43.3, 16.3], ["Stari Grad Bay approach", 43.28, 16.45], ["Stari Grad outer approach", 43.23, 16.53]], "07:50", "12:00", "16:55", 46, adriaticWeather[2], "Offshore leg via Biševo with radar and collision-avoidance practice."),
  day("adriatic-4", "2025-09-18", "Central Dalmatia motor cruise · Day 4", [["Stari Grad outer approach", 43.23, 16.53], ["Hvar northwest offing", 43.3, 16.3], ["Šolta southwest offing", 43.32, 16.15], ["Šolta west offing", 43.4, 16.1], ["Šolta northwest offing", 43.46, 16.115], ["Split Gate approach", 43.46, 16.36], ["Split ACI Marina", 43.501, 16.429]], "08:30", "12:15", "16:10", 41, adriaticWeather[3], "Final return leg with MOB recovery and fuel-consumption check."),
];

function day(id: string, date: string, title: string, route: [string, number, number][], departure: string, midpoint: string, arrival: string, distance: number, weather: [Weather, Weather, Weather], summary: string): Day {
  const waypoint = ([name, latitude, longitude]: [string, number, number]): Waypoint => ({ name, latitude, longitude });
  const track = route.map(waypoint);
  return { id, date, title, from: track[0], via: track[Math.floor(track.length / 2)], to: track.at(-1)!, track, departure, midpoint, arrival, distance, weather, summary };
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
  const scaled = fraction * (dayData.track.length - 1);
  const startIndex = Math.min(Math.floor(scaled), dayData.track.length - 2);
  const start = dayData.track[startIndex];
  const end = dayData.track[startIndex + 1];
  const legFraction = scaled - startIndex;
  if (Number.isInteger(scaled)) return dayData.track[Math.round(scaled)];
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

function bearing(from: Waypoint, to: Waypoint) {
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x = (Math.cos(fromLatitude) * Math.sin(toLatitude)) - (Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta));
  return Math.round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360);
}

function logLine(dayData: Day, waypoint: Waypoint, nextWaypoint: Waypoint | undefined, time: string, index: number, count: number, boat: Boat): LogLine {
  const fraction = index / (count - 1);
  const weather = weatherAt(dayData, fraction);
  const underway = index < count - 1;
  const trueCourse = nextWaypoint ? bearing(waypoint, nextWaypoint) : 0;
  const motorBoat = boat.type === "Motor";
  const distance = Math.round(dayData.distance * fraction * 10) / 10;
  const magneticCourse = underway ? (trueCourse + 356) % 360 : 0;
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
    trueCourse,
    windDrift: underway && !motorBoat ? 2 : 0,
    courseThroughWater: underway ? (trueCourse + (motorBoat ? 0 : 2)) % 360 : 0,
    currentDrift: underway ? 1 : 0,
    courseOverGround: trueCourse,
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
  const waypoints = Array.from({ length: lineCount }, (_, lineIndex) => interpolateWaypoint(dayData, lineIndex / (lineCount - 1)));
  const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
    const fraction = lineIndex / (lineCount - 1);
    return logLine(dayData, waypoints[lineIndex], waypoints[lineIndex + 1], interpolateTime(dayData.date, dayData.departure, dayData.arrival, fraction), lineIndex, lineCount, boat);
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

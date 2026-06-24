export type BoatType = "Sail" | "Motor";

export type Boat = {
  id: string;
  name: string;
  type: BoatType;
  registration: string;
  flagState: string;
  homePort: string;
  owner: string;
  dimensions: string;
};

export type CrewMember = {
  name: string;
  nationality: string;
  role: string;
  embarkation: string;
  disembarkation: string;
};

export type LogLine = {
  time: string;
  position: string;
  latitude: number;
  longitude: number;
  logNm: number;
  course: string;
  wind: string;
  weather: string;
  sails: string;
  engine: string;
  remarks: string;
};

export type LogSheet = {
  id: string;
  title: string;
  dateRange: string;
  status: "Draft" | "Ready for review" | "Signed digitally";
  boatId: string;
  skipper: {
    name: string;
    address: string;
    nationality: string;
    certificate: string;
  };
  route: {
    from: string;
    to: string;
    departed: string;
    arrived: string;
  };
  crew: CrewMember[];
  watchPlan: string[];
  technicalChecks: string[];
  lines: LogLine[];
};

export const boats: Boat[] = [
  {
    id: "boreas",
    name: "SY Boreas",
    type: "Sail",
    registration: "CHE-7421",
    flagState: "Switzerland",
    homePort: "Basel",
    owner: "M. Keller",
    dimensions: "12.4 m · 7.8 t · CE A",
  },
  {
    id: "aurora",
    name: "MY Aurora",
    type: "Motor",
    registration: "HR-19-884",
    flagState: "Croatia",
    homePort: "Split",
    owner: "Adriatic Charter d.o.o.",
    dimensions: "10.8 m · twin diesel · CE B",
  },
];

export const logSheets: LogSheet[] = [
  {
    id: "ionian-day-3",
    title: "Ionian training passage · Day 3",
    dateRange: "14 May 2026",
    status: "Ready for review",
    boatId: "boreas",
    skipper: {
      name: "Nina Baumann",
      address: "Seestrasse 10, 8002 Zürich",
      nationality: "Swiss",
      certificate: "ICC Ocean · No. CH-88421 · Bern · 12 Mar 2022 · SSA",
    },
    route: {
      from: "Preveza Marina",
      to: "Fiskardo",
      departed: "14 May 2026, 07:35",
      arrived: "14 May 2026, 18:10",
    },
    crew: [
      { name: "Luca Frei", nationality: "Swiss", role: "Co-skipper / navigation", embarkation: "Preveza · 12 May", disembarkation: "Fiskardo · 16 May" },
      { name: "Sofia Marin", nationality: "Italian", role: "Watch lead", embarkation: "Preveza · 12 May", disembarkation: "Fiskardo · 16 May" },
      { name: "Jonas Meier", nationality: "Swiss", role: "Trainee", embarkation: "Preveza · 12 May", disembarkation: "Fiskardo · 16 May" },
    ],
    watchPlan: ["08-12: Luca / Jonas", "12-16: Nina / Sofia", "16-20: Sofia / Jonas"],
    technicalChecks: ["Engine oil checked", "Bilge dry", "Fresh water 62%", "Diesel 74%", "Navigation lights tested"],
    lines: [
      { time: "07:35", position: "Preveza fairway", latitude: 38.956, longitude: 20.754, logNm: 0, course: "215°", wind: "NW 3", weather: "Clear, 1016 hPa", sails: "Main + genoa", engine: "0.4 h departure", remarks: "Departed after safety briefing." },
      { time: "10:00", position: "Off Lefkada", latitude: 38.777, longitude: 20.589, logNm: 18, course: "196°", wind: "NW 4", weather: "Sunny, slight sea", sails: "Reef 1 + genoa", engine: "Off", remarks: "Crew practiced MOB under sail." },
      { time: "13:30", position: "Meganisi abeam", latitude: 38.622, longitude: 20.741, logNm: 36, course: "168°", wind: "NW 4-5", weather: "Good visibility", sails: "Reef 1", engine: "Off", remarks: "Lunch underway; position cross-checked." },
      { time: "16:45", position: "North Kefalonia", latitude: 38.504, longitude: 20.615, logNm: 54, course: "153°", wind: "NW 3", weather: "Scattered clouds", sails: "Full main", engine: "Off", remarks: "Prepared harbor entry plan." },
      { time: "18:10", position: "Fiskardo harbor", latitude: 38.459, longitude: 20.577, logNm: 63, course: "Docked", wind: "NW 2", weather: "Calm", sails: "Stowed", engine: "0.6 h arrival", remarks: "Moored stern-to; no incidents." },
    ],
  },
  {
    id: "adriatic-transfer",
    title: "Adriatic transfer watch",
    dateRange: "03 Jun 2026",
    status: "Draft",
    boatId: "aurora",
    skipper: {
      name: "Nina Baumann",
      address: "Seestrasse 10, 8002 Zürich",
      nationality: "Swiss",
      certificate: "ICC Ocean · No. CH-88421 · Bern · 12 Mar 2022 · SSA",
    },
    route: {
      from: "Split",
      to: "Vis",
      departed: "03 Jun 2026, 09:20",
      arrived: "03 Jun 2026, 14:55",
    },
    crew: [
      { name: "Mara Novak", nationality: "Croatian", role: "Local skipper", embarkation: "Split · 03 Jun", disembarkation: "Vis · 03 Jun" },
      { name: "Nina Baumann", nationality: "Swiss", role: "Personal log owner", embarkation: "Split · 03 Jun", disembarkation: "Vis · 03 Jun" },
    ],
    watchPlan: ["09-12: Mara / Nina", "12-15: Nina / Mara"],
    technicalChecks: ["Fuel valves open", "VHF radio check", "Cooling water visible", "Harbor documents photographed"],
    lines: [
      { time: "09:20", position: "Split harbor", latitude: 43.503, longitude: 16.441, logNm: 0, course: "190°", wind: "W 2", weather: "Hazy", sails: "n/a", engine: "On", remarks: "Left berth with local skipper." },
      { time: "11:45", position: "South of Solta", latitude: 43.267, longitude: 16.236, logNm: 22, course: "214°", wind: "W 3", weather: "Sunny", sails: "n/a", engine: "1900 rpm", remarks: "Traffic separation discussed." },
      { time: "14:55", position: "Vis town quay", latitude: 43.061, longitude: 16.184, logNm: 35, course: "Docked", wind: "W 2", weather: "Clear", sails: "n/a", engine: "Off", remarks: "Arrival check complete." },
    ],
  },
];

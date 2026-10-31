export type DistanceUnit = "m" | "ft";
export type WindUnit = "bft" | "kn" | "km/h" | "mp/h" | "m/s";
export type TemperatureUnit = "c" | "f" | "°C" | "°F";

export type LogLine = {
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Stable identifier retained when the line is edited or reordered. */
  id: string;
  time: string;
  latitude: number | null;
  longitude: number | null;
  weather: string;
  weatherRemark: string;
  temperature: number | null;
  temperatureUnit: TemperatureUnit;
  barometer: number | null;
  windDirection: string;
  windStrength: number | null;
  windUnit: WindUnit;
  waves: number | null;
  seaUnit: DistanceUnit;
  tide: number | null;
  tideUnit: DistanceUnit;
  moon: string;
  compassCourse: number | null;
  deviation: number | null;
  magneticCourse: number | null;
  variation: number | null;
  trueCourse: number | null;
  windDrift: number | null;
  courseThroughWater: number | null;
  currentDrift: number | null;
  courseOverGround: number | null;
  speedKn: number | null;
  logNm: number | null;
  sailMiles: number | null;
  sailNote: string;
  motorMiles: number | null;
  /** Runtime added during this log interval, keyed by the boat engine's stable ID. */
  engineHours?: Record<string, number>;
  motorNote: string;
  remarks: string;
};

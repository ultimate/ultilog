export type DistanceUnit = "m" | "ft";
export type WindUnit = "bft" | "kn" | "km/h" | "mp/h" | "m/s";
export type TemperatureUnit = "c" | "f" | "°C" | "°F";

export type LogLine = {
  time: string;
  position: string;
  latitude: number;
  longitude: number;
  weather: string;
  weatherRemark: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  barometer: number;
  windDirection: string;
  windStrength: number;
  windUnit: WindUnit;
  waves: number;
  seaUnit: DistanceUnit;
  tide: number;
  tideUnit: DistanceUnit;
  moon: string;
  compassCourse: number;
  deviation: number;
  magneticCourse: number;
  variation: number;
  trueCourse: number;
  windDrift: number;
  courseThroughWater: number;
  currentDrift: number;
  courseOverGround: number;
  speedKn: number;
  logNm: number;
  sailMiles: number;
  sailNote: string;
  motorMiles: number;
  /** Runtime added during this log interval, keyed by the boat engine's stable ID. */
  engineHours?: Record<string, number>;
  /** @deprecated Read-only compatibility for pre multi-engine data and scanners. */
  motorHours: number;
  motorNote: string;
  remarks: string;
};

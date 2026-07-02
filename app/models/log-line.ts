export type DistanceUnit = "m" | "ft";
export type WindUnit = "bft" | "kn";

export type LogLine = {
  time: string;
  position: string;
  latitude: number;
  longitude: number;
  weather: string;
  barometer: number;
  windDirection: string;
  windStrength: number;
  windUnit: WindUnit;
  seaState: number;
  seaUnit: DistanceUnit;
  tide: number;
  tideUnit: DistanceUnit;
  moon: string;
  magneticCourse: number;
  deviation: number;
  magneticCourseCorrected: number;
  variation: number;
  trueCourse: number;
  driftAngle: number;
  courseThroughWater: number;
  currentDrift: number;
  courseOverGround: number;
  /** @deprecated Use courseOverGround and related structured course fields. */
  course?: string;
  /** @deprecated Use windDirection, windStrength, and windUnit. */
  wind?: string;
  speedKn: number;
  logNm: number;
  sailSm: number;
  sailNote: string;
  motorSm: number;
  motorHours: number;
  motorNote: string;
  remarks: string;
};

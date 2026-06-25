export const courseConversionColumns = ["Abl / Dev", "mwK / MC", "Mw / Var", "rwK / TC", "BW / WD", "KdW / CTW", "BS / CD"] as const;

export type CourseConversionColumn = typeof courseConversionColumns[number];

export type CourseConversionInput = {
  compassCourse?: number;
  deviation?: number;
  variation?: number;
  windDrift?: number;
  currentDrift?: number;
};

export function normalizeCourse(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function convertCompassToTrueCourse(input: CourseConversionInput) {
  const compassCourse = input.compassCourse ?? 0;
  const deviation = input.deviation ?? 0;
  const variation = input.variation ?? 0;
  const windDrift = input.windDrift ?? 0;
  const currentDrift = input.currentDrift ?? 0;

  return normalizeCourse(compassCourse + deviation + variation + windDrift + currentDrift);
}

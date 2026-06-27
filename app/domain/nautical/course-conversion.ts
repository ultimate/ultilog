export const courseConversionColumns = ["Abl / Dev", "mwK / MC", "Mw / Var", "rwK / TC", "BW / WD", "KdW / CTW", "BS / CD"] as const;

export type CourseConversionColumn = typeof courseConversionColumns[number];

export type CourseConversionInput = Partial<CourseConversion>;

export type CourseConversionPosition = {
  latitude: number;
  longitude: number;
};

export type CourseConversionLookupOptions = {
  position?: CourseConversionPosition;
  variationLookup?: (position: CourseConversionPosition) => Promise<number>;
};

export type CourseConversion = {
  compassCourse: number;
  deviation: number;
  magneticCourse: number;
  variation: number;
  trueCourse: number;
  windDrift: number;
  courseThroughWater: number;
  currentDrift: number;
  courseOverGround: number;
};

type CourseKey = "compassCourse" | "magneticCourse" | "trueCourse" | "courseThroughWater" | "courseOverGround";
type DeltaKey = "deviation" | "variation" | "windDrift" | "currentDrift";

export type DeviationTable = Record<number, number>;

type DeviationEntry = {
  compassCourse: number;
  deviation: number;
};

type ConversionStep = {
  from: CourseKey;
  delta: DeltaKey;
  to: CourseKey;
};

const conversionSteps: ConversionStep[] = [
  { from: "compassCourse", delta: "deviation", to: "magneticCourse" },
  { from: "magneticCourse", delta: "variation", to: "trueCourse" },
  { from: "trueCourse", delta: "windDrift", to: "courseThroughWater" },
  { from: "courseThroughWater", delta: "currentDrift", to: "courseOverGround" },
];

export function normalizeCourse(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

function normalizeDelta(degrees: number) {
  const normalized = normalizeCourse(degrees);
  return normalized > 180 ? normalized - 360 : normalized;
}

function hasValue(input: CourseConversionInput, key: keyof CourseConversion) {
  return input[key] !== undefined;
}

function setCourse(input: CourseConversionInput, key: CourseKey, value: number) {
  if (!hasValue(input, key)) {
    input[key] = normalizeCourse(value);
    return true;
  }

  return false;
}

function setDelta(input: CourseConversionInput, key: DeltaKey, value: number) {
  if (!hasValue(input, key)) {
    input[key] = normalizeDelta(value);
    return true;
  }

  return false;
}

function deviationEntries(deviationTable: DeviationTable): DeviationEntry[] {
  return Object.entries(deviationTable)
    .map(([course, deviation]) => ({
      compassCourse: normalizeCourse(Number(course)),
      deviation: normalizeDelta(deviation),
    }))
    .sort((left, right) => left.compassCourse - right.compassCourse);
}

function interpolateDeviation(compassCourse: number, entries: DeviationEntry[]) {
  if (entries.length === 0) {
    return undefined;
  }

  if (entries.length === 1) {
    return entries[0].deviation;
  }

  const normalizedCourse = normalizeCourse(compassCourse);
  const exactEntry = entries.find((entry) => entry.compassCourse === normalizedCourse);
  if (exactEntry) {
    return exactEntry.deviation;
  }

  const upperEntryIndex = entries.findIndex((entry) => entry.compassCourse > normalizedCourse);
  const upperEntry = upperEntryIndex === -1 ? entries[0] : entries[upperEntryIndex];
  const lowerEntry = upperEntryIndex === -1 ? entries[entries.length - 1] : entries[upperEntryIndex - 1];
  const lowerCourse = lowerEntry.compassCourse;
  const upperCourse = upperEntry.compassCourse > lowerCourse ? upperEntry.compassCourse : upperEntry.compassCourse + 360;
  const unwrappedCourse = normalizedCourse >= lowerCourse ? normalizedCourse : normalizedCourse + 360;
  const interpolationFactor = (unwrappedCourse - lowerCourse) / (upperCourse - lowerCourse);

  return normalizeDelta(lowerEntry.deviation + ((upperEntry.deviation - lowerEntry.deviation) * interpolationFactor));
}

function reverseDeviationCandidates(magneticCourse: number, entries: DeviationEntry[]) {
  if (entries.length === 0) {
    return [];
  }

  if (entries.length === 1) {
    const [{ compassCourse, deviation }] = entries;
    return normalizeCourse(compassCourse + deviation) === normalizeCourse(magneticCourse) ? entries : [];
  }

  const candidates: DeviationEntry[] = [];
  const normalizedMagneticCourse = normalizeCourse(magneticCourse);

  for (let index = 0; index < entries.length; index += 1) {
    const lowerEntry = entries[index];
    const upperEntry = entries[(index + 1) % entries.length];
    const lowerCourse = lowerEntry.compassCourse;
    const upperCourse = upperEntry.compassCourse > lowerCourse ? upperEntry.compassCourse : upperEntry.compassCourse + 360;
    const span = upperCourse - lowerCourse;
    const deviationChange = upperEntry.deviation - lowerEntry.deviation;
    const magneticStart = lowerCourse + lowerEntry.deviation;
    const magneticChange = span + deviationChange;

    for (const magneticTarget of [normalizedMagneticCourse, normalizedMagneticCourse + 360]) {
      if (magneticChange === 0) {
        if (magneticTarget === magneticStart) {
          for (const candidate of [lowerEntry, upperEntry]) {
            if (!candidates.some((existing) => existing.compassCourse === candidate.compassCourse && existing.deviation === candidate.deviation)) {
              candidates.push(candidate);
            }
          }
        }
        continue;
      }

      const factor = (magneticTarget - magneticStart) / magneticChange;
      if (factor >= 0 && factor < 1) {
        const compassCourse = normalizeCourse(lowerCourse + (span * factor));
        const deviation = normalizeDelta(lowerEntry.deviation + (deviationChange * factor));
        if (!candidates.some((candidate) => candidate.compassCourse === compassCourse && candidate.deviation === deviation)) {
          candidates.push({ compassCourse, deviation });
        }
      }
    }
  }

  return candidates;
}

function setDeviationFromTable(input: CourseConversionInput, deviationTable?: DeviationTable) {
  if (!deviationTable || hasValue(input, "deviation")) {
    return false;
  }

  const entries = deviationEntries(deviationTable);

  if (input.compassCourse !== undefined) {
    const deviation = interpolateDeviation(input.compassCourse, entries);
    return deviation === undefined ? false : setDelta(input, "deviation", deviation);
  }

  if (input.magneticCourse !== undefined) {
    const candidates = reverseDeviationCandidates(input.magneticCourse, entries);

    if (candidates.length === 1) {
      const [candidate] = candidates;
      return setCourse(input, "compassCourse", candidate.compassCourse) || setDelta(input, "deviation", candidate.deviation);
    }
  }

  return false;
}

export function calculateCourseConversion(input: CourseConversionInput, deviationTable?: DeviationTable): CourseConversionInput {
  const result: CourseConversionInput = { ...input };

  let changed = true;
  while (changed) {
    changed = false;

    changed = setDeviationFromTable(result, deviationTable) || changed;

    for (const step of conversionSteps) {
      const from = result[step.from];
      const delta = result[step.delta];
      const to = result[step.to];

      if (from !== undefined && delta !== undefined) {
        changed = setCourse(result, step.to, from + delta) || changed;
      }

      if (to !== undefined && delta !== undefined) {
        changed = setCourse(result, step.from, to - delta) || changed;
      }

      if (from !== undefined && to !== undefined) {
        changed = setDelta(result, step.delta, to - from) || changed;
      }
    }
  }

  return result;
}

export async function calculateCourseConversionWithPosition(
  input: CourseConversionInput,
  deviationTable?: DeviationTable,
  options: CourseConversionLookupOptions = {},
): Promise<CourseConversionInput> {
  if (input.variation !== undefined || !options.position) {
    return calculateCourseConversion(input, deviationTable);
  }

  const { lookupNoaaMagneticVariation } = await import("./noaa-magnetic-variation");
  const variationLookup = options.variationLookup ?? lookupNoaaMagneticVariation;

  return calculateCourseConversion({
    ...input,
    variation: await variationLookup(options.position),
  }, deviationTable);
}

export function convertCompassToTrueCourse(input: CourseConversionInput) {
  return calculateCourseConversion(input).courseOverGround ?? normalizeCourse(
    (input.compassCourse ?? 0) +
    (input.deviation ?? 0) +
    (input.variation ?? 0) +
    (input.windDrift ?? 0) +
    (input.currentDrift ?? 0),
  );
}

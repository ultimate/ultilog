import type { ScannerResult } from "../../models/logbook-scanner";
import {
  getPrintLogColumns,
  LOG_SHEET_PRINT_TEMPLATE_ID,
  LOG_SHEET_PRINT_TEMPLATE_REVISION,
  type LogSheetPrintVariant,
} from "../../domain/logbook/print-template";
import { localeLabels, locales, t, type Locale } from "../i18n/translations";
import { criticalCourseScannerFields, scannerFieldAliases } from "./field-aliases";
import type { ScannerProviderInput } from "./provider";

const DEFAULT_MODEL = "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const IMAGE_DETAIL = "high";

export type ScannerProviderErrorCode = "authentication_failed" | "quota_exceeded" | "service_unavailable" | "request_failed";

export class ScannerProviderError extends Error {
  constructor(
    message: string,
    readonly scannerProviderErrorCode: ScannerProviderErrorCode,
    readonly status?: number,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "ScannerProviderError";
  }
}

const LOG_LINE_FIELDS = [
  "time",
  "position",
  "latitude",
  "longitude",
  "weather",
  "weatherRemark",
  "temperature",
  "temperatureUnit",
  "barometer",
  "windDirection",
  "windStrength",
  "windUnit",
  "waves",
  "seaUnit",
  "tide",
  "tideUnit",
  "moon",
  "compassCourse",
  "deviation",
  "magneticCourse",
  "variation",
  "trueCourse",
  "windDrift",
  "courseThroughWater",
  "currentDrift",
  "courseOverGround",
  "speedKn",
  "logNm",
  "sailMiles",
  "sailNote",
  "motorMiles",
  "motorHours",
  "motorNote",
  "remarks",
] as const;

const lineFieldDescriptions = {
  time: "Log row time as visible text.",
  position: "Named position, waypoint, or place description for map context; keep this field even when coordinates are present.",
  latitude: "Latitude as visible text in decimal degrees, DMS, or DDM (degrees and decimal minutes); preserve a visible N/S hemisphere prefix or suffix.",
  longitude: "Longitude as visible text in decimal degrees, DMS, or DDM (degrees and decimal minutes); preserve a visible E/W hemisphere prefix or suffix.",
  weather: "Short weather code or condition text.",
  weatherRemark: "Free-text weather remark or visibility/horizon note.",
  temperature: "Air temperature as numeric text when visible.",
  temperatureUnit: "Air temperature unit when visible; expected values are °C or °F (c/f also accepted), otherwise empty string.",
  barometer: "Barometric pressure as numeric text when visible.",
  windDirection: "Wind direction as visible text, such as N, NE, 270, or WSW.",
  windStrength: "Wind strength as numeric text.",
  windUnit: "Wind strength unit when visible; expected values include bft/Beaufort/BF, kn/kt/kts/knots, km/h/kph, mp/h/mph, or m/s, otherwise empty string.",
  waves: "Wave or sea height/state as numeric text when visible.",
  seaUnit: "Wave/sea height unit when visible; expected values are m/meters/metres or ft/feet, otherwise empty string.",
  tide: "Tide height or tide value as numeric text when visible.",
  tideUnit: "Tide height unit when visible; expected values are m/meters/metres or ft/feet, otherwise empty string.",
  moon: "Moon phase or moon remark as visible text.",
  compassCourse: "Compass course as numeric degrees text.",
  deviation: "Deviation as signed numeric degrees text.",
  magneticCourse: "Magnetic course as numeric degrees text.",
  variation: "Variation as signed numeric degrees text.",
  trueCourse: "True course as numeric degrees text.",
  windDrift: "Wind drift/leeway as signed numeric degrees text.",
  courseThroughWater: "Course through water as numeric degrees text.",
  currentDrift: "Current drift/set correction as signed numeric degrees text.",
  courseOverGround: "Course over ground as numeric degrees text.",
  speedKn: "Speed as numeric knots text.",
  logNm: "Log distance as numeric nautical miles text.",
  sailMiles: "Sailing distance as numeric nautical miles text.",
  sailNote: "Sail configuration or sail-specific note.",
  motorMiles: "Motor distance as numeric nautical miles text.",
  motorHours: "Engine hours as numeric text.",
  motorNote: "Engine or motor-specific note.",
  remarks: "General row remarks or events.",
} satisfies Record<(typeof LOG_LINE_FIELDS)[number], string>;

const lineProperties = Object.fromEntries(
  LOG_LINE_FIELDS.map((field) => [field, { type: "string", description: lineFieldDescriptions[field] }]),
);

const scannerResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["draft", "warnings"],
  properties: {
    draft: {
      type: "object",
      additionalProperties: false,
      required: ["title", "dateRange", "route", "lines"],
      properties: {
        title: { type: "string" },
        dateRange: { type: "string" },
        route: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to", "departed", "arrived"],
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            departed: { type: "string" },
            arrived: { type: "string" },
          },
        },
        lines: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [...LOG_LINE_FIELDS],
            properties: lineProperties,
          },
        },
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const systemPrompt = `You extract handwritten or photographed vessel logbook sheets into strict JSON.
Return only fields that match the provided schema. Use empty strings for fields that are missing, illegible, or not present.
Do not invent values. Preserve original units and text when unsure, except numeric fields should be transcribed as written.
Add a warning for every missing, illegible, conflicting, or ambiguous sheet-level field and for any row where important navigation fields are unclear.
Never include raw image data, file names, or unrelated commentary in the response.`;

const extractionInstructions = `Extract a logbook draft from these image(s). The JSON must match ScannerResult:
- draft.title: sheet title if visible, otherwise empty string.
- draft.dateRange: visible date or date range, otherwise empty string.
- draft.route.from/to/departed/arrived: visible route information, otherwise empty strings.
- draft.lines: one object per logbook row using only the schema's log line fields.
- Use the renamed log line fields waves, compassCourse, magneticCourse, windDrift, weatherRemark, and temperature.
- Do not output deprecated course or wind fields; split wind into windDirection, windStrength, and windUnit.
- Keep position in each row for named positions or waypoint text, even when latitude and longitude are present.
- When one Position/Standort cell contains a coordinate pair, split it into latitude and longitude. DDM is common in nautical logs; for example, N49°27.3346' W2°32.0386' maps to latitude=N49°27.3346' and longitude=W2°32.0386'.
- Expected row data types are strings in the JSON schema. Transcribe numeric values as strings for numeric fields such as temperature, barometer, waves, compassCourse, magneticCourse, windDrift, speedKn, and logNm.
- Include explicit units when visible for windUnit, seaUnit, tideUnit, and temperatureUnit; leave them empty only when no unit is shown.
- warnings: concise human-readable warnings for missing or ambiguous fields.`;

const documentInterpretationInstructions = `Interpret the document before transcribing its rows:
- Detect the language from the printed sheet headings. The sheet may use English, German, French, Italian, international abbreviations, or a mixture of languages.
- Identify the header row and map each visible column heading to exactly one canonical JSON field by nautical meaning and position.
- Establish one header-to-field mapping for a table and apply it consistently to every row. Do not remap a column based on an individual cell value.
- The user's interface language, when supplied below, is only a weak hint for ambiguous headings. Never exclude terminology from another language because of it.
- Similar or shared abbreviations can be ambiguous. Resolve them using the full header, neighboring columns, units, and the table structure; warn instead of guessing when those signals conflict.
- Course-conversion columns commonly follow this semantic sequence: ${criticalCourseScannerFields.join(" -> ")}. A sheet may contain only a subset, and its printed headings and spatial alignment always take precedence.
- A missing intermediate course column never shifts the meaning of later columns. For example, the shortened header sequence MgK / Cc, Abl / d, Mw / D, rwK / Cv maps to compassCourse, deviation, variation, trueCourse; leave magneticCourse empty.
- Use the course sequence only to map columns. Never calculate, copy, or invent a missing course value to make the sequence complete or arithmetically consistent.
- Preserve signed correction values, including explicit + and - signs.`;

export function buildScannerUserPrompt(languageHint?: Locale) {
  const hint = languageHint
    ? `User interface language hint: ${localeLabels[languageHint]} (${languageHint}). This is a preference only; detect the sheet's actual language independently.`
    : "User interface language hint: none. Detect the sheet language from the document.";

  return `${extractionInstructions}\n\n${documentInterpretationInstructions}\n\n${formatTemplateRecognitionInstructions()}\n\n${hint}\n\nMultilingual field terminology:\n${formatScannerFieldAliases()}`;
}

export function formatScannerFieldAliases() {
  return Object.entries(scannerFieldAliases)
    .map(([field, aliasesByLocale]) => {
      const localizedAliases = locales
        .map((locale) => `${locale}=[${aliasesByLocale[locale].join(" | ")}]`)
        .join("; ");
      return `- ${field}: ${localizedAliases}`;
    })
    .join("\n");
}

export function formatTemplateRecognitionInstructions() {
  const variants = (["full", "compact"] as const)
    .map((variant) => `- ${variant}: ${formatTemplateColumns(variant)}`)
    .join("\n");

  return `UltiLog template recognition:
- Look for a marker formatted as ULTILOG:<template-id>:v<revision>:<variant>:<locale>.
- The supported marker is ULTILOG:${LOG_SHEET_PRINT_TEMPLATE_ID}:v${LOG_SHEET_PRINT_TEMPLATE_REVISION}:<variant>:<locale>.
- Only apply the fixed template mapping when that marker and the visible table structure agree. Otherwise use multilingual header mapping.
- For a recognized template, correct for rotation and perspective, locate its grid, and map cells by the following canonical column order:
${variants}
- Printed headings vary with the marker locale (${locales.join(", ")}); use the locale-specific headings and field terminology together.
- Add a warning if an UltiLog marker has an unsupported revision or unknown variant, then fall back to visible headings.
- Add a warning if a recognized page has a cropped header, table edge, row region, or populated-looking cell that cannot be read reliably.
- Template geometry is evidence for cell mapping, never permission to invent blank or illegible values.`;
}

function formatTemplateColumns(variant: LogSheetPrintVariant) {
  return getPrintLogColumns(variant)
    .map((column) => `${column.id} (${locales.map((locale) => t(locale, column.headingKey)).join("/")})`)
    .join(" -> ");
}

export function isOpenAiScannerProviderConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function extractLogbookDraft(input: ScannerProviderInput): Promise<ScannerResult> {
  if (input.files.length === 0) {
    return { draft: { title: "", dateRange: "", route: { from: "", to: "", departed: "", arrived: "" }, lines: [] }, warnings: ["No images were provided for scanning."] };
  }

  if (!isOpenAiScannerProviderConfigured()) {
    throw new Error("OPENAI_API_KEY is required to scan logbook images.");
  }

  const apiKey = process.env.OPENAI_API_KEY as string;
  const model = process.env.LOGBOOK_SCANNER_MODEL ?? DEFAULT_MODEL;
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: buildScannerUserPrompt(input.languageHint) },
            ...input.files.map((file) => ({
              type: "input_image",
              image_url: `data:${file.type || "image/jpeg"};base64,${file.buffer.toString("base64")}`,
              detail: IMAGE_DETAIL,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "scanner_result",
          strict: true,
          schema: scannerResultJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw await createOpenAiScannerProviderError(response);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const parsed = parseScannerResult(payload);
  repairShiftedMissingMagneticCourse(parsed);
  parsed.warnings = [...parsed.warnings, ...findLocalWarnings(parsed)];

  return parsed;
}

export const openAiScannerProvider = { extractLogbookDraft, isConfigured: isOpenAiScannerProviderConfigured };

const shiftedCourseRepairWarning = "Detected a missing magnetic-course column and remapped the following variation and true-course columns.";

/**
 * Repairs a recurring vision-model error on sheets whose printed course chain
 * omits magnetic course. The repair is deliberately sheet-wide and requires
 * the shifted values to satisfy the visible course arithmetic in several rows.
 */
export function repairShiftedMissingMagneticCourse(result: ScannerResult) {
  const lines = result.draft.lines;
  if (lines.some((line) => line.trueCourse?.trim())) return false;

  const candidates = lines.filter((line) =>
    line.compassCourse?.trim()
    && line.deviation?.trim()
    && line.magneticCourse?.trim()
    && line.variation?.trim(),
  );
  if (candidates.length < 2) return false;

  const matchingRows = candidates.filter((line) => {
    const compassCourse = parseScannedNumber(line.compassCourse);
    const deviation = parseScannedNumber(line.deviation);
    const shiftedVariation = parseScannedNumber(line.magneticCourse);
    const shiftedTrueCourse = parseScannedNumber(line.variation);
    if (compassCourse === undefined || deviation === undefined || shiftedVariation === undefined || shiftedTrueCourse === undefined) return false;
    if (Math.abs(shiftedVariation) > 30) return false;

    const expectedTrueCourse = normalizeCourse(compassCourse + deviation + shiftedVariation);
    return angularDifference(expectedTrueCourse, normalizeCourse(shiftedTrueCourse)) <= 1.5;
  });

  if (matchingRows.length / candidates.length < 0.75) return false;

  for (const line of candidates) {
    line.trueCourse = line.variation;
    line.variation = line.magneticCourse;
    line.magneticCourse = "";
  }
  if (!result.warnings.includes(shiftedCourseRepairWarning)) result.warnings.push(shiftedCourseRepairWarning);
  return true;
}

async function createOpenAiScannerProviderError(response: Response) {
  const responseText = await response.text();
  const providerCode = parseOpenAiErrorCode(responseText);
  const scannerProviderErrorCode = classifyOpenAiError(response.status, providerCode);

  return new ScannerProviderError(
    `OpenAI logbook scanner request failed (${response.status}): ${responseText}`,
    scannerProviderErrorCode,
    response.status,
    providerCode,
  );
}

function classifyOpenAiError(status: number, providerCode?: string): ScannerProviderErrorCode {
  if (status === 401 || providerCode === "invalid_api_key") return "authentication_failed";
  if (providerCode === "insufficient_quota") return "quota_exceeded";
  if ([500, 502, 503, 504].includes(status)) return "service_unavailable";

  return "request_failed";
}

function parseOpenAiErrorCode(responseText: string) {
  try {
    const payload = JSON.parse(responseText) as { error?: { code?: unknown } };
    return typeof payload.error?.code === "string" ? payload.error.code : undefined;
  } catch {
    return undefined;
  }
}

function parseScannerResult(payload: OpenAIResponsePayload): ScannerResult {
  const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;

  if (!outputText) {
    throw new Error("OpenAI logbook scanner response did not include structured output text.");
  }

  return JSON.parse(outputText) as ScannerResult;
}

export function findLocalWarnings(result: ScannerResult): string[] {
  const warnings = new Set<string>();
  const route = result.draft.route;

  if (!result.draft.title) warnings.add("Missing or unclear sheet title.");
  if (!result.draft.dateRange) warnings.add("Missing or unclear sheet date range.");
  if (!route?.from) warnings.add("Missing or unclear route origin.");
  if (!route?.to) warnings.add("Missing or unclear route destination.");
  if (!route?.departed) warnings.add("Missing or unclear departure time.");
  if (!route?.arrived) warnings.add("Missing or unclear arrival time.");
  if (result.draft.lines.length === 0) warnings.add("No logbook rows were detected.");

  result.draft.lines.forEach((line, index) => {
    const missingFields = ["time", "position", "courseOverGround", "speedKn", "logNm"].filter((field) => !line[field as keyof typeof line]);
    if (missingFields.length > 0) {
      warnings.add(`Row ${index + 1} is missing or unclear: ${missingFields.join(", ")}.`);
    }

    for (const warning of findCourseWarnings(line, index + 1)) warnings.add(warning);
  });

  return [...warnings].filter((warning) => !result.warnings.includes(warning));
}

const courseRelations = [
  ["compassCourse", "deviation", "magneticCourse"],
  ["magneticCourse", "variation", "trueCourse"],
  ["trueCourse", "windDrift", "courseThroughWater"],
  ["courseThroughWater", "currentDrift", "courseOverGround"],
] as const;

function findCourseWarnings(line: ScannerResult["draft"]["lines"][number], rowNumber: number) {
  const warnings: string[] = [];
  const populatedIndexes = criticalCourseScannerFields
    .map((field, index) => line[field]?.trim() ? index : -1)
    .filter((index) => index >= 0);

  const isCompactEndpointPair = populatedIndexes.length === 2
    && populatedIndexes[0] === 0
    && populatedIndexes[1] === criticalCourseScannerFields.length - 1;
  if (populatedIndexes.length >= 2 && !isCompactEndpointPair) {
    const first = populatedIndexes[0];
    const last = populatedIndexes[populatedIndexes.length - 1];
    const missingInteriorFields = criticalCourseScannerFields
      .slice(first + 1, last)
      .filter((field) => !line[field]?.trim());
    if (missingInteriorFields.length > 0) {
      warnings.push(`Row ${rowNumber} has an incomplete course chain: ${missingInteriorFields.join(", ")} is missing or unclear.`);
    }
  }

  for (const [fromField, correctionField, resultField] of courseRelations) {
    const from = parseScannedNumber(line[fromField]);
    const correction = parseScannedNumber(line[correctionField]);
    const actual = parseScannedNumber(line[resultField]);
    if (from === undefined || correction === undefined || actual === undefined) continue;

    const expected = normalizeCourse(from + correction);
    if (angularDifference(expected, normalizeCourse(actual)) > 1.5) {
      warnings.push(`Row ${rowNumber} has inconsistent course conversion: ${fromField} + ${correctionField} does not match ${resultField}.`);
    }
  }

  return warnings;
}

function parseScannedNumber(value: string | undefined) {
  const numericText = value?.trim().replace(",", ".").match(/[+-]?\d+(?:\.\d+)?/)?.[0];
  if (!numericText) return undefined;
  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCourse(value: number) {
  return ((value % 360) + 360) % 360;
}

function angularDifference(first: number, second: number) {
  const difference = Math.abs(first - second) % 360;
  return Math.min(difference, 360 - difference);
}

type OpenAIResponsePayload = {
  output_text?: string;
  output?: {
    content?: {
      type?: string;
      text?: string;
    }[];
  }[];
};

import type { ScannerResult } from "../../models/logbook-scanner";
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
  latitude: "Latitude as visible text; use decimal degrees only if the sheet already uses them.",
  longitude: "Longitude as visible text; use decimal degrees only if the sheet already uses them.",
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

const userPrompt = `Extract a logbook draft from these image(s). The JSON must match ScannerResult:
- draft.title: sheet title if visible, otherwise empty string.
- draft.dateRange: visible date or date range, otherwise empty string.
- draft.route.from/to/departed/arrived: visible route information, otherwise empty strings.
- draft.lines: one object per logbook row using only the schema's log line fields.
- Use the renamed log line fields waves, compassCourse, magneticCourse, windDrift, weatherRemark, and temperature.
- Do not output deprecated course or wind fields; split wind into windDirection, windStrength, and windUnit.
- Keep position in each row for named positions or waypoint text, even when latitude and longitude are present.
- Expected row data types are strings in the JSON schema. Transcribe numeric values as strings for numeric fields such as temperature, barometer, waves, compassCourse, magneticCourse, windDrift, speedKn, and logNm.
- Include explicit units when visible for windUnit, seaUnit, tideUnit, and temperatureUnit; leave them empty only when no unit is shown.
- warnings: concise human-readable warnings for missing or ambiguous fields.`;

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
            { type: "input_text", text: userPrompt },
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
  parsed.warnings = [...parsed.warnings, ...findLocalWarnings(parsed)];

  return parsed;
}

export const openAiScannerProvider = { extractLogbookDraft, isConfigured: isOpenAiScannerProviderConfigured };

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

function findLocalWarnings(result: ScannerResult): string[] {
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
  });

  return [...warnings].filter((warning) => !result.warnings.includes(warning));
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

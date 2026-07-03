import type { ScannerResult } from "../../models/logbook-scanner";
import type { ScannerProviderInput } from "./provider";

const DEFAULT_MODEL = "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const IMAGE_DETAIL = "high";

const LOG_LINE_FIELDS = [
  "time",
  "position",
  "latitude",
  "longitude",
  "weather",
  "barometer",
  "windDirection",
  "windStrength",
  "windUnit",
  "seaState",
  "seaUnit",
  "tide",
  "tideUnit",
  "moon",
  "magneticCourse",
  "deviation",
  "magneticCourseCorrected",
  "variation",
  "trueCourse",
  "driftAngle",
  "courseThroughWater",
  "currentDrift",
  "courseOverGround",
  "speedKn",
  "logNm",
  "sailSm",
  "sailNote",
  "motorSm",
  "motorHours",
  "motorNote",
  "remarks",
] as const;

const lineProperties = Object.fromEntries(LOG_LINE_FIELDS.map((field) => [field, { type: "string" }]));

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
- warnings: concise human-readable warnings for missing or ambiguous fields.`;

export async function extractLogbookDraft(input: ScannerProviderInput): Promise<ScannerResult> {
  if (input.files.length === 0) {
    return { draft: { title: "", dateRange: "", route: { from: "", to: "", departed: "", arrived: "" }, lines: [] }, warnings: ["No images were provided for scanning."] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to scan logbook images.");
  }

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
    const message = await response.text();
    throw new Error(`OpenAI logbook scanner request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const parsed = parseScannerResult(payload);
  parsed.warnings = [...parsed.warnings, ...findLocalWarnings(parsed)];

  return parsed;
}

export const openAiScannerProvider = { extractLogbookDraft };

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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createScannedSheet } from "../../../app/lib/logbook-scanner/create-scanned-sheet";
import { openAiScannerProvider } from "../../../app/lib/logbook-scanner/openai-provider";
import type { ScannerResult } from "../../../app/models/logbook";
import { locales, type Locale } from "../../../app/lib/i18n/translations";
import type { LogSheetPrintVariant } from "../../../app/domain/logbook/print-template";

const fixturesRoot = path.join(process.cwd(), "tests/fixtures/logbook-scanner");
const expectedFileName = "logsheet-expected.json";
const encodedImageSuffix = ".base64.txt";
const imagePattern = /\.(jpe?g|png|webp)(?:\.base64\.txt)?$/i;
const liveScannerEnabled = process.env.RUN_LIVE_SCANNER_TESTS === "true" && Boolean(process.env.OPENAI_API_KEY);

type ExpectedFixtureLine = Record<string, string | number | undefined>;
type ExpectedFixture = {
  title?: string;
  dateRange?: string;
  route?: { from?: string; to?: string; departed?: string; arrived?: string };
  lines?: ExpectedFixtureLine[];
  template?: {
    id: string;
    revision: number;
    variant: LogSheetPrintVariant;
    locale: Locale;
  };
};

type ScannerFixtureCase = {
  name: string;
  directory: string;
  images: string[];
  expected: ExpectedFixture;
};

const fixtureCases = loadFixtureCases();

describe("logbook scanner image fixtures", () => {
  it("discovers at least one real-image scenario", () => {
    expect(fixtureCases.length).toBeGreaterThan(0);
  });

  it.each(fixtureCases)("validates fixture files for $name", ({ directory, images, expected }) => {
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      const decodedImage = readFixtureImage(path.join(directory, image));
      expect(decodedImage.length, image).toBeGreaterThan(0);
      expect(isSupportedImageBuffer(decodedImage), image).toBe(true);
    }
    expect(expected.title).toEqual(expect.any(String));
    expect(expected.route).toEqual(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
    expect(expected.lines?.length).toBeGreaterThan(0);
    if (expected.template) {
      expect(expected.template).toEqual(expect.objectContaining({
        id: "ultilog-logsheet",
        revision: 1,
        variant: expect.stringMatching(/^(full|compact)$/),
        locale: expect.stringMatching(/^(en|de|fr|it)$/),
      }));
    }
  });

  it("covers every supported locale, both template variants, transformed photos, and third-party sheets", () => {
    const templateFixtures = fixtureCases.filter(({ expected }) => expected.template);
    expect(new Set(templateFixtures.map(({ expected }) => expected.template?.locale))).toEqual(new Set(locales));
    expect(new Set(templateFixtures.map(({ expected }) => expected.template?.variant))).toEqual(new Set(["full", "compact"]));
    expect(templateFixtures.some(({ images }) => images.some((image) => /rotated|shadow/i.test(image)))).toBe(true);
    expect(fixtureCases.some(({ expected }) => !expected.template)).toBe(true);
  });

  it.each(fixtureCases)("creates the expected draft sheet from $name scanner fixture data", ({ expected }) => {
    const scannerResult = expectedToScannerResult(expected);
    const sheet = createScannedSheet({
      scannerResult,
      boatId: "fixture-boat",
      currentUser: { name: "Fixture skipper" },
      logbook: { boats: [], crewMembers: [], sheets: [] },
    });

    expect(sheet).toEqual(expect.objectContaining({
      title: expected.title,
      dateRange: expected.dateRange || expected.route?.departed?.slice(0, 10),
      status: "Draft",
      source: "scanner",
      boatId: "fixture-boat",
      route: expected.route,
      scannerWarnings: scannerResult.warnings,
    }));
    expect(sheet.lines).toHaveLength(expected.lines?.length ?? 0);

    expected.lines?.forEach((line, index) => {
      const actual = sheet.lines[index];
      expect(actual).toEqual(expect.objectContaining(projectExpectedLine(line, actual)));
    });

    const serialized = JSON.stringify(sheet);
    for (const imageMarker of [".jpg", ".jpeg", ".png", ".webp", "IMG_"]) {
      expect(serialized).not.toContain(imageMarker);
    }
  });
});

describe.skipIf(!liveScannerEnabled)("live logbook scanner image fixtures", () => {
  it.each(fixtureCases.flatMap((fixture) => fixture.images.map((image) => ({ ...fixture, image }))))(
    "extracts expected core values from $name/$image",
    { timeout: 120_000 },
    async ({ directory, image, expected }) => {
      const imagePath = path.join(directory, image);
      const scannerResult = await openAiScannerProvider.extractLogbookDraft({
        files: [{ name: logicalImageName(image), type: mimeTypeForImage(image), buffer: readFixtureImage(imagePath) }],
      });

      expect(scannerResult.draft.title).toBe(expected.title);
      expect(scannerResult.draft.route).toEqual(expect.objectContaining(expected.route ?? {}));
      expect(scannerResult.draft.lines).toHaveLength(expected.lines?.length ?? 0);
      assertExtractedLines(scannerResult, expected);
    },
  );
});

function loadFixtureCases(): ScannerFixtureCase[] {
  if (!existsSync(fixturesRoot)) return [];

  return readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = path.join(fixturesRoot, entry.name);
      const expectedPath = path.join(directory, expectedFileName);
      const images = readdirSync(directory).filter((file) => imagePattern.test(file)).sort();
      return {
        name: entry.name,
        directory,
        images,
        expected: JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedFixture,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function expectedToScannerResult(expected: ExpectedFixture): ScannerResult {
  return {
    draft: {
      title: expected.title ?? "",
      dateRange: expected.dateRange ?? "",
      route: {
        from: expected.route?.from ?? "",
        to: expected.route?.to ?? "",
        departed: expected.route?.departed ?? "",
        arrived: expected.route?.arrived ?? "",
      },
      lines: (expected.lines ?? []).map((line) => stringifyLineValues(line)),
    },
    warnings: ["Fixture data intentionally omits unverified handwritten notes."],
  };
}

function stringifyLineValues(line: ExpectedFixtureLine) {
  const entries = Object.entries(line)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) => {
      const stringValue = String(value);
      if (key === "sailMiles") return [["sailMiles", stringValue], ["sailSm", stringValue]];
      if (key === "motorMiles") return [["motorMiles", stringValue], ["motorSm", stringValue]];
      return [[key, stringValue]];
    });

  return Object.fromEntries(entries);
}

function projectExpectedLine(line: ExpectedFixtureLine, actualLine: Record<string, unknown>) {
  const fieldAliases: Record<string, string> = {
    sailMiles: "sailMiles" in actualLine ? "sailMiles" : "sailSm",
    motorMiles: "motorMiles" in actualLine ? "motorMiles" : "motorSm",
  };
  const comparableFields = [
    "time",
    "latitude",
    "longitude",
    "weather",
    "weatherRemark",
    "temperature",
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
  ];
  return Object.fromEntries(
    comparableFields
      .filter((field) => line[field] !== undefined)
      .map((field) => [fieldAliases[field] ?? field, numericExpectedValue(field, line[field])]),
  );
}

function numericExpectedValue(field: string, value: string | number | undefined) {
  if (value === undefined) return value;
  const stringFields = new Set(["time", "weather", "weatherRemark", "windDirection", "windUnit", "seaUnit", "tideUnit", "moon", "sailNote", "motorNote", "remarks"]);
  return stringFields.has(field) ? String(value) : Number(value);
}

function assertExtractedLines(scannerResult: ScannerResult, expected: ExpectedFixture) {
  expected.lines?.forEach((expectedLine, index) => {
    const actual = scannerResult.draft.lines[index];
    expect(actual).toBeDefined();
    for (const [field, expectedValue] of Object.entries(expectedLine)) {
      if (expectedValue === undefined) continue;
      const actualValue = actual[field as keyof typeof actual];
      if (isUnitField(field)) {
        expect(normalizeUnit(actualValue), `${field} in row ${index + 1}`).toBe(normalizeUnit(String(expectedValue)));
      } else if (isTextField(field)) {
        expect(actualValue, `${field} in row ${index + 1}`).toBe(String(expectedValue));
      } else {
        expect(Number(actualValue), `${field} in row ${index + 1}`).toBeCloseTo(Number(expectedValue), numericPrecision(field));
      }
    }
  });
}

function isTextField(field: string) {
  return new Set(["time", "position", "weather", "weatherRemark", "windDirection", "moon", "sailNote", "motorNote", "remarks"]).has(field);
}

function isUnitField(field: string) {
  return new Set(["temperatureUnit", "windUnit", "seaUnit", "tideUnit"]).has(field);
}

function normalizeUnit(value: string | undefined) {
  return value?.trim().toLowerCase().replace("°", "").replace("beaufort", "bft").replace(/knots?|kts?/, "kn");
}

function numericPrecision(field: string) {
  if (field === "latitude" || field === "longitude") return 2;
  if (["compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround"].includes(field)) return 0;
  return 1;
}

function mimeTypeForImage(fileName: string) {
  const logicalName = logicalImageName(fileName);
  if (/\.png$/i.test(logicalName)) return "image/png";
  if (/\.webp$/i.test(logicalName)) return "image/webp";
  return "image/jpeg";
}

function logicalImageName(fileName: string) {
  return fileName.endsWith(encodedImageSuffix) ? fileName.slice(0, -encodedImageSuffix.length) : fileName;
}

function readFixtureImage(imagePath: string) {
  if (!imagePath.endsWith(encodedImageSuffix)) return readFileSync(imagePath);
  const encoded = readFileSync(imagePath, "utf8").replace(/\s/g, "");
  return Buffer.from(encoded, "base64");
}

function isSupportedImageBuffer(buffer: Buffer) {
  const signature = buffer.subarray(0, 12).toString("hex");
  return signature.startsWith("89504e470d0a1a0a")
    || signature.startsWith("ffd8ff")
    || (signature.startsWith("52494646") && buffer.subarray(8, 12).toString("ascii") === "WEBP");
}

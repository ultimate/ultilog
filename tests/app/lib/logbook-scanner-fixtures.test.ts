import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createScannedSheet } from "../../../app/lib/logbook-scanner/create-scanned-sheet";
import { openAiScannerProvider } from "../../../app/lib/logbook-scanner/openai-provider";
import type { ScannerResult } from "../../../app/models/logbook";

const fixturesRoot = path.join(process.cwd(), "tests/fixtures/logbook-scanner");
const expectedFileName = "logsheet-expected.json";
const imagePattern = /\.(jpe?g|png|webp)$/i;
const liveScannerEnabled = process.env.RUN_LIVE_SCANNER_TESTS === "true" && Boolean(process.env.OPENAI_API_KEY);

type ExpectedFixtureLine = Record<string, string | number | undefined>;
type ExpectedFixture = {
  title?: string;
  dateRange?: string;
  route?: { from?: string; to?: string; departed?: string; arrived?: string };
  lines?: ExpectedFixtureLine[];
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

  it.each(fixtureCases)("validates fixture files for $name", ({ images, expected }) => {
    expect(images.length).toBeGreaterThan(0);
    expect(expected.title).toEqual(expect.any(String));
    expect(expected.route).toEqual(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
    expect(expected.lines?.length).toBeGreaterThan(0);
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
      expect(actual).toEqual(expect.objectContaining(projectExpectedLine(line)));
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
        files: [{ name: image, type: mimeTypeForImage(image), buffer: readFileSync(imagePath) }],
      });

      expect(scannerResult.draft.title).toBe(expected.title);
      expect(scannerResult.draft.route).toEqual(expect.objectContaining(expected.route ?? {}));
      expect(scannerResult.draft.lines).toHaveLength(expected.lines?.length ?? 0);
      assertExtractedCoreLines(scannerResult, expected);
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
  return Object.fromEntries(
    Object.entries(line)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function projectExpectedLine(line: ExpectedFixtureLine) {
  const fieldAliases: Record<string, string> = {
    compassCourse: "compassCourse",
    windDrift: "windDrift",
    waves: "waves",
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
    "sailSm",
    "sailNote",
    "motorSm",
    "motorHours",
    "motorNote",
  ];
  return Object.fromEntries(
    comparableFields
      .filter((field) => line[field] !== undefined)
      .map((field) => [fieldAliases[field] ?? field, numericExpectedValue(field, line[field])]),
  );
}

function numericExpectedValue(field: string, value: string | number | undefined) {
  if (value === undefined) return value;
  const stringFields = new Set(["time", "weather", "weatherRemark", "windDirection", "windUnit", "seaUnit", "tideUnit", "moon", "sailNote", "motorNote"]);
  return stringFields.has(field) ? String(value) : Number(value);
}

function assertExtractedCoreLines(scannerResult: ScannerResult, expected: ExpectedFixture) {
  expected.lines?.forEach((expectedLine, index) => {
    const actual = scannerResult.draft.lines[index];
    expect(actual).toBeDefined();
    expect(actual.time).toBe(String(expectedLine.time ?? ""));
    expect(Number(actual.logNm)).toBeCloseTo(Number(expectedLine.logNm), 1);
    expect(Number(actual.courseOverGround)).toBeCloseTo(Number(expectedLine.courseOverGround), 0);
    expect(Number(actual.latitude)).toBeCloseTo(Number(expectedLine.latitude), 3);
    expect(Number(actual.longitude)).toBeCloseTo(Number(expectedLine.longitude), 3);
  });
}

function mimeTypeForImage(fileName: string) {
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  return "image/jpeg";
}

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { readFileSync } from "node:fs";
import { ENTITY_REQUEST_LIMITS } from "../../../app/api/logbook/entity-route";
import { LOGBOOK_LIMITS } from "../../../app/lib/validation/logbook";
import { fixtureBytes, testRequestBodyLimit } from "./request-body-limit";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/logbook-store", () => ({
  upsertBoat: vi.fn(async value => value), upsertCrewMember: vi.fn(async value => value), upsertLogSheet: vi.fn(async value => value),
  createLogLine: vi.fn(async (_sheet, value) => value), updateLogLine: vi.fn(async (_sheet, _line, value) => value),
  reorderLogLines: vi.fn(async (_sheet, value) => value), createStoredImage: vi.fn(async (_id, value) => value),
  readLogbook: vi.fn(async () => ({ boats: [], crewMembers: [], sheets: [] })), writeLogbook: vi.fn(async value => value),
}));
vi.mock("../../../app/lib/demo/demo-policy", () => ({ isActiveDemoSandbox: vi.fn(async () => false) }));

const { auth } = await import("../../../auth");
const boats = await import("../../../app/api/logbook/boats/route");
const boat = await import("../../../app/api/logbook/boats/[id]/route");
const crews = await import("../../../app/api/logbook/crew/route");
const crew = await import("../../../app/api/logbook/crew/[id]/route");
const sheets = await import("../../../app/api/logbook/sheets/route");
const sheet = await import("../../../app/api/logbook/sheets/[id]/route");
const lines = await import("../../../app/api/logbook/sheets/[id]/lines/route");
const line = await import("../../../app/api/logbook/sheets/[id]/lines/[lineId]/route");
const reorder = await import("../../../app/api/logbook/sheets/[id]/lines/reorder/route");
const images = await import("../../../app/api/images/route");
const logbookImport = await import("../../../app/api/logbook/import/route");

const boatFixture = { id: "boat-1", name: "Aurora é", type: "Sail", registration: "CH-1", flagState: "CH", homePort: "Basel", owner: "Ada", dimensions: "10m", logfactor: 1, yachtData: {}, deviationTable: [] };
const crewFixture = { id: "crew-1", name: "Zoë", nationality: "CH", role: "Skipper", address: "Basel", certificate: "ICC" };
const sheetFixture = { id: "sheet-1", title: "Rhône trip", status: "Draft", boatId: "boat-1", route: { from: "Basel", to: "Brest", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [] };
const lineFixture = { id: "line-1", time: "12:00", position: "47°", weather: "clear", weatherRemark: "", temperatureUnit: "C", windDirection: "N", windUnit: "kn", seaUnit: "m", tideUnit: "m", moon: "", sailNote: "", motorNote: "", remarks: "café", latitude: 47, longitude: 8, temperature: 20, barometer: 1013, windStrength: 5, waves: 0, tide: 0, compassCourse: 0, deviation: 0, magneticCourse: 0, variation: 0, trueCourse: 0, windDrift: 0, courseThroughWater: 0, currentDrift: 0, courseOverGround: 0, speedKn: 0, logNm: 0, sailMiles: 0, motorMiles: 0, motorHours: 0 };

function tiers(minimal: Record<string, unknown>, representative: Record<string, unknown>, limit: number) {
  const nearMaximum: Record<string, unknown> = { ...representative };
  for (let index = 0; ; index++) {
    const key = `_padding${index}`;
    const overhead = fixtureBytes({ ...nearMaximum, [key]: "" }) - fixtureBytes(nearMaximum);
    const remaining = limit - 16 - fixtureBytes(nearMaximum) - overhead;
    if (remaining <= 0) break;
    nearMaximum[key] = "é".repeat(Math.floor(Math.min(remaining, 9_000) / 2));
    if (remaining <= 9_000) break;
  }
  return { minimal, representative, nearMaximum };
}

const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const lineCtx = (id: string, lineId: string) => ({ params: Promise.resolve({ id, lineId }) });
const cases: ReadonlyArray<readonly [string, string, string, number, Record<string, unknown>, Record<string, unknown>, (request: Request) => Promise<Response>]> = [
  ["boat create", "POST", "/api/logbook/boats", ENTITY_REQUEST_LIMITS.boat, { ...boatFixture, name: "A" }, boatFixture, (r: Request) => boats.POST(r)],
  ["boat update", "PUT", "/api/logbook/boats/boat-1", ENTITY_REQUEST_LIMITS.boat, { ...boatFixture, name: "A", revision: 1 }, { ...boatFixture, revision: 1 }, (r: Request) => boat.PUT(r, idCtx("boat-1"))],
  ["crew create", "POST", "/api/logbook/crew", ENTITY_REQUEST_LIMITS.crew, { ...crewFixture, name: "A", address: "", certificate: "" }, crewFixture, (r: Request) => crews.POST(r)],
  ["crew update", "PUT", "/api/logbook/crew/crew-1", ENTITY_REQUEST_LIMITS.crew, { ...crewFixture, name: "A", address: "", certificate: "", revision: 1 }, { ...crewFixture, revision: 1 }, (r: Request) => crew.PUT(r, idCtx("crew-1"))],
  ["sheet create", "POST", "/api/logbook/sheets", ENTITY_REQUEST_LIMITS.sheet, { ...sheetFixture, title: "A" }, sheetFixture, (r: Request) => sheets.POST(r)],
  ["sheet update", "PUT", "/api/logbook/sheets/sheet-1", ENTITY_REQUEST_LIMITS.sheet, { ...sheetFixture, title: "A", revision: 1 }, { ...sheetFixture, revision: 1 }, (r: Request) => sheet.PUT(r, idCtx("sheet-1"))],
  ["line create", "POST", "/api/logbook/sheets/sheet-1/lines", ENTITY_REQUEST_LIMITS.line, { ...lineFixture, remarks: "" }, lineFixture, (r: Request) => lines.POST(r, idCtx("sheet-1"))],
  ["line update", "PUT", "/api/logbook/sheets/sheet-1/lines/line-1", ENTITY_REQUEST_LIMITS.line, { ...lineFixture, remarks: "", revision: 1 }, { ...lineFixture, revision: 1 }, (r: Request) => line.PUT(r, lineCtx("sheet-1", "line-1"))],
  ["line reorder", "PUT", "/api/logbook/sheets/sheet-1/lines/reorder", ENTITY_REQUEST_LIMITS.lineOrder, { lineIds: [] }, { lineIds: ["line-1", "ligne-é"] }, (r: Request) => reorder.PUT(r, idCtx("sheet-1"))],
];

const mockedAuth = auth as unknown as Mock;

describe("focused request body byte limits", () => {
  beforeEach(() => mockedAuth.mockResolvedValue({ user: { id: "owner-1" }, expires: "2099-01-01" }));
  for (const [name, method, path, limit, minimal, representative, invoke] of cases) {
    testRequestBodyLimit({ name, method, url: `https://ultilog.test${path}`, limit, fixtures: tiers(minimal, representative, limit), invoke });
  }

  it("keeps every documented focused limit equal to its runtime fallback", () => {
    const documented = Object.fromEntries(
      [...readFileSync(new URL("../../../.env.example", import.meta.url), "utf8").matchAll(/^(LOGBOOK_[A-Z_]+_REQUEST_BYTES)=(\d+)$/gm)]
        .map(([, name, value]) => [name, Number(value)]),
    );
    expect(documented).toMatchObject({
      LOGBOOK_BOAT_REQUEST_BYTES: ENTITY_REQUEST_LIMITS.boat,
      LOGBOOK_CREW_REQUEST_BYTES: ENTITY_REQUEST_LIMITS.crew,
      LOGBOOK_SHEET_REQUEST_BYTES: ENTITY_REQUEST_LIMITS.sheet,
      LOGBOOK_LINE_REQUEST_BYTES: ENTITY_REQUEST_LIMITS.line,
      LOGBOOK_LINE_REORDER_REQUEST_BYTES: ENTITY_REQUEST_LIMITS.lineOrder,
      LOGBOOK_IMPORT_REQUEST_BYTES: LOGBOOK_LIMITS.requestBytes,
    });
  });
});

describe("stored image request body byte limit", () => {
  beforeEach(() => mockedAuth.mockResolvedValue({ user: { id: "owner-1" }, expires: "2099-01-01" }));
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  const representative = { data: png, mimeType: "image/png", width: 64, height: 32, caption: "café" };
  testRequestBodyLimit({ name: "stored-image upload", method: "POST", url: "https://ultilog.test/api/images", limit: images.MAX_STORED_IMAGE_REQUEST_BYTES, fixtures: tiers({ data: png, mimeType: "image/png", width: 1, height: 1 }, representative, images.MAX_STORED_IMAGE_REQUEST_BYTES), invoke: images.POST });

  it("keeps the documented stored-image limit equal to the runtime fallback", () => {
    const documented = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8").match(/^STORED_IMAGE_REQUEST_BYTES=(\d+)$/m)?.[1];
    expect(Number(documented)).toBe(images.DEFAULT_STORED_IMAGE_REQUEST_BYTES);
  });
});

describe("explicit legacy import/replacement request body byte limit", () => {
  beforeEach(() => mockedAuth.mockResolvedValue({ user: { id: "owner-1" }, expires: "2099-01-01" }));
  const minimal = { boats: [], crewMembers: [], sheets: [] };
  const representative = { boats: [boatFixture], crewMembers: [crewFixture], sheets: [] };
  // Numeric padding is ignored by the legacy validator and does not consume its
  // independent aggregate-string allowance.
  const paddingLength = Math.floor((LOGBOOK_LIMITS.requestBytes - fixtureBytes(representative) - 32) / 2);
  const nearMaximum = { ...representative, _numericPadding: Array<number>(paddingLength).fill(0) };
  testRequestBodyLimit({ name: "explicit import/replacement", method: "PUT", url: "https://ultilog.test/api/logbook/import", limit: LOGBOOK_LIMITS.requestBytes, fixtures: { minimal, representative, nearMaximum }, headers: { "x-ultilog-confirm-replace": "replace-my-entire-logbook" }, invoke: logbookImport.PUT });
});

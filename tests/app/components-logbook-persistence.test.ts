import { describe, expect, it, vi } from "vitest";
import { deleteLogbookEntity, normalizeLogbookIds, persistBoat, persistCrewMember, persistLogLine, persistSheet, uploadStoredImage } from "../../app/components/logbook/persistence";
import * as importOperations from "../../app/components/logbook/import";
import type { PersistedLogbook } from "../../app/models/logbook";
import { sampleLogSheets } from "../fixtures/logbook";

const image = { data: "base64-image", mimeType: "image/png", width: 64, height: 32 };

vi.stubGlobal("crypto", { randomUUID: vi.fn() });

describe("logbook persistence", () => {
  it("never invokes full replacement for routine boat, crew, sheet, assignment, image, or line mutations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "image-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const replacementSpy = vi.spyOn(importOperations, "replaceEntireLogbook");
    const boat = { id: "boat-1", name: "Solo", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] } as PersistedLogbook["boats"][number];
    const crew = { id: "crew-1", name: "Ada", nationality: "", role: "Crew" } as PersistedLogbook["crewMembers"][number];
    const sheet = { ...sampleLogSheets[0], id: "sheet-1", boatId: boat.id, crew: [{ ...crew, embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "" }] };

    await persistBoat(boat);
    await persistCrewMember(crew);
    await persistSheet(sheet); // Includes routine crew-assignment changes.
    await persistLogLine(sheet.id, sheet.lines[0], false);
    await uploadStoredImage({ data: "iVBORw0KGgo=", mimeType: "image/png", width: 1, height: 1 });

    expect(replacementSpy).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/logbook/import");
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/logbook")).toBe(false);
  });

  it("preserves images while normalizing boat, crew, and sheet identifiers", () => {
    vi.mocked(crypto.randomUUID)
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222")
      .mockReturnValueOnce("33333333-3333-4333-8333-333333333333");
    const logbook: PersistedLogbook = {
      boats: [{ id: "boat-1", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [], image }],
      crewMembers: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, image }],
      sheets: [{ id: "sheet-1", title: "Trip", status: "Draft", boatId: "boat-1", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "", image }], watchPlan: [], technicalChecks: [], image, lines: [] }],
    };

    const { logbook: normalized } = normalizeLogbookIds(logbook);

    expect(normalized.boats[0]).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", image });
    expect(normalized.crewMembers[0]).toMatchObject({ id: "22222222-2222-4222-8222-222222222222", image });
    expect(normalized.sheets[0]).toMatchObject({ id: "33333333-3333-4333-8333-333333333333", boatId: "11111111-1111-4111-8111-111111111111", image });
    expect(normalized.sheets[0].crew[0]).toMatchObject({ id: "22222222-2222-4222-8222-222222222222", image });
  });

  it("does not report changes for UUID entities with current crew assignments", () => {
    const logbook: PersistedLogbook = {
      boats: [{ id: "11111111-1111-4111-8111-111111111111", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] }],
      crewMembers: [{ id: "22222222-2222-4222-8222-222222222222", name: "Luca", nationality: "CH", role: "Skipper" }],
      sheets: [{ id: "33333333-3333-4333-8333-333333333333", title: "Trip", status: "Draft", boatId: "11111111-1111-4111-8111-111111111111", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [{ id: "22222222-2222-4222-8222-222222222222", name: "Luca", nationality: "CH", role: "Skipper", embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "" }], watchPlan: [], technicalChecks: [], lines: [] }],
    };

    const normalized = normalizeLogbookIds(logbook);

    expect(normalized.changed).toBe(false);
    expect(normalized.logbook.sheets[0]).toBe(logbook.sheets[0]);
  });

  it("serializes sheet metadata without any log lines", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const sourceSheet = sampleLogSheets[0];
    const sheet: PersistedLogbook["sheets"][number] = {
      ...sourceSheet,
      id: "sheet-1",
      title: "Edited",
      boatId: "boat-1",
      lines: [{ ...sourceSheet.lines[0], id: "line-1", time: "2026-08-11T10:00", remarks: "later edit" }],
    };

    await persistSheet(sheet);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/logbook/sheets/sheet-1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(Object.fromEntries(Object.entries(sheet).filter(([key]) => key !== "lines")));
    expect(init.body).not.toContain('"lines"');
    expect(init.body).not.toContain("unrelated-sheet");
    expect(init.body).not.toContain("base64-image");
    expect(init.body).not.toContain('"boats"');
    expect(init.body).not.toContain('"crewMembers"');
  });

  it("serializes only one addressed log line", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const line = { ...sampleLogSheets[0].lines[0], id: "stable-line", remarks: "focused" };

    await persistLogLine("sheet-1", line, false);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/logbook/sheets/sheet-1/lines/stable-line");
    expect(JSON.parse(init.body)).toEqual(line);
    expect(init.body).not.toContain('"boats"');
    expect(init.body).not.toContain('"crew"');
    expect(init.body).not.toContain('"lines"');
  });

  it("uses focused endpoints and payloads for boats, crew, and deletions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const boat = { id: "boat-1", name: "Solo", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] } as PersistedLogbook["boats"][number];
    const crew = { id: "crew-1", name: "Ada", nationality: "", role: "Crew", address: "", certificate: "", isPrimary: false } as PersistedLogbook["crewMembers"][number];

    await persistBoat(boat);
    await persistCrewMember(crew);
    await deleteLogbookEntity("sheet", "sheet-1", 7);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body && JSON.parse(init.body)])).toEqual([
      ["/api/logbook/boats/boat-1", "PUT", boat],
      ["/api/logbook/crew/crew-1", "PUT", crew],
      ["/api/logbook/sheets/sheet-1", "DELETE", { revision: 7 }],
    ]);
  });

  it("edits an entity by image id without retransmitting image bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const boat = { ...sampleLogSheets[0], id: "sheet-image", image: { id: "stable-image", data: "large-base64", mimeType: "image/png", width: 2, height: 2 } };

    await persistSheet(boat);

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.imageId).toBe("stable-image");
    expect(payload).not.toHaveProperty("image");
    expect(fetchMock.mock.calls[0][1].body).not.toContain("large-base64");
  });
});

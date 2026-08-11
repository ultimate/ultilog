import { describe, expect, it, vi } from "vitest";
import { deleteLogbookEntity, normalizeLogbookIds, persistBoat, persistCrewMember, persistSheet } from "../../app/components/logbook/persistence";
import type { PersistedLogbook } from "../../app/models/logbook";

const image = { data: "base64-image", mimeType: "image/png", width: 64, height: 32 };

vi.stubGlobal("crypto", { randomUUID: vi.fn() });

describe("logbook persistence", () => {
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

  it("serializes only the edited sheet when a log line changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const sheet = {
      id: "sheet-1", title: "Edited", status: "Draft" as const, boatId: "boat-1",
      route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [],
      lines: [{ id: "line-1", time: "2026-08-11T10:00", remarks: "later edit" }],
    } as PersistedLogbook["sheets"][number];

    await persistSheet(sheet);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/logbook/sheets/sheet-1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(sheet);
    expect(init.body).not.toContain("unrelated-sheet");
    expect(init.body).not.toContain("base64-image");
    expect(init.body).not.toContain('"boats"');
    expect(init.body).not.toContain('"crewMembers"');
  });

  it("uses focused endpoints and payloads for boats, crew, and deletions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const boat = { id: "boat-1", name: "Solo", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] } as PersistedLogbook["boats"][number];
    const crew = { id: "crew-1", name: "Ada", nationality: "", role: "Crew", address: "", certificate: "", isPrimary: false } as PersistedLogbook["crewMembers"][number];

    await persistBoat(boat);
    await persistCrewMember(crew);
    await deleteLogbookEntity("sheet", "sheet-1");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body && JSON.parse(init.body)])).toEqual([
      ["/api/logbook/boats/boat-1", "PUT", boat],
      ["/api/logbook/crew/crew-1", "PUT", crew],
      ["/api/logbook/sheets/sheet-1", "DELETE", undefined],
    ]);
  });
});

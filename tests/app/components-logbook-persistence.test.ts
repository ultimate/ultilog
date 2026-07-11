import { describe, expect, it, vi } from "vitest";
import { normalizeLogbookIds } from "../../app/components/logbook/persistence";
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
      boats: [{ id: "boat-1", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", yachtData: {}, deviationTable: [], image }],
      crewMembers: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, image }],
      sheets: [{ id: "sheet-1", title: "Trip", status: "Draft", dateRange: "2026-07-03", boatId: "boat-1", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "", image }], watchPlan: [], technicalChecks: [], image, lines: [] }],
    };

    const { logbook: normalized } = normalizeLogbookIds(logbook);

    expect(normalized.boats[0]).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", image });
    expect(normalized.crewMembers[0]).toMatchObject({ id: "22222222-2222-4222-8222-222222222222", image });
    expect(normalized.sheets[0]).toMatchObject({ id: "33333333-3333-4333-8333-333333333333", boatId: "11111111-1111-4111-8111-111111111111", image });
    expect(normalized.sheets[0].crew[0]).toMatchObject({ id: "22222222-2222-4222-8222-222222222222", image });
  });
});

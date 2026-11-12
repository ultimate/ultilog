import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fetcher = vi.fn();
beforeEach(() => { vi.resetModules(); fetcher.mockReset(); vi.stubGlobal("fetch", fetcher); });
afterEach(() => vi.unstubAllGlobals());
describe("same-origin magnetic variation client", () => {
  it("deduplicates position/day requests without exposing a provider key", async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ variation: 4.2 })));
    const { lookupMagneticVariation } = await import("../../../../app/domain/nautical/magnetic-variation");
    const query = { latitude: 54.1, longitude: 10.2, date: new Date("2026-11-12T12:00:00Z") };
    expect(await Promise.all([lookupMagneticVariation(query), lookupMagneticVariation(query)])).toEqual([4.2, 4.2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/navigation/magnetic-variation?latitude=54.1&longitude=10.2&date=2026-11-12");
  });
  it("does not cache a failure and requests new coordinates", async () => {
    fetcher.mockResolvedValueOnce(new Response("", { status: 503 })).mockImplementation(async () => new Response(JSON.stringify({ variation: 5 })));
    const { lookupMagneticVariation } = await import("../../../../app/domain/nautical/magnetic-variation");
    const query = { latitude: 54, longitude: 10 };
    await expect(lookupMagneticVariation(query)).rejects.toThrow();
    expect(await lookupMagneticVariation(query)).toBe(5);
    expect(await lookupMagneticVariation({ ...query, latitude: 55 })).toBe(5);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("rejects invalid provider results", async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ variation: null })));
    const { lookupMagneticVariation } = await import("../../../../app/domain/nautical/magnetic-variation");
    await expect(lookupMagneticVariation({ latitude: 0, longitude: 0 })).rejects.toThrow("Invalid magnetic variation");
  });
});

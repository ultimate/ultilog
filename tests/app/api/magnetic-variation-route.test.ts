import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), lookup: vi.fn(), quota: vi.fn() }));
vi.mock("../../../auth", () => ({ auth: mocks.auth }));
vi.mock("../../../app/domain/nautical/noaa-magnetic-variation", () => ({ lookupNoaaMagneticVariation: mocks.lookup }));
vi.mock("../../../app/lib/security/rate-limiter", async () => ({ ...await vi.importActual("../../../app/lib/security/rate-limiter"), consumeRateLimit: mocks.quota }));
const { GET } = await import("../../../app/api/navigation/magnetic-variation/route");
const request = (query = "latitude=54.1&longitude=10.2&date=2026-11-12") => new Request(`https://ultilog.test/api/navigation/magnetic-variation?${query}`);
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "user-1" } }); mocks.quota.mockResolvedValue({ allowed: true }); mocks.lookup.mockResolvedValue(4.2); vi.stubEnv("NOAA_GEOMAG_DECLINATION_API_KEY", "test-server-key"); });
afterEach(() => vi.unstubAllEnvs());
describe("magnetic variation endpoint", () => {
  it("requires authentication", async () => { mocks.auth.mockResolvedValue(null); expect((await GET(request())).status).toBe(401); expect(mocks.lookup).not.toHaveBeenCalled(); });
  it.each(["", "latitude=91&longitude=0", "latitude=0&longitude=-181", "latitude=NaN&longitude=0", "latitude= &longitude=0", "latitude=0&longitude=0&date=2026-02-30"])("rejects invalid input %s", async query => { expect((await GET(request(query))).status).toBe(400); expect(mocks.lookup).not.toHaveBeenCalled(); });
  it("uses the server key and returns only the result", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ variation: 4.2 });
    expect(mocks.lookup).toHaveBeenCalledWith({ latitude: 54.1, longitude: 10.2, date: new Date("2026-11-12T00:00:00Z"), apiKey: "test-server-key" });
  });
  it("reports missing configuration without calling NOAA", async () => { vi.stubEnv("NOAA_GEOMAG_DECLINATION_API_KEY", ""); expect((await GET(request())).status).toBe(503); expect(mocks.lookup).not.toHaveBeenCalled(); });
  it("enforces its quota", async () => { mocks.quota.mockResolvedValue({ allowed: false, retryAfter: 60, resetAt: new Date() }); expect((await GET(request())).status).toBe(429); expect(mocks.lookup).not.toHaveBeenCalled(); });
  it("does not expose provider errors or credentials", async () => { mocks.lookup.mockRejectedValue(new Error("secret provider detail")); const response = await GET(request()); expect(response.status).toBe(502); expect(await response.json()).toEqual({ error: "Unable to obtain magnetic variation." }); });
});

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const getSnapshot = vi.fn();
const meteoSnapshotToLogLineAutofill = vi.fn();

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/domain/meteo", () => ({
  createFreeMeteoService: vi.fn(() => ({ getSnapshot })),
  meteoSnapshotToLogLineAutofill,
}));

const { auth } = await import("../../../auth");
const { POST } = await import("../../../app/api/meteo/log-line-autofill/route");

const mockedAuth = auth as unknown as Mock;
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };

function request(body: unknown) {
  return new Request("https://ultilog.test/api/meteo/log-line-autofill", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("meteo log-line autofill endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    mockedAuth.mockResolvedValueOnce(null);

    const response = await POST(request({ latitude: 47.1, longitude: 8.3 }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    [{ longitude: 8.3 }],
    [{ latitude: 47.1 }],
    [{ latitude: "47.1", longitude: 8.3 }],
    [{ latitude: Number.NaN, longitude: 8.3 }],
    [{ latitude: 47.1, longitude: Number.POSITIVE_INFINITY }],
  ])("rejects invalid coordinates %#", async (body) => {
    mockedAuth.mockResolvedValueOnce(session);

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Latitude and longitude are required." });
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("rejects invalid timestamps", async () => {
    mockedAuth.mockResolvedValueOnce(session);

    const response = await POST(request({ latitude: 47.1, longitude: 8.3, timestamp: "not-a-date" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Timestamp is invalid." });
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("returns autofilled log-line fields from the meteo snapshot", async () => {
    const snapshot = { id: "snapshot" };
    const autofill = { fields: { windStrength: "4" }, remarkParts: [] };
    mockedAuth.mockResolvedValueOnce(session);
    getSnapshot.mockResolvedValueOnce(snapshot);
    meteoSnapshotToLogLineAutofill.mockReturnValueOnce(autofill);

    const response = await POST(request({
      latitude: 47.1,
      longitude: 8.3,
      timestamp: "2026-07-24T12:00:00.000Z",
      temperatureUnit: "°F",
      windUnit: "kn",
      seaUnit: "ft",
      tideUnit: "ft",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(autofill);
    expect(getSnapshot).toHaveBeenCalledWith({
      latitude: 47.1,
      longitude: 8.3,
      timestamp: new Date("2026-07-24T12:00:00.000Z"),
    });
    expect(meteoSnapshotToLogLineAutofill).toHaveBeenCalledWith(snapshot, {
      temperatureUnit: "°F",
      windUnit: "kn",
      seaUnit: "ft",
      tideUnit: "ft",
    });
  });

  it("uses the current time when no timestamp is provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T13:14:15.000Z"));
    try {
      mockedAuth.mockResolvedValueOnce(session);
      getSnapshot.mockResolvedValueOnce({});
      meteoSnapshotToLogLineAutofill.mockReturnValueOnce({ fields: {}, remarkParts: [] });

      const response = await POST(request({ latitude: 47.1, longitude: 8.3 }));

      expect(response.status).toBe(200);
      expect(getSnapshot).toHaveBeenCalledWith({
        latitude: 47.1,
        longitude: 8.3,
        timestamp: new Date("2026-07-24T13:14:15.000Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns upstream meteo errors as bad gateway responses", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    getSnapshot.mockRejectedValueOnce(new Error("Provider unavailable"));

    const response = await POST(request({ latitude: 47.1, longitude: 8.3 }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Provider unavailable" });
  });

  it("returns a generic bad gateway response for non-error failures", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    getSnapshot.mockRejectedValueOnce("network down");

    const response = await POST(request({ latitude: 47.1, longitude: 8.3 }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Unable to fetch meteo data." });
  });
});

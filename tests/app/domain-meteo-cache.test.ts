import { describe, expect, it } from "vitest";
import { createCachedMeteoProvider, createFreeMeteoProviders, createMeteoProvider } from "../../app/domain/meteo";

const request = {
  latitude: 54.12345,
  longitude: 10.23456,
  timestamp: new Date("2026-07-17T12:05:00Z"),
  mode: "auto" as const,
  allowFallbackEstimate: true,
};

describe("meteo provider cache", () => {
  it("caches provider snapshots by rounded position and timestamp bucket", async () => {
    let calls = 0;
    let now = 1_000;
    const provider = createCachedMeteoProvider(createMeteoProvider({
      name: "cache-test",
      sourceType: "calculated",
      capabilities: { astronomy: true },
      async getSnapshot() {
        calls += 1;
        return { warnings: [`call ${calls}`] };
      },
    }), { ttlMs: 1_000, now: () => now });

    await expect(provider.getSnapshot(request)).resolves.toMatchObject({ warnings: ["call 1"] });
    await expect(provider.getSnapshot({ ...request, latitude: 54.12349 })).resolves.toMatchObject({ warnings: ["call 1"] });

    now = 2_001;
    await expect(provider.getSnapshot(request)).resolves.toMatchObject({ warnings: ["call 2"] });
    expect(calls).toBe(2);
  });

  it("caches station lookups separately from snapshots", async () => {
    let stationCalls = 0;
    let snapshotCalls = 0;
    const provider = createCachedMeteoProvider(createMeteoProvider({
      name: "station-cache-test",
      sourceType: "observed",
      capabilities: { weather: true },
      async findStations() {
        stationCalls += 1;
        return [{ id: "station-1", latitude: 54.1, longitude: 10.2 }];
      },
      async getSnapshot() {
        snapshotCalls += 1;
        return { warnings: [`snapshot ${snapshotCalls}`] };
      },
    }), { ttlMs: 1_000, now: () => 1_000 });

    await expect(provider.findStations?.(request)).resolves.toHaveLength(1);
    await expect(provider.findStations?.(request)).resolves.toHaveLength(1);
    await expect(provider.getSnapshot(request)).resolves.toMatchObject({ warnings: ["snapshot 1"] });
    await expect(provider.getSnapshot(request)).resolves.toMatchObject({ warnings: ["snapshot 1"] });

    expect(stationCalls).toBe(1);
    expect(snapshotCalls).toBe(1);
  });

  it("wraps free providers when a cache TTL is configured", () => {
    const providers = createFreeMeteoProviders({ enabledProviders: ["local-astronomy"], cacheTtlMs: 60_000 });

    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("local-astronomy");
  });
});

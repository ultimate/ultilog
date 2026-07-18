import { describe, expect, it } from "vitest";
import { createMeteoProvider, createMeteoService } from "../../app/domain/meteo";

const request = {
  latitude: 54.1,
  longitude: 10.2,
  timestamp: new Date("2026-07-16T12:00:00Z"),
};

describe("meteo provider orchestration", () => {
  it("normalizes provider capabilities and merges provider snapshots", async () => {
    const observedProvider = createMeteoProvider({
      name: "observed-test",
      sourceType: "observed",
      capabilities: { wind: true },
      async getSnapshot(context) {
        return {
          wind: {
            speedKnots: {
              value: 12,
              unit: "kn",
              provenance: {
                provider: "observed-test",
                sourceType: "observed",
                observedAt: context.timestamp,
              },
            },
          },
          sources: [{
            provider: "observed-test",
            sourceType: "observed",
            latitude: context.latitude,
            longitude: context.longitude,
            observedAt: context.timestamp,
          }],
        };
      },
    });
    const fallbackProvider = createMeteoProvider({
      name: "fallback-test",
      sourceType: "fallback",
      capabilities: { wind: true, weather: true },
      async getSnapshot() {
        return {
          weather: {
            condition: {
              value: "partly cloudy",
              unit: "text",
              provenance: { provider: "fallback-test", sourceType: "fallback" },
            },
          },
          wind: {
            speedKnots: {
              value: 10,
              unit: "kn",
              provenance: { provider: "fallback-test", sourceType: "fallback" },
            },
          },
          warnings: [{ code: "meteo.reason.noFreshMetarObservation" }],
        };
      },
    });
    const service = createMeteoService({ providers: [observedProvider, fallbackProvider] });

    const snapshot = await service.getSnapshot(request);

    expect(observedProvider.capabilities.sea).toBe(false);
    expect(snapshot).toMatchObject({
      mode: "auto",
      position: { latitude: request.latitude, longitude: request.longitude },
      wind: { speedKnots: { value: 12 } },
      weather: { condition: { value: "partly cloudy" } },
      warnings: [{ code: "meteo.reason.noFreshMetarObservation" }],
    });
    expect(snapshot.validAt).toEqual(request.timestamp);
    expect(snapshot.sources).toHaveLength(1);
  });

  it("runs only preferred providers when requested", async () => {
    const service = createMeteoService({
      providers: [
        createMeteoProvider({
          name: "ignored-provider",
          sourceType: "observed",
          async getSnapshot() {
            throw new Error("ignored provider should not run");
          },
        }),
        createMeteoProvider({
          name: "selected-provider",
          sourceType: "calculated",
          capabilities: { astronomy: true },
          async getSnapshot() {
            return {
              astronomy: {
                moonPhase: {
                  value: "new moon",
                  unit: "text",
                  provenance: { provider: "selected-provider", sourceType: "calculated" },
                },
              },
            };
          },
        }),
      ],
    });

    await expect(service.getSnapshot({ ...request, preferredProviders: ["selected-provider"] }))
      .resolves.toMatchObject({ astronomy: { moonPhase: { value: "new moon" } } });
  });
});

describe("meteo provider merge priority", () => {
  it("prefers higher-quality source types even when they run later", async () => {
    const fallbackProvider = createMeteoProvider({
      name: "fallback-first",
      sourceType: "fallback",
      capabilities: { wind: true },
      async getSnapshot() {
        return {
          wind: {
            speedKnots: {
              value: 9,
              unit: "kn",
              provenance: { provider: "fallback-first", sourceType: "fallback" },
            },
          },
        };
      },
    });
    const observedProvider = createMeteoProvider({
      name: "observed-second",
      sourceType: "observed",
      capabilities: { wind: true },
      async getSnapshot() {
        return {
          wind: {
            speedKnots: {
              value: 14,
              unit: "kn",
              provenance: { provider: "observed-second", sourceType: "observed" },
            },
          },
        };
      },
    });
    const service = createMeteoService({ providers: [fallbackProvider, observedProvider] });

    await expect(service.getSnapshot(request)).resolves.toMatchObject({
      wind: {
        speedKnots: {
          value: 14,
          provenance: { provider: "observed-second", sourceType: "observed" },
        },
      },
    });
  });

  it("keeps the earlier value when source types have equal rank", async () => {
    const firstObservedProvider = createMeteoProvider({
      name: "first-observed",
      sourceType: "observed",
      async getSnapshot() {
        return {
          weather: {
            pressureHpa: {
              value: 1012,
              unit: "hPa",
              provenance: { provider: "first-observed", sourceType: "observed" },
            },
          },
        };
      },
    });
    const secondObservedProvider = createMeteoProvider({
      name: "second-observed",
      sourceType: "observed",
      async getSnapshot() {
        return {
          weather: {
            pressureHpa: {
              value: 1015,
              unit: "hPa",
              provenance: { provider: "second-observed", sourceType: "observed" },
            },
          },
        };
      },
    });
    const service = createMeteoService({ providers: [firstObservedProvider, secondObservedProvider] });

    await expect(service.getSnapshot(request)).resolves.toMatchObject({
      weather: {
        pressureHpa: {
          value: 1012,
          provenance: { provider: "first-observed", sourceType: "observed" },
        },
      },
    });
  });
});

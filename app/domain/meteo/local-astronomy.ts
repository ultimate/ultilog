import type { MeteoProvider, MeteoProviderContext } from "./provider";
import { createMeteoProvider } from "./provider";

const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
const lunarCycleDays = 29.530588853;
const millisecondsPerDay = 86_400_000;

export type MoonPhase =
  | "new moon"
  | "waxing crescent"
  | "first quarter"
  | "waxing gibbous"
  | "full moon"
  | "waning gibbous"
  | "last quarter"
  | "waning crescent";

export type MoonPhaseDetails = {
  phase: MoonPhase;
  ageDays: number;
  illuminationPercent: number;
};

export function calculateMoonPhase(date: Date): MoonPhaseDetails {
  const ageDays = calculateMoonAgeDays(date);
  const phase = moonPhaseName(ageDays);
  const illuminationPercent = Math.round((1 - Math.cos((2 * Math.PI * ageDays) / lunarCycleDays)) * 50);

  return { phase, ageDays, illuminationPercent };
}

export function createLocalAstronomyProvider(): MeteoProvider {
  return createMeteoProvider({
    name: "local-astronomy",
    label: "Local astronomy calculation",
    sourceType: "calculated",
    capabilities: { astronomy: true },
    async getSnapshot(context) {
      const phase = calculateMoonPhase(context.timestamp);
      const provenance = createLocalAstronomyProvenance(context);

      return {
        validAt: context.timestamp,
        astronomy: {
          moonPhase: {
            value: phase.phase,
            unit: "text",
            provenance,
          },
          moonIlluminationPercent: {
            value: phase.illuminationPercent,
            unit: "%",
            provenance,
          },
        },
        sources: [{
          provider: "local-astronomy",
          providerLabel: "Local astronomy calculation",
          sourceType: "calculated",
          latitude: context.latitude,
          longitude: context.longitude,
          calculatedAt: new Date(),
          validAt: context.timestamp,
          quality: "medium",
          qualityReason: { code: "meteo.reason.localAstronomyCalculated" },
        }],
      };
    },
  });
}

function createLocalAstronomyProvenance(context: MeteoProviderContext) {
  return {
    provider: "local-astronomy",
    providerLabel: "Local astronomy calculation",
    sourceType: "calculated",
    calculatedAt: new Date(),
    validAt: context.timestamp,
    quality: "medium",
    qualityReason: { code: "meteo.reason.localAstronomyCalculated" },
  } as const;
}

function calculateMoonAgeDays(date: Date) {
  const daysSinceKnownNewMoon = (date.getTime() - knownNewMoon) / millisecondsPerDay;
  return positiveModulo(daysSinceKnownNewMoon, lunarCycleDays);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function moonPhaseName(ageDays: number): MoonPhase {
  if (ageDays < 1.84566) return "new moon";
  if (ageDays < 5.53699) return "waxing crescent";
  if (ageDays < 9.22831) return "first quarter";
  if (ageDays < 12.91963) return "waxing gibbous";
  if (ageDays < 16.61096) return "full moon";
  if (ageDays < 20.30228) return "waning gibbous";
  if (ageDays < 23.99361) return "last quarter";
  if (ageDays < 27.68493) return "waning crescent";
  return "new moon";
}

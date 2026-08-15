export type DemoCapacityLimits = {
  windowMs: number;
  perDevice: number;
  perIp: number;
  global: number;
};

const SIX_HOURS_MS = 6 * 60 * 60_000;

const productionLimits: DemoCapacityLimits = { windowMs: SIX_HOURS_MS, perDevice: 2, perIp: 3, global: 100 };
const previewLimits: DemoCapacityLimits = { windowMs: SIX_HOURS_MS, perDevice: 20, perIp: 30, global: 500 };

/** VERCEL_ENV is platform-controlled and equals "preview" only for preview deployments. */
export function demoCapacityLimits(): DemoCapacityLimits {
  return process.env.VERCEL_ENV === "preview" ? previewLimits : productionLimits;
}

import { afterEach, describe, expect, it } from "vitest";
import { demoCapacityLimits } from "../../../../app/lib/demo/demo-capacity";

const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe("demo capacity limits", () => {
  it("keeps restrictive limits in production and local environments", () => {
    process.env.VERCEL_ENV = "production";
    expect(demoCapacityLimits()).toEqual({ windowMs: 21_600_000, perDevice: 2, perIp: 3, global: 100 });
    process.env.VERCEL_ENV = "development";
    expect(demoCapacityLimits()).toEqual({ windowMs: 21_600_000, perDevice: 2, perIp: 3, global: 100 });
  });

  it("raises only Vercel preview deployment limits", () => {
    process.env.VERCEL_ENV = "preview";
    expect(demoCapacityLimits()).toEqual({ windowMs: 21_600_000, perDevice: 20, perIp: 30, global: 500 });
  });
});

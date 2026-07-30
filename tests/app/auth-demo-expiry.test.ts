import { describe, expect, it } from "vitest";
import { isDemoSandboxSessionExpired } from "../../app/lib/demo/demo-session";

describe("demo sandbox session expiry", () => {
  it("allows regular sessions without a sandbox expiry", () => {
    expect(isDemoSandboxSessionExpired(undefined, Date.parse("2026-07-30T12:00:00Z"))).toBe(false);
  });

  it("expires demo sessions exactly at their TTL", () => {
    const expiresAt = "2026-07-30T12:00:00Z";
    expect(isDemoSandboxSessionExpired(expiresAt, Date.parse("2026-07-30T11:59:59Z"))).toBe(false);
    expect(isDemoSandboxSessionExpired(expiresAt, Date.parse(expiresAt))).toBe(true);
    expect(isDemoSandboxSessionExpired("invalid", Date.parse(expiresAt))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

import createNextConfig, { securityHeaders } from "../../next.config";

function asHeaderMap(headers: Array<{ key: string; value: string }>) {
  return new Map(headers.map(({ key, value }) => [key, value]));
}

describe("Next.js security headers", () => {
  it("applies the security policy to every application and API path", async () => {
    const nextConfig = createNextConfig(PHASE_PRODUCTION_BUILD);
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();

    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");

    const headers = asHeaderMap(rules[0].headers);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("X-Frame-Options")).toBe("DENY");

    const csp = headers.get("Content-Security-Policy");
    for (const directive of [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "frame-ancestors",
      "base-uri",
      "object-src",
      "form-action",
    ]) {
      expect(csp).toMatch(new RegExp(`(?:^|; )${directive} `));
    }
    expect(csp).toContain("https://*.tile.openstreetmap.org");
    expect(csp).toContain("https://tiles.openseamap.org");
    expect(csp).toContain("https://www.gravatar.com");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).not.toContain("openai.com");
    expect(csp).not.toMatch(/smtp/i);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("permits eval only for React's development runtime", async () => {
    const developmentConfig = createNextConfig(PHASE_DEVELOPMENT_SERVER);
    const productionConfig = createNextConfig(PHASE_PRODUCTION_BUILD);
    const developmentRules = await developmentConfig.headers!();
    const productionRules = await productionConfig.headers!();

    expect(asHeaderMap(developmentRules[0].headers).get("Content-Security-Policy")).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
    expect(asHeaderMap(productionRules[0].headers).get("Content-Security-Policy")).not.toContain(
      "'unsafe-eval'",
    );
  });

  it("only adds HSTS when the caller has identified production HTTPS", () => {
    expect(asHeaderMap(securityHeaders(false)).has("Strict-Transport-Security")).toBe(false);
    expect(asHeaderMap(securityHeaders(true)).get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });
});

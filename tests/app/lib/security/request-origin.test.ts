import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allowedApplicationOrigins, canonicalApplicationOrigin, guardMutationOrigin } from "../../../../app/lib/security/request-origin";

const deploymentUrlVariables = ["NEXT_PUBLIC_APP_URL", "VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL", "AUTH_URL", "NEXTAUTH_URL"] as const;
const originalUrls = Object.fromEntries(deploymentUrlVariables.map(name => [name, process.env[name]]));

beforeEach(() => {
  for (const name of deploymentUrlVariables) delete process.env[name];
});

afterEach(() => {
  for (const name of deploymentUrlVariables) {
    const original = originalUrls[name];
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

function mutation(headers: HeadersInit = {}) {
  return new Request("https://internal.example/api/profile", { method: "PATCH", headers });
}

describe("mutation request origin guard", () => {
  it("accepts the canonical same origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example/account";
    expect(canonicalApplicationOrigin()).toBe("https://app.example");
    expect(guardMutationOrigin(mutation({ origin: "https://app.example", cookie: "session=value" }))).toBeUndefined();
  });

  it("accepts configured Vercel preview and alias origins without trusting arbitrary hosts", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    process.env.VERCEL_URL = "ultilog-git-feature-team.vercel.app";
    process.env.VERCEL_BRANCH_URL = "ultilog-feature-team.vercel.app";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ultilog.vercel.app";

    expect(allowedApplicationOrigins()).toEqual(new Set([
      "https://app.example",
      "https://ultilog-git-feature-team.vercel.app",
      "https://ultilog-feature-team.vercel.app",
      "https://ultilog.vercel.app",
    ]));
    expect(guardMutationOrigin(mutation({ origin: "https://ultilog-git-feature-team.vercel.app", cookie: "session=value" }))).toBeUndefined();
    expect(guardMutationOrigin(mutation({ origin: "https://ultilog-feature-team.vercel.app", cookie: "session=value" }))).toBeUndefined();
    expect(guardMutationOrigin(mutation({ origin: "https://unconfigured-preview.vercel.app", cookie: "session=value" }))?.status).toBe(403);
  });

  it("rejects a foreign origin", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    const response = guardMutationOrigin(mutation({ origin: "https://evil.example", cookie: "session=value" }));
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ code: "invalid_origin" });
  });

  it.each(["null", "not a url", "https://app.example/path", "https://user@app.example"])("rejects malformed Origin %s", (origin) => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    expect(guardMutationOrigin(mutation({ origin }))?.status).toBe(403);
  });

  it("rejects a missing Origin on cookie-authenticated browser requests", () => {
    expect(guardMutationOrigin(mutation({ cookie: "authjs.session-token=value" }))?.status).toBe(403);
    expect(guardMutationOrigin(mutation({ "sec-fetch-site": "same-origin" }))?.status).toBe(403);
  });

  it("allows an originless, cookieless non-browser request for endpoints using an explicit credential", () => {
    expect(guardMutationOrigin(mutation({ authorization: "Bearer service-token" }))).toBeUndefined();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { canonicalApplicationOrigin, guardMutationOrigin } from "../../../../app/lib/security/request-origin";

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
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

import { expect, it } from "vitest";

type Invoke = (request: Request) => Promise<Response>;

export function fixtureBytes(fixture: unknown) {
  return Buffer.byteLength(JSON.stringify(fixture), "utf8");
}

/** Exercises the header fast path and the bytes actually read from a UTF-8 body. */
export function testRequestBodyLimit(options: {
  name: string;
  url: string;
  method: string;
  limit: number;
  fixtures: { minimal: unknown; representative: unknown; nearMaximum: unknown };
  invoke: Invoke;
  headers?: HeadersInit;
}) {
  const { name, url, method, limit, fixtures, invoke, headers } = options;
  const sizes = Object.fromEntries(Object.entries(fixtures).map(([key, value]) => [key, fixtureBytes(value)]));
  console.info(`[request-body fixtures] ${name}: ${JSON.stringify(sizes)}`);

  it(`${name} records minimal, representative, and near-maximum fixture sizes`, () => {
    expect(sizes.minimal).toBeGreaterThan(0);
    expect(sizes.minimal).toBeLessThan(sizes.representative);
    expect(sizes.representative).toBeLessThanOrEqual(sizes.nearMaximum);
    expect(sizes.nearMaximum).toBeLessThanOrEqual(limit);
  });

  it(`${name} enforces declared Content-Length`, async () => {
    const body = JSON.stringify(fixtures.representative);
    const accepted = await invoke(new Request(url, { method, headers: { ...headers, "content-length": String(limit) }, body }));
    expect(accepted.status).toBeLessThan(400);
    const rejected = await invoke(new Request(url, { method, headers: { ...headers, "content-length": String(limit + 1) }, body }));
    expect(rejected.status).toBe(413);
    await expect(rejected.json()).resolves.toMatchObject({ code: "request_body_too_large" });
  });

  it(`${name} enforces actual UTF-8 bytes at the exact boundary`, async () => {
    const json = JSON.stringify(fixtures.nearMaximum);
    const atLimit = json + " ".repeat(limit - Buffer.byteLength(json, "utf8"));
    expect(Buffer.byteLength(atLimit, "utf8")).toBe(limit);
    expect((await invoke(new Request(url, { method, headers, body: atLimit }))).status).toBeLessThan(400);

    const oneByteOver = `${atLimit} `;
    expect(Buffer.byteLength(oneByteOver, "utf8")).toBe(limit + 1);
    const rejected = await invoke(new Request(url, { method, headers, body: oneByteOver }));
    expect(rejected.status).toBe(413);
    await expect(rejected.json()).resolves.toMatchObject({ code: "request_body_too_large" });
  });
}

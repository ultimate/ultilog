import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public changelog route", () => {
  it("keeps both the page and its generated artifact outside authentication", () => {
    const proxy = readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("changelog|generated|legal");
  });
});

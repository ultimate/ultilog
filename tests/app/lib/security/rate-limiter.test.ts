import { describe, expect, it } from "vitest";
import { consumeRateLimit, type RateLimitStore } from "../../../../app/lib/security/rate-limiter";

function memoryStore(): RateLimitStore {
  const counters = new Map<string, { count: number; expiresAt: string }>();
  return {
    async increment(scope, window, expiresAt) {
      const key = `${scope}:${window}`;
      const next = (counters.get(key)?.count ?? 0) + 1;
      counters.set(key, { count: next, expiresAt });
      return next;
    },
    async cleanup(now) {
      for (const [key, value] of counters) if (value.expiresAt < now) counters.delete(key);
    },
  };
}

describe("shared rate limiter", () => {
  const rule = { name: "test", limit: 2, windowMs: 1_000 };

  it("enforces the threshold and reports retry timing", async () => {
    const store = memoryStore();
    expect((await consumeRateLimit(rule, "ip-a", new Date(100), store)).allowed).toBe(true);
    expect((await consumeRateLimit(rule, "ip-a", new Date(200), store)).allowed).toBe(true);
    const denied = await consumeRateLimit(rule, "ip-a", new Date(250), store);
    expect(denied).toMatchObject({ allowed: false, remaining: 0, retryAfter: 1 });
  });

  it("starts a fresh quota after the window expires", async () => {
    const store = memoryStore();
    await consumeRateLimit({ ...rule, limit: 1 }, "user-a", new Date(900), store);
    expect((await consumeRateLimit({ ...rule, limit: 1 }, "user-a", new Date(999), store)).allowed).toBe(false);
    expect((await consumeRateLimit({ ...rule, limit: 1 }, "user-a", new Date(1_000), store)).allowed).toBe(true);
  });

  it("keeps principals and rules separate", async () => {
    const store = memoryStore();
    await consumeRateLimit({ ...rule, limit: 1 }, "user-a", new Date(100), store);
    expect((await consumeRateLimit({ ...rule, limit: 1 }, "user-b", new Date(100), store)).allowed).toBe(true);
    expect((await consumeRateLimit({ ...rule, name: "other", limit: 1 }, "user-a", new Date(100), store)).allowed).toBe(true);
  });
});

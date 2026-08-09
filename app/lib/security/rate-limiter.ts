import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "../logbook-store";

export type RateLimitRule = { name: string; limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number; resetAt: Date };
export type RateLimitStore = {
  increment(scopeKey: string, windowStart: string, expiresAt: string): Promise<number>;
  cleanup(now: string): Promise<void>;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function requestIp(request: Request) {
  // The deployment proxy must replace, rather than append to, these headers.
  return (request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim() || "unknown";
}

export function requestDevice(request: Request) {
  return request.headers.get("x-device-id")?.trim() || request.headers.get("user-agent")?.trim() || "unknown";
}

export function privatePrincipal(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function consumeRateLimit(rule: RateLimitRule, principal: string, now = new Date(), store: RateLimitStore = databaseRateLimitStore): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now.getTime() / rule.windowMs) * rule.windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const resetAt = new Date(windowStartMs + rule.windowMs);
  const scopeKey = `${rule.name}:${privatePrincipal(principal)}`;

  const count = await store.increment(scopeKey, windowStart, resetAt.toISOString());
  // Opportunistic cleanup keeps this shared table bounded without a scheduler.
  if (count === 1) await store.cleanup(now.toISOString());

  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfter, resetAt };
}

const databaseRateLimitStore: RateLimitStore = {
  async increment(scopeKey, windowStart, expiresAt) {
    const db = getDatabase();
    await db.migrate();
    await db.query(`
      insert into security_rate_limits (scope_key, window_start, request_count, expires_at)
      values (${db.placeholder(1)}, ${db.placeholder(2)}, 1, ${db.placeholder(3)})
      on conflict (scope_key, window_start) do update set request_count = security_rate_limits.request_count + 1
    `, [scopeKey, windowStart, expiresAt]);
    const count = Number((await db.query<{ request_count: number | string }>(
      `select request_count from security_rate_limits where scope_key = ${db.placeholder(1)} and window_start = ${db.placeholder(2)}`,
      [scopeKey, windowStart],
    )).rows[0]?.request_count) || 1;
    await db.flush();
    return count;
  },
  async cleanup(now) {
    const db = getDatabase();
    await db.query(`delete from security_rate_limits where expires_at < ${db.placeholder(1)}`, [now]);
    await db.flush();
  },
};

export async function enforceRateLimits(entries: Array<{ rule: RateLimitRule; principal: string }>) {
  for (const entry of entries) {
    const result = await consumeRateLimit(entry.rule, entry.principal);
    if (!result.allowed) {
      securityEvent("rate_limit_exceeded", { rule: entry.rule.name, principalHash: privatePrincipal(entry.principal), retryAfter: result.retryAfter });
      return result;
    }
  }
  return undefined;
}

export function rateLimitResponse(result: RateLimitResult, message = "Too many requests. Please try again later.") {
  return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(result.retryAfter) } });
}

export function securityEvent(event: string, details: Record<string, string | number | boolean>) {
  console.info(JSON.stringify({ type: "security", event, ...details, timestamp: new Date().toISOString() }));
}

import { NextResponse } from "next/server";
import { requestPasswordReset } from "../../../lib/users";
import { enforceRateLimits, normalizeEmail, rateLimitResponse, requestIp } from "../../../lib/security/rate-limiter";

const genericMessage = "If an account exists for that email, a password reset link has been sent.";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const limited = await enforceRateLimits([
      { rule: { name: "password-reset-ip", limit: 10, windowMs: 60 * 60_000 }, principal: requestIp(request) },
      { rule: { name: "password-reset-email", limit: 3, windowMs: 60 * 60_000 }, principal: normalizeEmail(body.email ?? "") },
    ]);
    if (limited) return rateLimitResponse(limited, genericMessage);
    await requestPasswordReset(body.email ?? "");
    return NextResponse.json({ message: genericMessage });
  } catch {
    return NextResponse.json({ message: genericMessage });
  }
}

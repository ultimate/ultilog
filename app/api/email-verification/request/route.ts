import { NextResponse } from "next/server";
import { requestEmailVerification } from "../../../lib/users";
import { enforceRateLimits, normalizeEmail, rateLimitResponse, requestIp } from "../../../lib/security/rate-limiter";

const genericMessage = "If the email is registered and still unverified, a new verification link has been sent.";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const limited = await enforceRateLimits([
      { rule: { name: "verification-ip", limit: 10, windowMs: 60 * 60_000 }, principal: requestIp(request) },
      { rule: { name: "verification-email", limit: 3, windowMs: 60 * 60_000 }, principal: normalizeEmail(body.email ?? "") },
    ]);
    if (limited) return rateLimitResponse(limited, genericMessage);
    await requestEmailVerification(body.email ?? "");
    return NextResponse.json({ message: genericMessage });
  } catch {
    return NextResponse.json({ message: genericMessage });
  }
}

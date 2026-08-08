import { NextResponse } from "next/server";
import { registerUser } from "../../lib/users";
import { enforceRateLimits, normalizeEmail, rateLimitResponse, requestIp } from "../../lib/security/rate-limiter";

const IP_LIMIT = { name: "register-ip", limit: 10, windowMs: 60 * 60_000 };
const EMAIL_LIMIT = { name: "register-email", limit: 5, windowMs: 60 * 60_000 };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const limited = await enforceRateLimits([
      { rule: IP_LIMIT, principal: requestIp(request) },
      { rule: EMAIL_LIMIT, principal: normalizeEmail(body.email ?? "") },
    ]);
    if (limited) return rateLimitResponse(limited);
    const user = await registerUser({ name: body.name ?? "", email: body.email ?? "", password: body.password ?? "" });
    return NextResponse.json(user, { status: 201 });
  } catch {
    // A uniform response prevents registration from becoming an account-enumeration oracle.
    return NextResponse.json({ error: "Unable to register with the supplied details." }, { status: 400 });
  }
}

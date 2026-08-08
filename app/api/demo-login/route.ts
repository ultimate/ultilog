import { NextResponse } from "next/server";
import { createDemoSandbox, DemoCapacityError } from "../../lib/demo/demo-sandboxes";
import { enforceRateLimits, privatePrincipal, rateLimitResponse, requestDevice, requestIp } from "../../lib/security/rate-limiter";

export async function POST(request: Request = new Request("http://localhost/api/demo-login", { method: "POST" })) {
  try {
    const ip = requestIp(request);
    const device = requestDevice(request);
    const limited = await enforceRateLimits([
      { rule: { name: "demo-ip", limit: 3, windowMs: 6 * 60 * 60_000 }, principal: ip },
      { rule: { name: "demo-device", limit: 2, windowMs: 6 * 60 * 60_000 }, principal: device },
      { rule: { name: "demo-global", limit: 100, windowMs: 6 * 60 * 60_000 }, principal: "global" },
    ]);
    if (limited) return rateLimitResponse(limited, "Demo capacity is temporarily full. Please try again later.");
    return NextResponse.json(await createDemoSandbox({ ipHash: privatePrincipal(ip), deviceHash: privatePrincipal(device) }));
  } catch (error) {
    if (error instanceof DemoCapacityError) {
      return NextResponse.json({ error: "Demo capacity is temporarily full. Please try again later." }, { status: 429, headers: { "Retry-After": "300" } });
    }
    console.error("Unable to create demo sandbox", error);
    return NextResponse.json({ error: "Demo is temporarily unavailable." }, { status: 503 });
  }
}

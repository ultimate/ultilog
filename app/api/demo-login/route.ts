import { NextResponse } from "next/server";
import { createDemoSandbox, DemoCapacityError } from "../../lib/demo/demo-sandboxes";
import { enforceRateLimits, privatePrincipal, rateLimitResponse, requestDevice, requestIp } from "../../lib/security/rate-limiter";
import { demoCapacityLimits } from "../../lib/demo/demo-capacity";

export async function POST(request: Request = new Request("http://localhost/api/demo-login", { method: "POST" })) {
  try {
    const ip = requestIp(request);
    const device = requestDevice(request);
    const limits = demoCapacityLimits();
    const limited = await enforceRateLimits([
      { rule: { name: "demo-ip", limit: limits.perIp, windowMs: limits.windowMs }, principal: ip },
      { rule: { name: "demo-device", limit: limits.perDevice, windowMs: limits.windowMs }, principal: device },
      { rule: { name: "demo-global", limit: limits.global, windowMs: limits.windowMs }, principal: "global" },
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

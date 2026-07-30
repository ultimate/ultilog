import { NextResponse } from "next/server";
import { cleanupExpiredDemoSandboxes } from "../../lib/demo/demo-sandboxes";

async function cleanup(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.DEMO_CLEANUP_SECRET;
  if (!secret) return NextResponse.json({ error: "Demo cleanup is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await cleanupExpiredDemoSandboxes());
  } catch (error) {
    console.error("Unable to clean up demo sandboxes", error);
    return NextResponse.json({ error: "Unable to clean up demo sandboxes." }, { status: 500 });
  }
}

export const GET = cleanup;
export const POST = cleanup;

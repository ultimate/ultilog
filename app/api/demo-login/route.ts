import { NextResponse } from "next/server";
import { createDemoSandbox } from "../../lib/demo/demo-sandboxes";

export async function POST() {
  try {
    return NextResponse.json(await createDemoSandbox());
  } catch (error) {
    console.error("Unable to create demo sandbox", error);
    return NextResponse.json({ error: "Demo is temporarily unavailable." }, { status: 503 });
  }
}

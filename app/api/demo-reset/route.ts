import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { resetDemoSandbox } from "../../lib/demo/demo-sandboxes";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const logbook = await resetDemoSandbox(session.user.id);
    if (!logbook) return NextResponse.json({ error: "Only an active demo sandbox can be reset." }, { status: 403 });
    return NextResponse.json({ logbook });
  } catch (error) {
    console.error("Unable to reset demo sandbox", error);
    return NextResponse.json({ error: "Unable to reset demo data." }, { status: 500 });
  }
}

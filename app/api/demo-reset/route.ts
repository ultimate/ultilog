import { NextResponse } from "next/server";
import { guardMutationOrigin } from "../../lib/security/request-origin";
import { auth } from "../../../auth";
import { resetDemoSandbox } from "../../lib/demo/demo-sandboxes";

export async function POST(request: Request = new Request("http://localhost/api/demo-reset", { method: "POST" })) {
  const originError = guardMutationOrigin(request);
  if (originError) return originError;
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

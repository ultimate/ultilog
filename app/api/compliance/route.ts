import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getUserComplianceState, selectUserComplianceLicense, setManualRequirementCompleted, setUserComplianceLicenseStartDate } from "../../lib/compliance";
import { guardMutationOrigin } from "../../lib/security/request-origin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getUserComplianceState(session.user.id));
}

export async function PATCH(request: Request) {
  const originError = guardMutationOrigin(request);
  if (originError) return originError;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("A JSON object is required.");
    const input = body as Record<string, unknown>;
    if (input.action === "select-license") {
      if (typeof input.selected !== "boolean") throw new Error("Selected must be a boolean.");
      return NextResponse.json(await selectUserComplianceLicense(session.user.id, input.licenseId, input.selected));
    }
    if (input.action === "license-start-date") {
      return NextResponse.json(await setUserComplianceLicenseStartDate(session.user.id, input.licenseId, input.startDate));
    }
    if (input.action === "manual-requirement") {
      return NextResponse.json(await setManualRequirementCompleted(session.user.id, input.licenseId, input.requirementId, input.completed));
    }
    return NextResponse.json({ error: "Unsupported compliance update." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update compliance state." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { validateDemoUser } from "../../lib/users";

export async function POST() {
  const user = await validateDemoUser();
  if (!user) return NextResponse.json({ error: "Demo user is not available." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

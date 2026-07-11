import { NextResponse } from "next/server";
import { verifyEmailWithToken } from "../../../lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string };
    await verifyEmailWithToken(body.token ?? "");
    return NextResponse.json({ message: "Email verified." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify email." }, { status: 400 });
  }
}

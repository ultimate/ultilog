import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "../../../lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; password?: string };
    await resetPasswordWithToken(body.token ?? "", body.password ?? "");
    return NextResponse.json({ message: "Password updated." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reset password." }, { status: 400 });
  }
}

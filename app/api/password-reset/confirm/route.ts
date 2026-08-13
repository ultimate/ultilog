import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "../../../lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; password?: string };
    await resetPasswordWithToken(body.token ?? "", body.password ?? "");
    return NextResponse.json({ message: "Password updated." });
  } catch {
    return NextResponse.json({ error: "Unable to reset password with the supplied details." }, { status: 400 });
  }
}

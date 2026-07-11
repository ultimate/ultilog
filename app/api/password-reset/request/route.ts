import { NextResponse } from "next/server";
import { requestPasswordReset } from "../../../lib/users";

const genericMessage = "If an account exists for that email, a password reset link has been sent.";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    await requestPasswordReset(body.email ?? "");
    return NextResponse.json({ message: genericMessage });
  } catch {
    return NextResponse.json({ message: genericMessage });
  }
}

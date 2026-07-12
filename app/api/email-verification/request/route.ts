import { NextResponse } from "next/server";
import { requestEmailVerification } from "../../../lib/users";

const genericMessage = "If the email is registered and still unverified, a new verification link has been sent.";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    await requestEmailVerification(body.email ?? "");
    return NextResponse.json({ message: genericMessage });
  } catch {
    return NextResponse.json({ message: genericMessage });
  }
}

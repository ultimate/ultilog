import { NextResponse } from "next/server";
import { registerUser } from "../../lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const user = await registerUser({ name: body.name ?? "", email: body.email ?? "", password: body.password ?? "" });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to register." }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const isLoggedIn = request.cookies.has("authjs.session-token") || request.cookies.has("__Secure-authjs.session-token");
  if (isLoggedIn) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!api/auth|api/register|api/demo-login|api/password-reset|login|register|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)"],
};

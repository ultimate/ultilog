import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (isPublicShareRequest(request.nextUrl.pathname)) return NextResponse.next();

  const isLoggedIn = request.cookies.has("authjs.session-token") || request.cookies.has("__Secure-authjs.session-token");
  if (isLoggedIn) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

function isPublicShareRequest(pathname: string) {
  return pathname === "/share" || pathname.startsWith("/share/") || pathname.startsWith("/api/shared/logbooks");
}

export const config = {
  matcher: ["/((?!api/auth|api/register|api/demo-login|api/password-reset|login|register|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)"],
};

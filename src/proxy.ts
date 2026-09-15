import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Roles scoped to the ministry-clearance module only ever get their own
// portal -- never the internal ops app (which shows every client's data).
// Enforced here (not just via hidden nav links) so a direct URL can't
// bypass it.
const ROLE_HOME: Record<string, string> = {
  VENDOR: "/my-shipments",
  MINISTRY_OFFICER: "/ministry",
  MINISTRY_REGISTRAR: "/ministries",
  LOGISTICS_STAFF: "/deliveries",
};
const ALWAYS_ALLOWED_PREFIXES = ["/notifications", "/login"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (isLoggedIn) {
    const role = req.auth?.user.role;
    const home = role ? ROLE_HOME[role] : undefined;
    if (home) {
      const path = req.nextUrl.pathname;
      const allowed =
        path.startsWith(home) ||
        ALWAYS_ALLOWED_PREFIXES.some((p) => path.startsWith(p));
      if (!allowed) {
        return NextResponse.redirect(new URL(home, req.nextUrl.origin));
      }
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};

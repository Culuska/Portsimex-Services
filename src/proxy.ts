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
const ALWAYS_ALLOWED_PREFIXES = ["/notifications", "/login", "/account", "/change-password", "/no-access", "/verify-email"];
// Reachable without signing in (password reset and email verification links).
const PUBLIC_PREFIXES = ["/forgot-password", "/reset-password", "/verify-email"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");
  if (PUBLIC_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p))) return;

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ?ended=1 / ?reset=1: the server ended this session (signed out
  // everywhere, password changed, deactivated, expired) even though the
  // cookie still exists -- show the sign-in page instead of bouncing.
  const sp = req.nextUrl.searchParams;
  if (isLoggedIn && isAuthRoute && !sp.has("ended") && !sp.has("reset")) {
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

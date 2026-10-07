import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/roles";

export default {
  // The cookie lasts at most 30 days; the real session length (Settings →
  // session hours) and sign-out-everywhere are enforced server-side in
  // lib/session.ts against the database on every request.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.ministryId = user.ministryId ?? null;
        token.vendorClientId = user.vendorClientId ?? null;
        token.sessionVersion = user.sessionVersion ?? 0;
        token.loginAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.ministryId = (token.ministryId as string | null) ?? null;
        session.user.vendorClientId = (token.vendorClientId as string | null) ?? null;
        session.user.sessionVersion = (token.sessionVersion as number | undefined) ?? 0;
        session.user.loginAt = token.loginAt as number | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/roles";

export default {
  session: { strategy: "jwt" },
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.ministryId = (token.ministryId as string | null) ?? null;
        session.user.vendorClientId = (token.vendorClientId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

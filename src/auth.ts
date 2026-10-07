import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/auth.config";
import { clientIp, verifyLogin } from "@/lib/login";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        code: {},
      },
      // Lockout, password and two-factor checks all live in verifyLogin.
      authorize: async (credentials, request) =>
        verifyLogin({ email: credentials?.email, password: credentials?.password, code: credentials?.code, ip: clientIp(request.headers) }),
    }),
  ],
  logger: {
    // A wrong password is expected, not a server error worth a stack trace.
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error(error);
    },
  },
});

import { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role?: Role;
    ministryId?: string | null;
    vendorClientId?: string | null;
    sessionVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      ministryId: string | null;
      vendorClientId: string | null;
      sessionVersion: number;
      loginAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    ministryId?: string | null;
    vendorClientId?: string | null;
    sessionVersion?: number;
    loginAt?: number;
  }
}

import { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role?: Role;
    ministryId?: string | null;
    vendorClientId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      ministryId: string | null;
      vendorClientId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    ministryId?: string | null;
    vendorClientId?: string | null;
  }
}

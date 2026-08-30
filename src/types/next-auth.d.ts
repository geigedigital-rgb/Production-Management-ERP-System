import { DefaultSession } from "next-auth";
import type { Permission, UserRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      permissions: Permission[];
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    permissions: Permission[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    permissions: Permission[];
  }
}

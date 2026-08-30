import type { NextAuthConfig } from "next-auth";
import type { Permission, UserRole } from "@/lib/permissions";
import { resolveUserPermissions } from "@/lib/permissions";

/**
 * Edge-compatible auth config (no Prisma / bcrypt).
 * Used by middleware. Full Credentials provider lives in index.ts.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname.startsWith("/api/auth");
      const isLoggedIn = !!auth?.user;

      if (isPublic) {
        if (isLoggedIn && pathname.startsWith("/login")) {
          return Response.redirect(new URL("/overview", request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: UserRole }).role;
        token.permissions = (user as { permissions: Permission[] }).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.permissions = (token.permissions as Permission[]) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

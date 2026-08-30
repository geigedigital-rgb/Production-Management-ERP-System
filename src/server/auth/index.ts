import type { Permission, UserRole } from "@/lib/permissions";
import { resolveUserPermissions } from "@/lib/permissions";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { authConfig } from "./config";

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findFirst({
          where: {
            isActive: true,
            OR: [{ email: email.toLowerCase() }, { login: email }],
          },
        });

        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          permissions: resolveUserPermissions({
            role: user.role as UserRole,
            permissions: user.permissions,
          }),
        };
      },
    }),
  ],
});

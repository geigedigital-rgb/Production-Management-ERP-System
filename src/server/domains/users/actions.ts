"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { assertSessionPermission } from "@/server/auth/access";
import {
  DEFAULT_MANAGER_PERMISSIONS,
  isPermission,
  normalizeStoredPermissions,
  type Permission,
  type UserRole,
} from "@/lib/permissions";
import { prisma } from "@/server/db/client";

export async function bulkDeactivateUsersAction(formData: FormData) {
  await assertSessionPermission("manageUsers");

  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const ids = formData
    .getAll("ids")
    .map(String)
    .filter((id) => id && id !== session.user.id);

  if (ids.length === 0) return { ok: false as const, error: "EMPTY" as const };

  const result = await prisma.user.updateMany({
    where: { id: { in: ids }, isActive: true },
    data: { isActive: false },
  });

  revalidatePath("/settings/users");
  return { ok: true as const, count: result.count };
}

const updateAccessSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMINISTRATOR", "MANAGER"]),
  permissions: z.array(z.string()),
});

export async function updateUserAccessAction(formData: FormData) {
  await assertSessionPermission("manageUsers");

  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const parsed = updateAccessSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    role: String(formData.get("role") ?? ""),
    permissions: formData.getAll("permissions").map(String),
  });

  if (!parsed.success) return { ok: false as const, error: "INVALID" as const };

  const { userId, role } = parsed.data;
  if (userId === session.user.id && role !== "ADMINISTRATOR") {
    return { ok: false as const, error: "SELF_DEMOTE" as const };
  }

  const permissions =
    role === "ADMINISTRATOR"
      ? []
      : normalizeStoredPermissions(parsed.data.permissions.filter(isPermission));

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: role as UserRole,
      permissions,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  login: z.string().trim().optional(),
  password: z.string().min(8),
  role: z.enum(["ADMINISTRATOR", "MANAGER"]),
});

export async function createUserAction(formData: FormData) {
  await assertSessionPermission("manageUsers");

  const permissionsRaw = formData.getAll("permissions").map(String).filter(isPermission);
  const parsed = createUserSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    login: String(formData.get("login") ?? "") || undefined,
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "MANAGER"),
  });

  if (!parsed.success) return { ok: false as const, error: "INVALID" as const };

  const { name, email, login, password, role } = parsed.data;
  const emailLower = email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: emailLower }, ...(login ? [{ login }] : [])] },
    select: { id: true },
  });
  if (existing) return { ok: false as const, error: "DUPLICATE" as const };

  const permissions =
    role === "ADMINISTRATOR"
      ? []
      : permissionsRaw.length > 0
        ? normalizeStoredPermissions(permissionsRaw)
        : DEFAULT_MANAGER_PERMISSIONS;

  const passwordHash = await hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email: emailLower,
      login: login || null,
      passwordHash,
      role: role as UserRole,
      permissions,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function resetUserPermissionsAction(formData: FormData) {
  await assertSessionPermission("manageUsers");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false as const, error: "INVALID" as const };

  await prisma.user.update({
    where: { id: userId, role: "MANAGER" },
    data: { permissions: [...DEFAULT_MANAGER_PERMISSIONS] },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}

export type { Permission };

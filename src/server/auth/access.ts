import { cache } from "react";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";
import {
  resolveUserPermissions,
  type Permission,
  type UserRole,
} from "@/lib/permissions";

export type UserAccess = {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  name: string;
  email: string;
};

export const getCurrentUserAccess = cache(async (): Promise<UserAccess | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      permissions: true,
      isActive: true,
      name: true,
      email: true,
    },
  });

  if (!user?.isActive) return null;

  return {
    userId: user.id,
    role: user.role as UserRole,
    permissions: resolveUserPermissions({
      role: user.role as UserRole,
      permissions: user.permissions,
    }),
    name: user.name,
    email: user.email,
  };
});

export async function assertSessionPermission(permission: Permission): Promise<UserAccess> {
  const access = await getCurrentUserAccess();
  if (!access) throw new Error("UNAUTHORIZED");
  if (!access.permissions.includes(permission)) throw new Error("FORBIDDEN");
  return access;
}

export function accessHas(access: UserAccess | null, permission: Permission): boolean {
  return access?.permissions.includes(permission) ?? false;
}

/** After DRAFT, BOM edits require calc rights (admin). Managers assemble only in DRAFT. */
export function canEditOrderComposition(
  access: UserAccess | null,
  orderStatus: string,
): boolean {
  if (!access) return false;
  if (!accessHas(access, "manageOrders")) return false;
  if (orderStatus === "DRAFT") return true;
  return accessHas(access, "saveVersions");
}

export function canViewOrderCosts(access: UserAccess | null): boolean {
  return accessHas(access, "viewProductCosts") || accessHas(access, "saveVersions");
}

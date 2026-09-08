export type UserRole = "ADMINISTRATOR" | "MANAGER";

export const PERMISSIONS = {
  manageUsers: "manageUsers",
  managePricingRules: "managePricingRules",
  manageCatalogs: "manageCatalogs",
  archiveRecords: "archiveRecords",
  activateProducts: "activateProducts",
  saveAsStandardProduct: "saveAsStandardProduct",
  approveBelowMinMargin: "approveBelowMinMargin",
  manageOrders: "manageOrders",
  manageClients: "manageClients",
  createInlineCatalog: "createInlineCatalog",
  adjustPriceInRange: "adjustPriceInRange",
  saveVersions: "saveVersions",
  generateQuotations: "generateQuotations",
  changeOrderStatus: "changeOrderStatus",
  /** Product list/detail prices, economics, BOM money columns; order calc/cost rails. */
  viewProductCosts: "viewProductCosts",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Manager: assemble orders (DRAFT) + clients.
 * Calculation, proposals, catalogs, product costs — admin (or explicitly granted).
 */
export const DEFAULT_MANAGER_PERMISSIONS: Permission[] = [
  PERMISSIONS.manageOrders,
  PERMISSIONS.manageClients,
];

export type PermissionMeta = {
  key: Permission;
  label: string;
  group: string;
  adminOnly?: boolean;
};

export const PERMISSION_META: PermissionMeta[] = [
  {
    key: PERMISSIONS.manageOrders,
    label: "Створення та комплектація замовлень (до розрахунку)",
    group: "Замовлення",
  },
  {
    key: PERMISSIONS.saveVersions,
    label: "Розрахунок і збереження пропозицій калькуляції",
    group: "Замовлення",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.changeOrderStatus,
    label: "Погодження пропозицій та передача у виробництво",
    group: "Замовлення",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.generateQuotations,
    label: "Формування комерційних пропозицій (КП)",
    group: "Замовлення",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.adjustPriceInRange,
    label: "Коригування ціни в дозволеному діапазоні",
    group: "Замовлення",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.approveBelowMinMargin,
    label: "Збереження нижче мінімальної маржі",
    group: "Замовлення",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.viewProductCosts,
    label: "Ціни та калькуляція виробів / собівартість у замовленні",
    group: "Замовлення",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.manageClients,
    label: "Клієнти: створення та редагування",
    group: "Довідники",
  },
  {
    key: PERMISSIONS.createInlineCatalog,
    label: "Швидке додавання записів у довідники",
    group: "Довідники",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.manageCatalogs,
    label: "База матеріалів, операцій і нанесень",
    group: "Довідники",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.archiveRecords,
    label: "Архівування записів",
    group: "Довідники",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.activateProducts,
    label: "Активація виробів",
    group: "Каталог",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.saveAsStandardProduct,
    label: "Збереження як еталонний виріб",
    group: "Каталог",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.managePricingRules,
    label: "Правила ціноутворення та реквізити компанії",
    group: "Налаштування",
    adminOnly: true,
  },
  {
    key: PERMISSIONS.manageUsers,
    label: "Керування користувачами та правами",
    group: "Налаштування",
    adminOnly: true,
  },
];

export function isPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.includes(value as Permission);
}

export function resolveUserPermissions(user: {
  role: UserRole;
  permissions: string[];
}): Permission[] {
  if (user.role === "ADMINISTRATOR") return ALL_PERMISSIONS;
  const stored = user.permissions.filter(isPermission);
  return stored.length > 0 ? stored : DEFAULT_MANAGER_PERMISSIONS;
}

export function hasUserPermission(
  user: { role: UserRole; permissions?: string[] },
  permission: Permission,
): boolean {
  return resolveUserPermissions({
    role: user.role,
    permissions: user.permissions ?? [],
  }).includes(permission);
}

/** @deprecated Prefer hasUserPermission with permissions from DB. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return hasUserPermission({ role, permissions: [] }, permission);
}

export function assertUserPermission(
  user: { role: UserRole; permissions?: string[] },
  permission: Permission,
): void {
  if (!hasUserPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
}

/** @deprecated Prefer assertSessionPermission from server/auth/access. */
export function assertPermission(role: UserRole, permission: Permission): void {
  assertUserPermission({ role, permissions: [] }, permission);
}

export function normalizeStoredPermissions(values: string[]): Permission[] {
  const unique = [...new Set(values.filter(isPermission))];
  return unique.length > 0 ? unique : DEFAULT_MANAGER_PERMISSIONS;
}

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import {
  Table,
  TableCard,
  TableToolbar,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { IconCheck, IconClose } from "@/components/ui/Icons";
import { PERMISSION_META, resolveUserPermissions, type UserRole } from "@/lib/permissions";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";
import { prisma } from "@/server/db/client";
import { UsersTable, type UsersTableRow } from "@/components/settings/UsersTable";
import { UserCreatePanel } from "@/components/settings/UserAccessPanel";

const roleLabels: Record<string, string> = {
  ADMINISTRATOR: "Адміністратор",
  MANAGER: "Менеджер",
};

export default async function UsersSettingsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");

  const canManage = accessHas(access, "manageUsers");

  const users = await prisma.user
    .findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })
    .catch(() => []);

  const rows: UsersTableRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    permissions: user.permissions,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    isSelf: user.id === access.userId || user.email === access.email,
  }));

  const managerDefaults = resolveUserPermissions({ role: "MANAGER", permissions: [] });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Користувачі та права"
        description="Адміністратор призначає роль і окремі дозволи. Менеджер за замовчуванням отримує типовий набір — його можна змінити для кожного користувача."
      />

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Користувачі</span>}
          right={
            <div className="flex items-center gap-2">
              <span className="type-caption tabular">{users.length}</span>
              <UserCreatePanel canManage={canManage} />
            </div>
          }
        />
        <UsersTable rows={rows} canManage={canManage} />
      </TableCard>

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Довідник прав</span>}
          right={
            <span className="type-caption">
              Ваша роль: {roleLabels[access.role] ?? access.role}
            </span>
          }
        />
        <Table>
          <THead>
            <TH>Дія</TH>
            <TH align="center" width="150px">
              Адміністратор
            </TH>
            <TH align="center" width="150px">
              Менеджер (типово)
            </TH>
          </THead>
          <TBody>
            {PERMISSION_META.map((row) => (
              <TR key={row.key}>
                <TD>{row.label}</TD>
                <TD align="center">
                  <IconCheck size={16} className="mx-auto text-[var(--color-success-text)]" />
                </TD>
                <TD align="center">
                  {managerDefaults.includes(row.key) ? (
                    <IconCheck size={16} className="mx-auto text-[var(--color-success-text)]" />
                  ) : (
                    <IconClose size={16} className="mx-auto text-[var(--color-text-tertiary)]" />
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableCard>

      {!canManage ? (
        <Banner tone="info">
          Ви бачите список у режимі перегляду. Призначення прав доступне адміністратору з
          дозволом «Керування користувачами».
        </Banner>
      ) : (
        <Banner tone="info" title="Як це працює">
          Натисніть «Права» біля користувача, щоб змінити роль або окремі дозволи. Після зміни
          користувачу потрібно вийти і увійти знову, щоб оновити сесію.
        </Banner>
      )}
    </div>
  );
}

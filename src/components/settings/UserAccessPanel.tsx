"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormGroup, Select } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { SidePanel } from "@/components/ui/Overlay";
import {
  DEFAULT_MANAGER_PERMISSIONS,
  PERMISSION_META,
  resolveUserPermissions,
  type Permission,
  type UserRole,
} from "@/lib/permissions";
import {
  createUserAction,
  resetUserPermissionsAction,
  updateUserAccessAction,
} from "@/server/domains/users/actions";

export type UserAccessRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  isSelf: boolean;
};

const roleLabels: Record<UserRole, string> = {
  ADMINISTRATOR: "Адміністратор",
  MANAGER: "Менеджер",
};

function PermissionChecklist({
  role,
  selected,
  onChange,
}: {
  role: UserRole;
  selected: Permission[];
  onChange: (next: Permission[]) => void;
}) {
  if (role === "ADMINISTRATOR") {
    return (
      <Banner tone="info">
        Адміністратор має повний доступ до всіх дій. Окремі права не налаштовуються.
      </Banner>
    );
  }

  const groups = [...new Set(PERMISSION_META.map((row) => row.group))];

  function toggle(key: Permission, checked: boolean) {
    onChange(checked ? [...selected, key] : selected.filter((item) => item !== key));
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
            {group}
          </h4>
          <div className="space-y-1.5">
            {PERMISSION_META.filter((row) => row.group === group).map((row) => (
              <label
                key={row.key}
                className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[13px] hover:bg-[var(--color-surface-hover)]"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={row.key}
                  checked={selected.includes(row.key)}
                  onChange={(event) => toggle(row.key, event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary-600)]"
                />
                <span>
                  {row.label}
                  {row.adminOnly ? (
                    <span className="type-caption ml-1">(зазвичай лише адмін)</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserAccessPanel({
  user,
  canManage,
}: {
  user: UserAccessRow;
  canManage: boolean;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(user.role);
  const [permissions, setPermissions] = useState<Permission[]>(
    resolveUserPermissions({ role: user.role, permissions: user.permissions }),
  );

  useEffect(() => {
    if (!open) return;
    setRole(user.role);
    setPermissions(resolveUserPermissions({ role: user.role, permissions: user.permissions }));
    setError(null);
  }, [open, user]);

  useEffect(() => {
    if (role === "ADMINISTRATOR") return;
    if (permissions.length === 0) {
      setPermissions([...DEFAULT_MANAGER_PERMISSIONS]);
    }
  }, [role, permissions.length]);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateUserAccessAction(formData);
      if (!result.ok) {
        setError(
          result.error === "SELF_DEMOTE"
            ? "Не можна зняти з себе роль адміністратора."
            : "Не вдалося зберегти права.",
        );
        return;
      }
      setOpen(false);
    });
  }

  function applyDefaults() {
    startTransition(async () => {
      const data = new FormData();
      data.set("userId", user.id);
      await resetUserPermissionsAction(data);
      setPermissions([...DEFAULT_MANAGER_PERMISSIONS]);
    });
  }

  const effectiveCount = resolveUserPermissions({ role: user.role, permissions: user.permissions }).length;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!canManage}
        onClick={() => setOpen(true)}
      >
        Права ({user.role === "ADMINISTRATOR" ? "повний" : effectiveCount})
      </Button>

      <SidePanel
        open={open}
        onClose={() => {
          if (pending) return;
          setOpen(false);
        }}
        title={user.name}
        description={user.email}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button type="submit" form={formId} disabled={pending || user.isSelf}>
              {pending ? "Збереження…" : "Зберегти права"}
            </Button>
          </>
        }
      >
        <form id={formId} action={submit} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {user.isSelf ? (
            <Banner tone="info">
              Власну роль адміністратора змінити не можна. Інші права — через іншого адміністратора.
            </Banner>
          ) : null}

          <FormGroup label="Роль" columns={1}>
            <Select
              name="role"
              label="Роль у системі"
              value={role}
              disabled={user.isSelf}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {(Object.keys(roleLabels) as UserRole[]).map((key) => (
                <option key={key} value={key}>
                  {roleLabels[key]}
                </option>
              ))}
            </Select>
          </FormGroup>

          {role === "MANAGER" ? (
            <div className="flex items-center justify-between gap-2">
              <p className="type-caption">За замовчуванням — стандартний набір для менеджера.</p>
              <Button type="button" variant="ghost" size="sm" onClick={applyDefaults} disabled={pending}>
                Скинути до типових
              </Button>
            </div>
          ) : null}

          <PermissionChecklist role={role} selected={permissions} onChange={setPermissions} />
          {role === "MANAGER"
            ? permissions.map((key) => (
                <input key={key} type="hidden" name="permissions" value={key} />
              ))
            : null}
        </form>
      </SidePanel>
    </>
  );
}

export function UserCreatePanel({ canManage }: { canManage: boolean }) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("MANAGER");
  const [permissions, setPermissions] = useState<Permission[]>([...DEFAULT_MANAGER_PERMISSIONS]);

  function reset() {
    setRole("MANAGER");
    setPermissions([...DEFAULT_MANAGER_PERMISSIONS]);
    setError(null);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createUserAction(formData);
      if (!result.ok) {
        setError(
          result.error === "DUPLICATE"
            ? "Користувач з таким email або логіном уже існує."
            : "Перевірте поля форми.",
        );
        return;
      }
      setOpen(false);
      reset();
    });
  }

  if (!canManage) return null;

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Новий користувач
      </Button>

      <SidePanel
        open={open}
        onClose={() => {
          if (pending) return;
          setOpen(false);
          reset();
        }}
        title="Новий користувач"
        description="За замовчуванням менеджер отримує типовий набір прав — їх можна змінити нижче."
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? "Створення…" : "Створити"}
            </Button>
          </>
        }
      >
        <form id={formId} action={submit} className="space-y-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <FormGroup label="Обліковий запис" columns={2}>
            <Input name="name" label="Імʼя" required autoFocus placeholder="Іван Петренко" />
            <Input name="email" label="Email" type="email" required placeholder="user@example.com" />
            <Input name="login" label="Логін" placeholder="Необовʼязково" />
            <Input
              name="password"
              label="Пароль"
              type="password"
              required
              minLength={8}
              placeholder="мін. 8 символів"
            />
          </FormGroup>

          <FormGroup label="Роль" columns={1}>
            <Select
              name="role"
              label="Роль"
              value={role}
              onChange={(event) => {
                const next = event.target.value as UserRole;
                setRole(next);
                if (next === "MANAGER" && permissions.length === 0) {
                  setPermissions([...DEFAULT_MANAGER_PERMISSIONS]);
                }
              }}
            >
              {(Object.keys(roleLabels) as UserRole[]).map((key) => (
                <option key={key} value={key}>
                  {roleLabels[key]}
                </option>
              ))}
            </Select>
          </FormGroup>

          <PermissionChecklist role={role} selected={permissions} onChange={setPermissions} />
          {role === "MANAGER"
            ? permissions.map((key) => (
                <input key={key} type="hidden" name="permissions" value={key} />
              ))
            : null}
        </form>
      </SidePanel>
    </>
  );
}

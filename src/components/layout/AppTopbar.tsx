import { getCurrentUserAccess } from "@/server/auth/access";
import { signOutAction } from "@/server/auth/actions";
import { getTranslations } from "next-intl/server";
import { IconLogout } from "@/components/ui/Icons";
import { GlobalSearch } from "./GlobalSearch";
import { SidebarExpandButton } from "./SidebarExpandButton";

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function AppTopbar() {
  const access = await getCurrentUserAccess();
  const t = await getTranslations("nav");
  const displayName = access?.name ?? access?.email ?? "—";
  const roleLabel = access?.role === "ADMINISTRATOR" ? "Адміністратор" : "Менеджер";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] px-4 backdrop-blur-md sm:gap-4 sm:px-6">
      <SidebarExpandButton />
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] bg-[var(--color-tint-slate)] px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-tint-sage)] text-[12px] font-semibold text-[var(--color-primary-800)]">
            {initials(displayName)}
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-[13.5px] font-medium text-[var(--color-text-primary)]">{displayName}</div>
            <div className="type-caption">{roleLabel}</div>
          </div>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
            title={t("logout")}
          >
            <IconLogout size={16} />
            <span className="hidden md:inline">{t("logout")}</span>
          </button>
        </form>
      </div>
    </header>
  );
}

import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const app = await getTranslations("app");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)] px-4">
      <div className="w-full max-w-md rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-float)]">
        <div className="mb-6">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--color-primary-600)] text-[14px] font-semibold text-[var(--color-on-primary)]">
            В
          </div>
          <div className="type-caption text-[var(--color-primary-700)]">{app("name")}</div>
          <h1 className="type-object-title mt-1">{t("loginTitle")}</h1>
          <p className="type-body-secondary mt-1">{app("tagline")}</p>
        </div>
        <Suspense fallback={<div className="h-40 animate-pulse rounded bg-[var(--color-surface-subtle)]" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

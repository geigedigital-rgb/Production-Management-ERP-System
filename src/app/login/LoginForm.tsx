"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginAction } from "@/server/auth/actions";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submitLogin() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    formData.set("callbackUrl", searchParams.get("callbackUrl") || "/overview");
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) {
        setError(t("invalidCredentials"));
        return;
      }
      if (result?.ok) {
        router.push(result.callbackUrl);
        router.refresh();
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitLogin();
  }

  return (
    <form ref={formRef} method="post" onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3" noValidate>
      <Input name="email" label={t("emailOrLogin")} autoComplete="username" required />
      <Input
        name="password"
        type="password"
        label={t("password")}
        autoComplete="current-password"
        required
      />
      {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}
      <Button type="button" disabled={pending} className="mt-1 w-full" onClick={submitLogin}>
        {pending ? "…" : t("submit")}
      </Button>
    </form>
  );
}

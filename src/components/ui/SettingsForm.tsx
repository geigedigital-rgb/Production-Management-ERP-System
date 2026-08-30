"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";

type Result = { ok: boolean; error?: string };

const errorMessages: Record<string, string> = {
  VALIDATION: "Перевірте заповнені поля.",
  MIN_ABOVE_TARGET: "Мінімальна маржа не може перевищувати цільову.",
};

/** Settings form with explicit save state — no silent auto-save for numbers that affect money. */
export function SettingsForm({
  action,
  children,
  id,
  submitLabel = "Зберегти зміни",
  description,
  readOnly,
  readOnlyHint = "Змінювати ці налаштування може лише адміністратор.",
}: {
  action: (formData: FormData) => Promise<Result>;
  children: React.ReactNode;
  /** Lets a live preview elsewhere on the page read the pending values. */
  id?: string;
  submitLabel?: string;
  description?: string;
  readOnly?: boolean;
  readOnlyHint?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function submit(formData: FormData) {
    setState(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setState({ tone: "danger", text: errorMessages[result.error ?? ""] ?? "Не вдалося зберегти." });
        return;
      }
      setState({ tone: "success", text: "Зміни збережено." });
      router.refresh();
    });
  }

  return (
    <form id={id} action={submit} className="space-y-4">
      <fieldset disabled={readOnly || pending} className="space-y-4">
        {children}
      </fieldset>

      {readOnly ? <Banner tone="info">{readOnlyHint}</Banner> : null}
      {state ? <Banner tone={state.tone}>{state.text}</Banner> : null}

      {!readOnly ? (
        <div className="flex items-center gap-3 border-t border-[var(--color-divider)] pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Збереження…" : submitLabel}
          </Button>
          {description ? <span className="type-caption">{description}</span> : null}
        </div>
      ) : null}
    </form>
  );
}

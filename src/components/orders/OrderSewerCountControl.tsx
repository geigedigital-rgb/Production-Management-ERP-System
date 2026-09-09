"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateOrderItemSewerCountAction } from "@/server/domains/orders/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  fixedCostValidationMessage,
  type FixedCostValidationError,
} from "@/lib/fixed-costs";

export function OrderSewerCountControl({
  orderId,
  orderItemId,
  companySewerCount,
  sewerCountOverride,
  locked,
}: {
  orderId: string;
  orderItemId: string;
  companySewerCount: number;
  sewerCountOverride: number | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(
    sewerCountOverride != null ? String(sewerCountOverride) : String(companySewerCount),
  );
  const [error, setError] = useState<string | null>(null);
  const isOverride = sewerCountOverride != null;

  useEffect(() => {
    setValue(
      sewerCountOverride != null ? String(sewerCountOverride) : String(companySewerCount),
    );
  }, [sewerCountOverride, companySewerCount, orderItemId]);

  function save(next: string | null) {
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", orderItemId);
    if (next == null) {
      formData.set("clearOverride", "1");
      formData.set("sewerCountOverride", "");
    } else {
      formData.set("sewerCountOverride", next);
    }
    startTransition(async () => {
      const result = await updateOrderItemSewerCountAction(formData);
      if (!result.ok) {
        setError("Вкажіть кількість швачок більше 0.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <label className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
        Швачок
        <input
          type="number"
          min={1}
          disabled={locked || pending}
          className={cn(
            "h-7 w-[64px] rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 tabular outline-none",
            "focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-100)]",
          )}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (locked) return;
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0) {
              setError("Більше 0");
              return;
            }
            if (Math.floor(n) === (sewerCountOverride ?? companySewerCount)) return;
            save(String(Math.floor(n)));
          }}
        />
      </label>
      {isOverride ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={locked || pending}
          onClick={() => {
            setValue(String(companySewerCount));
            save(null);
          }}
        >
          З довідника ({companySewerCount})
        </Button>
      ) : (
        <span className="type-caption">з довідника</span>
      )}
      {error ? <span className="text-[var(--color-danger-text)]">{error}</span> : null}
    </div>
  );
}

export function OrderFixedCostError({ error }: { error: FixedCostValidationError | null }) {
  if (!error) return null;
  return (
    <p className="type-caption text-[var(--color-danger-text)]">
      {fixedCostValidationMessage(error)}{" "}
      <Link href="/settings/fixed-costs" className="underline">
        Довідник
      </Link>
    </p>
  );
}

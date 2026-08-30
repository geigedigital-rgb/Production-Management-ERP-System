"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { updateOrderMarginAction } from "@/server/domains/orders/actions";
import { cn, formatMoneyUah } from "@/lib/utils";

function sellingFromCost(
  costPerUnit: number,
  method: "MARGIN" | "MARKUP",
  ratePercent: number,
) {
  if (!Number.isFinite(costPerUnit) || costPerUnit < 0) return null;
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent >= 100) return null;
  if (method === "MARKUP") return costPerUnit * (1 + ratePercent / 100);
  const denominator = 1 - ratePercent / 100;
  if (denominator <= 0) return null;
  return costPerUnit / denominator;
}

export function OrderMarginControl({
  orderId,
  locked,
  pricingMethod,
  projectDefault,
  orderOverride,
  minimumMarginPercent,
  costPerUnit,
  totalQuantity,
  layout = "panel",
}: {
  orderId: string;
  locked?: boolean;
  pricingMethod: "MARGIN" | "MARKUP";
  projectDefault: number;
  orderOverride: number | null;
  minimumMarginPercent: number;
  costPerUnit: number;
  totalQuantity: number;
  layout?: "panel" | "strip";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const committed = orderOverride != null ? orderOverride : projectDefault;
  const [value, setValue] = useState(String(committed));
  const lastSaved = useRef(committed);
  const isOverride = orderOverride != null;
  const rateLabel = pricingMethod === "MARKUP" ? "націнка" : "маржа";

  const draftRate = Number(value.replace(",", "."));
  const rateValid = Number.isFinite(draftRate) && draftRate >= 0 && draftRate < 100;
  const belowMinimum = rateValid && draftRate < minimumMarginPercent;
  const previewUnit = rateValid ? sellingFromCost(costPerUnit, pricingMethod, draftRate) : null;
  const previewTotal =
    previewUnit != null && totalQuantity > 0 ? previewUnit * totalQuantity : null;
  function persist(next: number | null, useDefault = false) {
    const formData = new FormData();
    formData.set("orderId", orderId);
    if (useDefault) {
      formData.set("useDefault", "1");
    } else {
      formData.set("targetMarginPercent", String(next));
    }
    startTransition(async () => {
      const result = await updateOrderMarginAction(formData);
      if (!result.ok) return;
      lastSaved.current = useDefault ? projectDefault : (next as number);
      router.refresh();
    });
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Debounced autosave when the typed rate differs from what is stored.
  useEffect(() => {
    if (locked) return;
    if (!rateValid) return;
    if (Math.abs(draftRate - lastSaved.current) < 0.0001) return;

    const timer = window.setTimeout(() => {
      persistRef.current(draftRate);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draftRate, rateValid, locked]);

  useEffect(() => {
    if (Math.abs(committed - lastSaved.current) < 0.0001) return;
    lastSaved.current = committed;
    setValue(String(committed));
  }, [committed]);

  const showBase =
    !locked && (isOverride || (rateValid && Math.abs(draftRate - projectDefault) > 0.0001));

  const rateField = locked ? (
    <p className="text-[15px] font-semibold tabular text-[var(--color-text-primary)]">
      {committed.toFixed(1)}%
    </p>
  ) : (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="type-label">
        {layout === "strip" ? `${rateLabel}, %` : `Цільова ${rateLabel}, %`}
      </span>
      <div className="flex min-w-0 w-full items-center gap-2">
        {showBase ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="shrink-0 px-2"
            onClick={() => {
              setValue(String(projectDefault));
              lastSaved.current = projectDefault;
              persist(null, true);
            }}
          >
            Базова {projectDefault}%
          </Button>
        ) : null}
        <input
          aria-label={layout === "strip" ? `${rateLabel}, %` : `Цільова ${rateLabel}, %`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          size={4}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          className={cn(
            controlClass,
            "!h-8 !w-[4.75rem] min-w-0 max-w-full shrink-0 overflow-hidden px-2 tabular",
          )}
        />
      </div>
    </div>
  );

  const saveLabel = pending
    ? "Зберігаємо…"
    : rateValid && Math.abs(draftRate - lastSaved.current) < 0.0001
      ? "Збережено"
      : rateValid
        ? "Оновлюємо…"
        : "Введіть коректний %";

  if (layout === "strip") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-[var(--radius-surface)] border bg-[var(--color-surface)] px-3.5 py-2.5",
          belowMinimum
            ? "border-[var(--color-danger-text)]/30"
            : "border-[var(--color-border)]",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-end gap-4">
          {rateField}
          {previewUnit != null && costPerUnit > 0 ? (
            <div>
              <p className="type-caption">Ціна / од.</p>
              <p className="text-[16px] font-semibold tracking-[-0.02em] tabular">
                {formatMoneyUah(previewUnit)}
              </p>
            </div>
          ) : null}
          {previewTotal != null && costPerUnit > 0 ? (
            <div>
              <p className="type-caption">Сума продажу</p>
              <p className="text-[16px] font-semibold tabular">{formatMoneyUah(previewTotal)}</p>
            </div>
          ) : null}
        </div>
        <p className="type-caption pb-1">
          {saveLabel}
          {belowMinimum ? ` · нижче мінімуму ${minimumMarginPercent}%` : ` · база ${projectDefault}%`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="space-y-2.5">
        <div className="min-w-0">
          <p className="type-subsection">Маржа замовлення</p>
          <p className="type-caption mt-0.5">
            База {projectDefault}% · мін. {minimumMarginPercent}%
            {isOverride ? " · індивідуальна ставка" : ""}
          </p>
        </div>
        {rateField}
      </div>

      {!locked ? (
        <div
          className={cn(
            "mt-3 rounded-[8px] border px-3 py-2.5",
            belowMinimum
              ? "border-[var(--color-danger-text)]/25 bg-[var(--color-tint-rose)]/60"
              : "border-[var(--color-divider)] bg-[var(--color-surface-subtle)]",
          )}
        >
          <p className="type-caption">
            {costPerUnit > 0 ? "Ціна з обраної ставки" : "Додайте комплектацію — з’явиться ціна"}
          </p>
          {previewUnit != null && costPerUnit > 0 ? (
            <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em] tabular">
              {formatMoneyUah(previewUnit)}
              <span className="ml-1.5 text-[12px] font-normal text-[var(--color-text-quiet)]">
                / од.
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[13.5px] text-[var(--color-text-quiet)]">—</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            {previewTotal != null && costPerUnit > 0 ? (
              <p className="text-[13.5px] font-semibold tabular">{formatMoneyUah(previewTotal)}</p>
            ) : (
              <span />
            )}
            <p className="type-caption">{saveLabel}</p>
          </div>
          {belowMinimum ? (
            <p className="mt-1 text-[11.5px] font-medium text-[var(--color-danger-text)]">
              Нижче мінімуму {minimumMarginPercent}%
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

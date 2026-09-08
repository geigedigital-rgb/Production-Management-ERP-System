"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { CostSummary } from "@/components/calc/CostSummary";
import type { CalculationResult } from "@/server/domains/calculation/engine";
import { previewProductEconomicsAction } from "@/server/domains/products/actions";

export function ProductEconomicsPanel({
  productId,
  initialCalc,
  initialQuantity = 100,
  minimumMarginPercent,
  onPreviewChange,
}: {
  productId: string;
  initialCalc: CalculationResult;
  initialQuantity?: number;
  minimumMarginPercent: number;
  onPreviewChange?: (quantity: number) => void;
}) {
  const [quantityInput, setQuantityInput] = useState(String(initialQuantity));
  const [calc, setCalc] = useState(initialCalc);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const parsed = Math.max(1, Math.floor(Number(quantityInput) || 0));
    if (!Number.isFinite(parsed) || parsed < 1) return;

    onPreviewChange?.(parsed);

    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await previewProductEconomicsAction(productId, parsed);
        if (result.ok) {
          setCalc(result.calc);
          setQuantity(result.quantity);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [productId, quantityInput, onPreviewChange]);

  return (
    <div className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <Input
          label="Тираж для розрахунку, шт"
          type="number"
          min={1}
          step={1}
          value={quantityInput}
          onChange={(event) => setQuantityInput(event.target.value)}
          hint="Матеріали, крій, операції за tier, нанесення і додаткові витрати — від тиражу."
        />
      </div>

      <CostSummary
        calc={calc}
        quantity={quantity}
        title="Економіка партії"
        subtitle={
          pending
            ? "Перерахунок…"
            : `Собівартість при ${quantity} шт. Комерційний прайс — у вкладці «Прайс і крій».`
        }
        minimumMarginPercent={minimumMarginPercent}
        className="border-0 shadow-none"
        footer={
          <Link
            href={`/orders/new?productId=${productId}`}
            className="btn-primary btn-primary-sm w-full"
          >
            Створити замовлення на виріб
          </Link>
        }
      />
    </div>
  );
}

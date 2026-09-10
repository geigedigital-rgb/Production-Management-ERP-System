"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProductCutRatesAction } from "@/server/domains/products/actions";
import {
  DEFAULT_CUT_RATE_TIERS,
  ProductCutRateFields,
  type CutRateTierDraft,
} from "@/components/products/ProductCutRateFields";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { resolveOptimalCutQty } from "@/lib/cut-rate";

export function ProductCutRateEditor({
  productId,
  optimalQty: initialOptimalQty,
  tiers,
}: {
  productId: string;
  optimalQty?: number | null;
  tiers: CutRateTierDraft[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftTiers, setDraftTiers] = useState<CutRateTierDraft[]>(
    tiers.length > 0 ? tiers : DEFAULT_CUT_RATE_TIERS,
  );
  const [optimalQty, setOptimalQty] = useState(
    () =>
      resolveOptimalCutQty({
        optimalQty: initialOptimalQty ?? null,
        tiers: tiers.length > 0 ? tiers : DEFAULT_CUT_RATE_TIERS,
      }) ?? 100,
  );
  const [optimalCutTotal, setOptimalCutTotal] = useState(() => {
    const qty =
      resolveOptimalCutQty({
        optimalQty: initialOptimalQty ?? null,
        tiers: tiers.length > 0 ? tiers : DEFAULT_CUT_RATE_TIERS,
      }) ?? 100;
    const rate =
      (tiers.length > 0 ? tiers : DEFAULT_CUT_RATE_TIERS).find((t) => t.minQuantity === qty)
        ?.ratePerUnit ?? 0;
    return Math.round(rate * qty * 100) / 100;
  });

  function save() {
    setError(null);
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("optimalQty", String(optimalQty));
    for (const tier of draftTiers) {
      formData.append("tierMinQuantity", String(tier.minQuantity));
      formData.append("tierRate", String(tier.ratePerUnit));
    }
    startTransition(async () => {
      const result = await updateProductCutRatesAction(formData);
      if (!result.ok) {
        setError("Перевірте тиражі та ставки крою.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_1px_0_rgba(15,23,32,0.03)]">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Ставки крою
        </h3>
        <p className="type-caption mt-0.5">
          Оптимальний тираж і вартість крою → ₴/шт = вартість ÷ тираж; решта сходинок — так само.
        </p>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <ProductCutRateFields
        tiers={draftTiers}
        onTiersChange={setDraftTiers}
        optimalQty={optimalQty}
        onOptimalQtyChange={setOptimalQty}
        optimalCutTotal={optimalCutTotal}
        onOptimalCutTotalChange={setOptimalCutTotal}
        footer={
          <div className="flex justify-end">
            <Button type="button" size="sm" loading={pending} onClick={save}>
              Зберегти крій
            </Button>
          </div>
        }
      />
    </div>
  );
}

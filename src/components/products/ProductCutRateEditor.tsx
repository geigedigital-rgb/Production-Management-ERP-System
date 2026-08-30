"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { updateProductCutRatesAction } from "@/server/domains/products/actions";
import {
  DEFAULT_CUT_RATE_TIERS,
  ProductCutRateFields,
  type CutRateTierDraft,
} from "@/components/products/ProductCutRateFields";

export function ProductCutRateEditor({
  productId,
  optimalQty,
  tiers,
}: {
  productId: string;
  optimalQty: number | null;
  tiers: CutRateTierDraft[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimal, setOptimal] = useState(optimalQty?.toString() ?? "");
  const [rows, setRows] = useState<CutRateTierDraft[]>(
    tiers.length ? tiers : DEFAULT_CUT_RATE_TIERS,
  );

  function save() {
    setError(null);
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("optimalQty", optimal);
    for (const row of rows) {
      formData.append("tierMinQuantity", String(row.minQuantity));
      formData.append("tierRate", String(row.ratePerUnit));
    }
    startTransition(async () => {
      const result = await updateProductCutRatesAction(formData);
      if (!result.ok) {
        setError("Перевірте оптимальний тираж і ставки крою.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Крій за тиражем
        </h3>
        <p className="type-caption mt-0.5">
          Заповніть: скільки коштує крій однієї речі при різній кількості. «Оптимальний тираж» —
          від якої кількості крій уже найдешевший; далі ціна за штуку не падає.
        </p>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <ProductCutRateFields
        optimalQty={optimal}
        onOptimalQtyChange={setOptimal}
        tiers={rows}
        onTiersChange={setRows}
        footer={
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Збереження…" : "Зберегти крій"}
          </Button>
        }
      />
    </div>
  );
}

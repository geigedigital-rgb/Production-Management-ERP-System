"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { updateProductCommercialPricesAction } from "@/server/domains/products/actions";
import {
  DEFAULT_COMMERCIAL_PRICE_TIERS,
  ProductPriceFields,
  type CommercialPriceTierDraft,
} from "@/components/products/ProductPriceFields";

export function ProductPriceEditor({
  productId,
  isBaseModel,
  tiers,
}: {
  productId: string;
  isBaseModel: boolean;
  tiers: CommercialPriceTierDraft[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [baseModel, setBaseModel] = useState(isBaseModel);
  const [rows, setRows] = useState<CommercialPriceTierDraft[]>(
    tiers.length ? tiers : DEFAULT_COMMERCIAL_PRICE_TIERS,
  );

  function save() {
    setError(null);
    const formData = new FormData();
    formData.set("productId", productId);
    if (baseModel) formData.set("isBaseModel", "1");
    for (const row of rows) {
      formData.append("tierMinQuantity", String(row.minQuantity));
      formData.append("tierPrice", String(row.pricePerUnit));
    }
    startTransition(async () => {
      const result = await updateProductCommercialPricesAction(formData);
      if (!result.ok) {
        setError("Перевірте діапазони тиражу та ціни.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Комерційний прайс за тиражем
        </h3>
        <p className="type-caption mt-0.5">
          Фіксована ціна для клієнта по діапазонах (як «Крій за тиражем», але для продажу). Брендування
          додається окремо в замовленні. Собівартість рахується окремо для планування.
        </p>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <label className="inline-flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={baseModel}
          onChange={(event) => setBaseModel(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-primary-600)]"
        />
        Базова модель категорії (пропонується клієнтам за прайсом)
      </label>

      <ProductPriceFields
        tiers={rows}
        onTiersChange={setRows}
        footer={
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Збереження…" : "Зберегти прайс"}
          </Button>
        }
      />
    </div>
  );
}

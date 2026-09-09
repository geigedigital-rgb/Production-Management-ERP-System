"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { updateProductCommercialPricesAction } from "@/server/domains/products/actions";
import {
  DEFAULT_COMMERCIAL_PRICE_TIERS,
  ProductPriceFields,
  hydrateCommercialPriceTiers,
  type CommercialPriceTierDraft,
  type TirageCostHint,
} from "@/components/products/ProductPriceFields";

export function ProductPriceEditor({
  productId,
  isBaseModel,
  tiers,
  costHints,
}: {
  productId: string;
  isBaseModel: boolean;
  tiers: CommercialPriceTierDraft[];
  costHints?: TirageCostHint[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [baseModel, setBaseModel] = useState(isBaseModel);
  const [rows, setRows] = useState<CommercialPriceTierDraft[]>(() =>
    hydrateCommercialPriceTiers(tiers.length ? tiers : DEFAULT_COMMERCIAL_PRICE_TIERS, costHints),
  );

  function save() {
    setError(null);
    const formData = new FormData();
    formData.set("productId", productId);
    if (baseModel || rows.some((row) => row.pricePerUnit > 0)) {
      formData.set("isBaseModel", "1");
    }
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
      setBaseModel(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_1px_0_rgba(15,23,32,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            Базовий прайс за тиражем
          </h3>
          <p className="type-caption mt-0.5 max-w-xl">
            Собівартість і крій — автоматично. Множником до пошиву виставляєте націнку; ціна клієнту
            рахується одразу. Зафіксуйте прайс, щоб він йшов у замовлення.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={baseModel}
            onChange={(event) => setBaseModel(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-primary-600)]"
          />
          Базова модель
        </label>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {!costHints?.length ? (
        <Banner tone="warning" title="Немає даних для автоціни">
          Додайте пошив і матеріали в комплектацію — тоді собівартість і ціна підставляться самі.
        </Banner>
      ) : null}

      <ProductPriceFields
        tiers={rows}
        onTiersChange={setRows}
        costHints={costHints}
        onRecalc={() =>
          setRows((prev) => hydrateCommercialPriceTiers(prev, costHints, { force: true }))
        }
        footer={
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Збереження…" : "Зафіксувати прайс"}
          </Button>
        }
      />
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TableCard, TableToolbar } from "@/components/ui/Table";
import {
  DEFAULT_OPERATION_QTY_TIERS,
  defaultOperationRateTiers,
  resolveQuantityTierRate,
  type QuantityRateTier,
} from "@/lib/quantity-tiers";
import { formatMoneyUah } from "@/lib/utils";
import { updateProductOperationRateTiersAction } from "@/server/domains/products/actions";

export function ProductOperationRateEditor({
  productId,
  productOperationId,
  operationName,
  tiers: initialTiers,
}: {
  productId: string;
  productOperationId: string;
  operationName: string;
  tiers: QuantityRateTier[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tiers, setTiers] = useState<QuantityRateTier[]>(() =>
    initialTiers.length > 0 ? initialTiers : defaultOperationRateTiers(0),
  );
  const [error, setError] = useState<string | null>(null);
  const previewQty = 100;
  const previewRate = useMemo(
    () =>
      resolveQuantityTierRate({
        quantity: previewQty,
        tiers,
        fallbackRate: tiers[0]?.ratePerUnit ?? 0,
      }),
    [tiers],
  );

  function save() {
    setError(null);
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("productOperationId", productOperationId);
    formData.set("rateTiersJson", JSON.stringify(tiers));
    startTransition(async () => {
      const result = await updateProductOperationRateTiersAction(formData);
      if (!result.ok) {
        setError("Не вдалося зберегти сітку.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <TableCard>
      <TableToolbar
        left={
          <div>
            <span className="type-subsection">Ставка за тиражем · {operationName}</span>
            <p className="type-caption mt-0.5">
              Сітка на виробі (копія з довідника). Крій лишається в блоці «Крій за тиражем».
            </p>
          </div>
        }
        right={
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Збереження…" : "Зберегти сітку"}
          </Button>
        }
      />
      <div className="space-y-3 p-3 pt-0">
        {error ? <p className="type-caption text-[var(--color-danger-text)]">{error}</p> : null}
        <div className="overflow-x-auto">
          <table className="erp-table w-full min-w-[320px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-table-section-border)]">
                <th className="py-1.5">Тираж від, шт</th>
                <th className="py-1.5">₴ / шт</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((row, index) => (
                <tr key={index} className="border-b border-[var(--color-border-muted)]">
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={1}
                      className="field-input w-full"
                      value={row.minQuantity}
                      onChange={(event) => {
                        const next = [...tiers];
                        next[index] = { ...row, minQuantity: Number(event.target.value) };
                        setTiers(next);
                      }}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="field-input w-full"
                      value={row.ratePerUnit}
                      onChange={(event) => {
                        const next = [...tiers];
                        next[index] = { ...row, ratePerUnit: Number(event.target.value) };
                        setTiers(next);
                      }}
                    />
                  </td>
                  <td className="py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
                      disabled={tiers.length <= 1}
                    >
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setTiers([
                ...tiers,
                {
                  minQuantity: (tiers[tiers.length - 1]?.minQuantity ?? 0) + 50,
                  ratePerUnit: tiers[tiers.length - 1]?.ratePerUnit ?? 0,
                },
              ])
            }
          >
            Додати сходинку
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setTiers(
                defaultOperationRateTiers(tiers.find((t) => t.ratePerUnit > 0)?.ratePerUnit ?? 0),
              )
            }
          >
            Сітка {DEFAULT_OPERATION_QTY_TIERS.join("/")}
          </Button>
          <span className="type-caption">
            Приклад: {previewQty} шт → {formatMoneyUah(previewRate)} / шт
          </span>
        </div>
      </div>
    </TableCard>
  );
}

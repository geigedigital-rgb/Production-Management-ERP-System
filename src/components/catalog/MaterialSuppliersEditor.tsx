"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Banner } from "@/components/ui/Banner";
import {
  deleteMaterialSupplierOfferAction,
  listMaterialSupplierOffersAction,
  upsertMaterialSupplierOfferAction,
} from "@/server/domains/catalog/actions";
import { formatMoneyUah } from "@/lib/utils";

type OfferRow = {
  id: string;
  isPrimary: boolean;
  supplierName: string;
  priceKgUsd: number | null;
  priceMeterUahCutVat: number | null;
  purchaseHint: number | null;
};

export function MaterialSuppliersEditor({ materialId }: { materialId: string }) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [priceKgUsd, setPriceKgUsd] = useState("");
  const [cutPrice, setCutPrice] = useState("");
  const [cargo, setCargo] = useState("");

  function reload() {
    startTransition(async () => {
      const result = await listMaterialSupplierOffersAction(materialId);
      if (result.ok) setOffers(result.offers);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  function addOffer(asPrimary: boolean) {
    setError(null);
    if (!supplierName.trim()) {
      setError("Вкажіть постачальника.");
      return;
    }
    const data = new FormData();
    data.set("materialId", materialId);
    data.set("supplierNameUk", supplierName.trim());
    data.set("isPrimary", asPrimary ? "1" : "0");
    if (priceKgUsd) data.set("priceKgUsd", priceKgUsd);
    if (cutPrice) data.set("priceMeterUahCutVat", cutPrice);
    if (cargo) data.set("cargoUsdPerKg", cargo);
    startTransition(async () => {
      const result = await upsertMaterialSupplierOfferAction(data);
      if (!result.ok) {
        setError("Не вдалося зберегти умови постачальника.");
        return;
      }
      setSupplierName("");
      setPriceKgUsd("");
      setCutPrice("");
      setCargo("");
      reload();
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
      <div>
        <h4 className="type-subsection">Постачальники</h4>
        <p className="type-caption mt-0.5">
          Основний визначає собівартість базової моделі. Альтернативи — для закупівлі під замовлення
          (без автовибору найдешевшого).
        </p>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <ul className="space-y-1.5">
        {offers.length === 0 ? (
          <li className="type-caption">Ще немає окремих пропозицій — збережіть матеріал із постачальником.</li>
        ) : (
          offers.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 text-[13px]"
            >
              <span>
                <span className="font-medium">{row.supplierName}</span>
                {row.isPrimary ? (
                  <span className="type-caption ml-2">основний</span>
                ) : null}
                {row.purchaseHint != null ? (
                  <span className="type-caption ml-2">{formatMoneyUah(row.purchaseHint)}/м</span>
                ) : null}
              </span>
              {!row.isPrimary ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", row.id);
                    startTransition(async () => {
                      await deleteMaterialSupplierOfferAction(data);
                      reload();
                    });
                  }}
                >
                  Прибрати
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          label="Постачальник"
          value={supplierName}
          onChange={(event) => setSupplierName(event.target.value)}
          placeholder="Trade Line"
        />
        <Input
          label="Cargo $/кг"
          type="number"
          min={0}
          step="0.01"
          value={cargo}
          onChange={(event) => setCargo(event.target.value)}
          placeholder="1.7"
        />
        <Input
          label="$/кг без ПДВ"
          type="number"
          min={0}
          step="0.01"
          value={priceKgUsd}
          onChange={(event) => setPriceKgUsd(event.target.value)}
        />
        <Input
          label="₴/м відріз"
          type="number"
          min={0}
          step="0.1"
          value={cutPrice}
          onChange={(event) => setCutPrice(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => addOffer(false)}>
          Додати альтернативу
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => addOffer(true)}>
          Зробити основним
        </Button>
      </div>
    </div>
  );
}

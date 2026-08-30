"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { SidePanel } from "@/components/ui/Overlay";
import { SizeRun } from "@/components/orders/SizeRun";
import { ProductCatalogPanel, type CatalogProduct } from "@/components/orders/ProductCatalogPanel";
import { addOrderItemAction } from "@/server/domains/orders/actions";

export type AddableProduct = Pick<
  CatalogProduct,
  | "id"
  | "label"
  | "nameUk"
  | "internalCode"
  | "imageUrl"
  | "materialsCount"
  | "operationsCount"
  | "decorationsCount"
  | "sizes"
>;

function toCatalogProduct(product: AddableProduct): CatalogProduct {
  return {
    ...product,
    priceTiers: [],
    composition: { materials: [], operations: [], decorations: [] },
  };
}

export function AddOrderItemPanel({
  orderId,
  products,
}: {
  orderId: string;
  products: AddableProduct[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId],
  );
  const sizes = selected?.sizes.length
    ? selected.sizes
    : selected
      ? [{ code: "ONE", nameUk: "Без розміру" }]
      : [];
  const total = sizes.reduce((sum, size) => sum + (quantities[size.code] || 0), 0);

  function close() {
    setOpen(false);
    setProductId("");
    setQuantities({});
    setError(null);
  }

  function selectProduct(id: string) {
    setProductId(id);
    setQuantities({});
    setError(null);
  }

  function submit() {
    if (!selected || total <= 0) return;
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("productId", selected.id);
    for (const size of sizes) {
      formData.append("sizeCode", size.code);
      formData.append("sizeNameUk", size.nameUk);
      formData.append("sizeQty", String(quantities[size.code] || 0));
    }
    startTransition(async () => {
      const result = await addOrderItemAction(formData);
      if (!result.ok) {
        setError(
          result.error === "QUANTITY_REQUIRED"
            ? "Вкажіть кількість хоча б для одного розміру."
            : result.error === "ORDER_LOCKED"
              ? "Замовлення вже у виробництві — позиції не змінюються."
              : result.error === "PRODUCT_NOT_FOUND"
                ? "Цей виріб більше недоступний у каталозі."
                : "Не вдалося додати виріб.",
        );
        return;
      }
      close();
      router.push(`/orders/${orderId}?tab=configuration&item=${result.itemId}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Додати виріб
      </Button>
      <SidePanel
        open={open}
        onClose={close}
        title="Додати виріб у замовлення"
        description="Оберіть еталон з каталогу, вкажіть тираж — склад скопіюється в цю позицію. Далі його можна правити в таблиці замовлення."
        width="lg"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              Скасувати
            </Button>
            <Button type="button" onClick={submit} disabled={!selected || total <= 0 || pending}>
              {pending ? "Додаємо…" : "Додати в замовлення"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
          <ProductCatalogPanel
            products={products.map(toCatalogProduct)}
            selectedId={productId}
            onSelect={selectProduct}
          />
          <div className="space-y-3">
            {selected ? (
              <>
                <div>
                  <p className="type-label">Тираж</p>
                  <p className="type-caption mt-0.5">{selected.nameUk ?? selected.label}</p>
                </div>
                <SizeRun
                  sizes={sizes}
                  quantities={quantities}
                  onChange={(code, quantity) =>
                    setQuantities((prev) => ({ ...prev, [code]: quantity }))
                  }
                />
                <p className="type-caption tabular">Разом {total} шт</p>
              </>
            ) : (
              <p className="type-body-secondary">Спочатку оберіть виріб зліва.</p>
            )}
            {error ? <Banner tone="danger">{error}</Banner> : null}
          </div>
        </div>
      </SidePanel>
    </>
  );
}

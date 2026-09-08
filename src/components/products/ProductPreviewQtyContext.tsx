"use client";

import { createContext, useContext, useState } from "react";
import { ProductEconomicsPanel } from "@/components/products/ProductEconomicsPanel";
import type { CalculationResult } from "@/server/domains/calculation/engine";

const ProductPreviewQtyContext = createContext(100);

export function useProductPreviewQty() {
  return useContext(ProductPreviewQtyContext);
}

export function ProductDetailPreviewShell({
  productId,
  initialCalc,
  initialQuantity,
  minimumMarginPercent,
  children,
  showEconomics = true,
}: {
  productId: string;
  initialCalc: CalculationResult;
  initialQuantity: number;
  minimumMarginPercent: number;
  children: React.ReactNode;
  showEconomics?: boolean;
}) {
  const [previewQty, setPreviewQty] = useState(initialQuantity);

  if (!showEconomics) {
    return (
      <ProductPreviewQtyContext.Provider value={previewQty}>
        <div className="min-w-0 space-y-4">{children}</div>
      </ProductPreviewQtyContext.Provider>
    );
  }

  return (
    <ProductPreviewQtyContext.Provider value={previewQty}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
        <div className="min-w-0 space-y-4">{children}</div>
        <aside className="lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto">
          <ProductEconomicsPanel
            productId={productId}
            initialCalc={initialCalc}
            initialQuantity={initialQuantity}
            minimumMarginPercent={minimumMarginPercent}
            onPreviewChange={setPreviewQty}
          />
        </aside>
      </div>
    </ProductPreviewQtyContext.Provider>
  );
}

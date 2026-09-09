import { SegmentedTabs } from "@/components/ui/Tabs";
import { ProductSizeBom } from "@/components/products/ProductSizeBom";
import { ProductPriceCutPanel } from "@/components/products/ProductPriceCutPanel";
import type { TirageCostHint } from "@/components/products/ProductPriceFields";

export type ProductDetailTab = "composition" | "pricing";

type BomProps = React.ComponentProps<typeof ProductSizeBom>;

export function ProductDetailTabs({
  productId,
  activeTab,
  compositionCount,
  bom,
  cut,
  price,
  showPricing = true,
}: {
  productId: string;
  activeTab: ProductDetailTab;
  compositionCount: number;
  bom: BomProps;
  cut: {
    productId: string;
    optimalQty: number | null;
    tiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  };
  price: {
    productId: string;
    isBaseModel: boolean;
    tiers: Array<{ minQuantity: number; pricePerUnit: number }>;
    costHints?: TirageCostHint[];
  };
  showPricing?: boolean;
}) {
  const effectiveTab = showPricing ? activeTab : "composition";
  const tabs = [
    {
      key: "composition",
      label: "Комплектація",
      href: `/products/${productId}?tab=composition`,
      count: compositionCount,
    },
    ...(showPricing
      ? [
          {
            key: "pricing",
            label: "Прайс і крій",
            href: `/products/${productId}?tab=pricing`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="type-caption">
            {effectiveTab === "composition"
              ? showPricing
                ? "Матеріали, операції та нанесення для собівартості"
                : "Склад виробу (без цін і калькуляції)"
              : "Спільні тиражі: крій і прайс в одній таблиці"}
          </p>
        </div>
        {tabs.length > 1 ? <SegmentedTabs items={tabs} active={effectiveTab} /> : null}
      </div>

      {effectiveTab === "composition" ? (
        <ProductSizeBom {...bom} />
      ) : (
        <ProductPriceCutPanel
          productId={productId}
          optimalQty={cut.optimalQty}
          cutTiers={cut.tiers}
          isBaseModel={price.isBaseModel}
          priceTiers={price.tiers}
          costHints={price.costHints}
        />
      )}
    </div>
  );
}

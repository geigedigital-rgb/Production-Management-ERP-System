import { SegmentedTabs } from "@/components/ui/Tabs";
import { ProductSizeBom } from "@/components/products/ProductSizeBom";
import { ProductCutRateEditor } from "@/components/products/ProductCutRateEditor";
import { ProductPriceEditor } from "@/components/products/ProductPriceEditor";

export type ProductDetailTab = "composition" | "pricing";

type BomProps = React.ComponentProps<typeof ProductSizeBom>;
type CutProps = React.ComponentProps<typeof ProductCutRateEditor>;
type PriceProps = React.ComponentProps<typeof ProductPriceEditor>;

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
  cut: CutProps;
  price: PriceProps;
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
              : "Крій за тиражем і комерційний прайс"}
          </p>
        </div>
        {tabs.length > 1 ? <SegmentedTabs items={tabs} active={effectiveTab} /> : null}
      </div>

      {effectiveTab === "composition" ? (
        <ProductSizeBom {...bom} />
      ) : (
        <div className="space-y-4">
          <ProductCutRateEditor {...cut} />
          <ProductPriceEditor {...price} />
        </div>
      )}
    </div>
  );
}

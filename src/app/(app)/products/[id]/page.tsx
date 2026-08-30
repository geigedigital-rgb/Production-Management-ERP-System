import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/server/domains/products/service";
import { listMaterials } from "@/server/domains/catalog/materials";
import { listUnits } from "@/server/domains/catalog/materials";
import { listDecorations, listOperations } from "@/server/domains/catalog/operations";
import { StatusBadge } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import { Breadcrumbs, HeaderBlock, QuickAction, QuickActions } from "@/components/ui/ObjectHeader";
import { CostSummary } from "@/components/calc/CostSummary";
import { IconCheckCircle, IconCircle, IconOrders, IconSizes } from "@/components/ui/Icons";
import { formatMoneyUah } from "@/lib/utils";
import { buildCalcFromProduct, getPricingDefaults } from "@/server/domains/calculation/from-entities";
import { ProductSizeBom } from "@/components/products/ProductSizeBom";
import { ProductCutRateEditor } from "@/components/products/ProductCutRateEditor";
import { ProductPriceEditor } from "@/components/products/ProductPriceEditor";
import { prisma } from "@/server/db/client";
import {
  sizeCodesFromScopes,
  sizeConsumptionFromNorms,
} from "@/lib/size-bom";

/** Product card economics are per unit; batch cut tiers are edited separately. */
const UNIT_QTY = 1;

type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

function operationUnitCost(row: ProductDetail["operations"][number]) {
  if (row.operation.calculationMethod === "SHIFT_OUTPUT") {
    const output =
      row.standardOverride != null
        ? Number(row.standardOverride)
        : Number(row.operation.standardOutputPerShift ?? 0);
    if (!output) return 0;
    return Number(row.operation.shiftCost ?? 0) / output;
  }
  return row.rateOverride != null ? Number(row.rateOverride) : Number(row.operation.baseRate ?? 0);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const [materials, units, operations, decorations, pricing, usedIn] = await Promise.all([
    listMaterials(),
    listUnits(),
    listOperations(),
    listDecorations(),
    getPricingDefaults(),
    prisma.orderItem.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        totalQuantity: true,
        order: { select: { id: true, number: true, status: true, client: { select: { companyName: true } } } },
      },
    }),
  ]);

  const calc = buildCalcFromProduct(product, UNIT_QTY, pricing);

  const readiness = [
    { label: "Матеріали", done: product.materials.length > 0, count: product.materials.length },
    { label: "Операції", done: product.operations.length > 0, count: product.operations.length },
    { label: "Розміри", done: product.sizes.length > 0, count: product.sizes.length },
  ];
  const readyCount = readiness.filter((row) => row.done).length;
  const isReady = readyCount === readiness.length;
  const isArchived = product.status === "ARCHIVED";

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Вироби", href: "/products" }, { label: product.nameUk }]} />

      {isArchived ? (
        <Banner tone="warning" title="Виріб в архіві">
          Його не можна додати в нове замовлення. Існуючі замовлення та збережені пропозиції не змінюються.
        </Banner>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {product.imageUrl ? (
            <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-tint-slate)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="type-page-title">{product.nameUk}</h1>
            <p className="type-body-secondary mt-1">
              {product.internalCode ? `Код ${product.internalCode}` : "Без внутрішнього коду"}
              {product.description ? ` · ${product.description}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {product.isBaseModel ? (
            <StatusBadge tone="info">Базова модель</StatusBadge>
          ) : null}
          <StatusBadge tone={isReady ? "success" : "warning"}>
            {isArchived ? "Архів" : isReady ? "Готовий до замовлення" : `Комплектація ${readyCount}/${readiness.length}`}
          </StatusBadge>
        </div>
      </div>

      <QuickActions>
        {!isArchived ? (
          <QuickAction
            icon={<IconOrders size={15} />}
            href={`/orders/new?productId=${product.id}`}
            hint="productNewOrder"
          >
            Створити замовлення
          </QuickAction>
        ) : null}
      </QuickActions>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_var(--summary-width)]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <HeaderBlock title="Розміри" icon={<IconSizes size={16} />}>
              {product.sizes.length === 0 ? (
                <p className="type-body-secondary">
                  Розміри не задані — контрольний розрахунок ведеться на єдиний розмір.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {product.sizes.map((row) => (
                    <span
                      key={row.id}
                      className="rounded-[var(--radius-badge)] bg-[var(--color-surface-subtle)] px-2 py-1 text-[12.5px] font-medium text-[var(--color-text-secondary)]"
                    >
                      {row.size.nameUk}
                    </span>
                  ))}
                </div>
              )}
            </HeaderBlock>

            <HeaderBlock title="Готовність">
              <ul className="space-y-1.5">
                {readiness.map((row) => (
                  <li key={row.label} className="flex items-center gap-2 text-[13.5px]">
                    {row.done ? (
                      <IconCheckCircle size={16} className="text-[var(--color-success-text)]" />
                    ) : (
                      <IconCircle size={16} className="text-[var(--color-text-tertiary)]" />
                    )}
                    <span className={row.done ? "" : "text-[var(--color-text-secondary)]"}>{row.label}</span>
                    <span className="tabular ml-auto text-[var(--color-text-tertiary)]">{row.count}</span>
                  </li>
                ))}
              </ul>
            </HeaderBlock>

            <HeaderBlock title="Де використовується" icon={<IconOrders size={16} />}>
              {usedIn.length === 0 ? (
                <p className="type-body-secondary">
                  Виріб ще не потрапляв у замовлення. Створіть перше — комплектація скопіюється як є.
                </p>
              ) : (
                <ul className="space-y-2">
                  {usedIn.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-2 text-[13px]">
                      <div className="min-w-0">
                        <Link
                          href={`/orders/${row.order.id}`}
                          className="tabular block truncate font-medium hover:text-[var(--color-primary-700)] hover:underline"
                        >
                          {row.order.number}
                        </Link>
                        <span className="type-caption block truncate">{row.order.client.companyName}</span>
                      </div>
                      <span className="tabular shrink-0 whitespace-nowrap text-[var(--color-text-secondary)]">
                        {row.totalQuantity} шт
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </HeaderBlock>
          </div>

          <ProductCutRateEditor
            productId={product.id}
            optimalQty={product.optimalQty}
            tiers={(product.cutRateTiers ?? []).map((tier) => ({
              minQuantity: tier.minQuantity,
              ratePerUnit: Number(tier.ratePerUnit),
            }))}
          />

          <ProductPriceEditor
            productId={product.id}
            isBaseModel={product.isBaseModel}
            tiers={(product.commercialPriceTiers ?? []).map((tier) => ({
              minQuantity: tier.minQuantity,
              pricePerUnit: Number(tier.pricePerUnit),
            }))}
          />

          <ProductSizeBom
            productId={product.id}
            sizes={product.sizes.map((row) => ({
              id: row.sizeId,
              code: row.size.code,
              nameUk: row.size.nameUk,
            }))}
            materials={product.materials.map((row) => ({
              id: row.id,
              name: row.material.nameUk,
              unit: row.material.unitOfMeasure.code,
              consumption: Number(row.consumptionPerUnit),
              waste: Number(row.wastePercent ?? row.material.defaultWastePercent),
              price: Number(row.material.purchasePrice),
              sizeCodes: sizeCodesFromScopes(row.sizeScopes),
              sizeConsumption: sizeConsumptionFromNorms(row.sizeNorms),
            }))}
            operations={product.operations.map((row) => ({
              id: row.id,
              name: row.operation.nameUk,
              method:
                row.operation.calculationMethod === "SHIFT_OUTPUT"
                  ? "Зміна / норма"
                  : row.operation.calculationMethod === "QUANTITY_TIER"
                    ? "За кількістю"
                    : "Ставка / од.",
              unitCost: operationUnitCost(row),
              sizeCodes: sizeCodesFromScopes(row.sizeScopes),
            }))}
            decorations={product.decorations.map((row) => ({
              id: row.id,
              name: row.decorationMethod.nameUk,
              setupCost: Number(row.decorationMethod.setupCost),
              unitRate: Number(row.decorationMethod.unitRate),
            }))}
            materialsSubtotal={Number(calc.materialsSubtotal)}
            operationsSubtotal={Number(calc.operationsSubtotal)}
            decorationsSubtotal={Number(calc.decorationsSubtotal)}
            materialOptions={materials.map((m) => ({
              id: m.id,
              label: `${m.nameUk} (${m.unitOfMeasure.code})`,
            }))}
            operationOptions={operations.map((o) => ({ id: o.id, label: o.nameUk }))}
            decorationOptions={decorations.map((d) => ({ id: d.id, label: d.nameUk }))}
            unitOptions={units.map((u) => ({ id: u.id, label: u.nameUk }))}
          />
        </div>

        <div className="xl:sticky xl:top-[72px] xl:h-fit">
          <CostSummary
            calc={calc}
            quantity={UNIT_QTY}
            title="Економіка одиниці"
            subtitle="Собівартість 1 виробу за поточними цінами. Крій за тиражем — у таблиці «Крій за тиражем»."
            minimumMarginPercent={pricing.minimumMarginPercent}
            footer={
              <Link
                href={`/orders/new?productId=${product.id}`}
                className="btn-primary btn-primary-sm w-full"
              >
                Створити замовлення на виріб
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}

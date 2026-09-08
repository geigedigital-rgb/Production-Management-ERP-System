import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listSizes } from "@/server/domains/products/service";
import { listMaterials } from "@/server/domains/catalog/materials";
import { listUnits } from "@/server/domains/catalog/materials";
import { listDecorations, listOperations } from "@/server/domains/catalog/operations";
import { StatusBadge } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import { Breadcrumbs, HeaderBlock, QuickAction, QuickActions } from "@/components/ui/ObjectHeader";
import { ProductDetailPreviewShell } from "@/components/products/ProductPreviewQtyContext";
import { ProductImagePicker } from "@/components/products/ProductImagePicker";
import { ProductSizesEditor } from "@/components/products/ProductSizesEditor";
import { DuplicateProductButton } from "@/components/products/DuplicateProductButton";
import { IconCheckCircle, IconCircle, IconOrders, IconSizes } from "@/components/ui/Icons";
import { buildCalcFromProduct, getPricingDefaults } from "@/server/domains/calculation/from-entities";
import { ProductDetailTabs, type ProductDetailTab } from "@/components/products/ProductDetailTabs";
import { prisma } from "@/server/db/client";
import { getCurrentUserAccess, accessHas } from "@/server/auth/access";
import {
  sizeCodesFromScopes,
  sizeConsumptionFromNorms,
  sizeWasteFromNorms,
} from "@/lib/size-bom";
import { operationMethodLabel } from "@/lib/operation-labels";
import { isCutOperationName, summarizeCutOperationDisplay } from "@/lib/cut-rate";
import {
  pickOperationQuantityTiers,
  resolveQuantityTierRate,
} from "@/lib/quantity-tiers";

/** Fixed ops use catalog preview qty; cut is shown separately from tier block. */
const TIER_PREVIEW_QTY = 100;
const CUT_PREVIEW_QTY = 100;

type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

function operationFallbackRate(row: ProductDetail["operations"][number]) {
  return row.rateOverride != null
    ? Number(row.rateOverride)
    : Number(row.operation.baseRate ?? 0);
}

function operationUnitCost(row: ProductDetail["operations"][number]) {
  if (isCutOperationName(row.operation.nameUk)) return 0;
  if (row.operation.calculationMethod === "SHIFT_OUTPUT") {
    const output =
      row.standardOverride != null
        ? Number(row.standardOverride)
        : Number(row.operation.standardOutputPerShift ?? 0);
    if (!output) return 0;
    return Number(row.operation.shiftCost ?? 0) / output;
  }
  const fallback = operationFallbackRate(row);
  if (row.operation.calculationMethod === "QUANTITY_TIER") {
    return resolveQuantityTierRate({
      quantity: TIER_PREVIEW_QTY,
      tiers: pickOperationQuantityTiers(row.rateTiers, row.operation.rateTiers),
      fallbackRate: fallback,
    });
  }
  return fallback;
}

function mapOperationRow(
  row: ProductDetail["operations"][number],
  product: ProductDetail,
): {
  id: string;
  name: string;
  method: string;
  methodCode: string;
  unitCost: number;
  sizeCodes: string[] | null;
  rateTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  isCut: boolean;
  cutDisplay: ReturnType<typeof summarizeCutOperationDisplay> | null;
  cutFallbackRate?: number;
} {
  const sizeCodes = sizeCodesFromScopes(row.sizeScopes);
  const rateTiers = pickOperationQuantityTiers(row.rateTiers, row.operation.rateTiers);

  if (isCutOperationName(row.operation.nameUk)) {
    const fallbackRate = operationFallbackRate(row);
    const cutDisplay = summarizeCutOperationDisplay({
      optimalQty: product.optimalQty,
      tiers: (product.cutRateTiers ?? []).map((tier) => ({
        minQuantity: tier.minQuantity,
        ratePerUnit: Number(tier.ratePerUnit),
      })),
      fallbackRate,
      previewQty: CUT_PREVIEW_QTY,
    });
    return {
      id: row.id,
      name: row.operation.nameUk,
      method: cutDisplay.methodLabel,
      methodCode: row.operation.calculationMethod,
      unitCost: 0,
      sizeCodes,
      rateTiers,
      isCut: true,
      cutDisplay,
      cutFallbackRate: fallbackRate,
    };
  }

  const method =
    row.operation.calculationMethod === "QUANTITY_TIER"
      ? `${operationMethodLabel(row.operation.calculationMethod)} · приклад ${TIER_PREVIEW_QTY} шт`
      : operationMethodLabel(row.operation.calculationMethod);

  return {
    id: row.id,
    name: row.operation.nameUk,
    method,
    methodCode: row.operation.calculationMethod,
    unitCost: operationUnitCost(row),
    sizeCodes,
    rateTiers,
    isCut: false,
    cutDisplay: null,
  };
}

/** Default batch size for economics preview on product card. */
const ECONOMICS_PREVIEW_QTY = 100;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: ProductDetailTab = tab === "pricing" ? "pricing" : "composition";
  const product = await getProduct(id);
  if (!product) notFound();

  const [materials, units, operations, decorations, pricing, usedIn, access, sizeCatalog] =
    await Promise.all([
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
          order: {
            select: {
              id: true,
              number: true,
              status: true,
              client: { select: { companyName: true } },
            },
          },
        },
      }),
      getCurrentUserAccess(),
      listSizes(),
    ]);
  const canDuplicate = accessHas(access, "saveAsStandardProduct");
  const canEditSizes = accessHas(access, "createInlineCatalog");
  const canViewCosts = accessHas(access, "viewProductCosts");
  const canEditBom = accessHas(access, "createInlineCatalog");
  const resolvedTab: ProductDetailTab =
    canViewCosts && activeTab === "pricing" ? "pricing" : "composition";

  const calc = buildCalcFromProduct(product, ECONOMICS_PREVIEW_QTY, pricing);
  const operationRows = product.operations.map((row) => mapOperationRow(row, product));
  const hasCutOperation = operationRows.some((row) => row.isCut);
  const operationsSubtotalFixed = operationRows
    .filter((row) => !row.isCut)
    .reduce((sum, row) => sum + row.unitCost, 0);

  const readiness = [
    { label: "Матеріали", done: product.materials.length > 0, count: product.materials.length },
    { label: "Операції", done: product.operations.length > 0, count: product.operations.length },
    { label: "Розміри", done: product.sizes.length > 0, count: product.sizes.length },
  ];
  const readyCount = readiness.filter((row) => row.done).length;
  const isReady = readyCount === readiness.length;
  const isArchived = product.status === "ARCHIVED";
  const compositionCount =
    product.materials.length + product.operations.length + product.decorations.length;

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
          <ProductImagePicker
            productId={product.id}
            imageUrl={product.imageUrl}
            disabled={isArchived}
          />
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
        {canDuplicate ? <DuplicateProductButton productId={product.id} /> : null}
      </QuickActions>

      <div className="grid gap-4 md:grid-cols-3">
        <HeaderBlock title="Розміри" icon={<IconSizes size={16} />}>
          {canEditSizes && !isArchived ? (
            <ProductSizesEditor
              key={product.sizes.map((row) => row.sizeId).join("|")}
              productId={product.id}
              selectedSizeIds={product.sizes.map((row) => row.sizeId)}
              catalog={sizeCatalog.map((size) => ({
                id: size.id,
                code: size.code,
                nameUk: size.nameUk,
              }))}
            />
          ) : product.sizes.length === 0 ? (
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

      <ProductDetailPreviewShell
        productId={product.id}
        initialCalc={calc}
        initialQuantity={ECONOMICS_PREVIEW_QTY}
        minimumMarginPercent={pricing.minimumMarginPercent}
        showEconomics={canViewCosts}
      >
          <ProductDetailTabs
            productId={product.id}
            activeTab={resolvedTab}
            compositionCount={compositionCount}
            showPricing={canViewCosts}
            bom={{
              productId: product.id,
              hideCosts: !canViewCosts,
              readOnly: !canEditBom || isArchived,
              sizeRules: pricing.sizeRules ?? [],
              sizes: product.sizes.map((row) => ({
                id: row.sizeId,
                code: row.size.code,
                nameUk: row.size.nameUk,
              })),
              materials: product.materials.map((row) => ({
                id: row.id,
                name: row.material.nameUk,
                unit: row.material.unitOfMeasure.code,
                consumption: Number(row.consumptionPerUnit),
                waste: Number(row.wastePercent ?? row.material.defaultWastePercent),
                price: canViewCosts ? Number(row.material.purchasePrice) : 0,
                sizeCodes: sizeCodesFromScopes(row.sizeScopes),
                sizeConsumption: sizeConsumptionFromNorms(row.sizeNorms),
                sizeWaste: sizeWasteFromNorms(row.sizeNorms),
                supplierId: row.supplierId,
                colorSnapshot: row.colorSnapshot,
                materialAvailableColors: row.material.availableColors ?? [],
                supplierOffers: (row.material.supplierOffers ?? []).map((offer) => ({
                  supplierId: offer.supplierId,
                  supplierName: offer.supplier.nameUk,
                  isPrimary: offer.isPrimary,
                  availableColors: offer.availableColors ?? [],
                })),
              })),
              operations: operationRows.map((row) =>
                canViewCosts
                  ? row
                  : {
                      ...row,
                      unitCost: 0,
                      rateTiers: [],
                      cutDisplay: null,
                    },
              ),
              decorations: product.decorations.map((row) => ({
                id: row.id,
                name: row.decorationMethod.nameUk,
                setupCost: canViewCosts
                  ? row.setupCostOverride != null
                    ? Number(row.setupCostOverride)
                    : Number(row.decorationMethod.setupCost)
                  : 0,
                unitRate: canViewCosts ? Number(row.decorationMethod.unitRate) : 0,
              })),
              materialsSubtotal: canViewCosts ? Number(calc.materialsSubtotal) : 0,
              operationsSubtotal: canViewCosts ? operationsSubtotalFixed : 0,
              hasCutOperation,
              decorationSetupTotal: canViewCosts
                ? product.decorations.reduce(
                    (sum, row) =>
                      sum +
                      (row.setupCostOverride != null
                        ? Number(row.setupCostOverride)
                        : Number(row.decorationMethod.setupCost)),
                    0,
                  )
                : 0,
              decorationUnitRateTotal: canViewCosts
                ? product.decorations.reduce(
                    (sum, row) => sum + Number(row.decorationMethod.unitRate),
                    0,
                  )
                : 0,
              materialOptions: materials.map((m) => ({
                id: m.id,
                label: `${m.nameUk} (${m.unitOfMeasure.code})`,
                unit: m.unitOfMeasure.code,
                composition: m.composition?.trim() || null,
              })),
              operationOptions: operations.map((o) => ({ id: o.id, label: o.nameUk })),
              decorationOptions: decorations.map((d) => ({ id: d.id, label: d.nameUk })),
              unitOptions: units.map((u) => ({ id: u.id, label: u.nameUk })),
              cutRateContext: {
                optimalQty: product.optimalQty,
                tiers: (product.cutRateTiers ?? []).map((tier) => ({
                  minQuantity: tier.minQuantity,
                  ratePerUnit: Number(tier.ratePerUnit),
                })),
              },
            }}
            cut={{
              productId: product.id,
              optimalQty: product.optimalQty,
              tiers: (product.cutRateTiers ?? []).map((tier) => ({
                minQuantity: tier.minQuantity,
                ratePerUnit: Number(tier.ratePerUnit),
              })),
            }}
            price={{
              productId: product.id,
              isBaseModel: product.isBaseModel,
              tiers: (product.commercialPriceTiers ?? []).map((tier) => ({
                minQuantity: tier.minQuantity,
                pricePerUnit: Number(tier.pricePerUnit),
              })),
            }}
          />
      </ProductDetailPreviewShell>
    </div>
  );
}

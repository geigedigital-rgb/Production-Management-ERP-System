import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { getOrder, refreshOrderItemFabricPricing } from "@/server/domains/orders/service";
import { listMaterials, listUnits, getFabricPricingGlobals } from "@/server/domains/catalog/materials";
import { listDecorations, listOperations } from "@/server/domains/catalog/operations";
import { buildCalcFromOrderItem, cutRateContextFromProduct, getPricingDefaults, getPricingForOrder, resolveOrderOperationUnitRate } from "@/server/domains/calculation/from-entities";
import { draftLineFromItem } from "@/lib/order-item-commercial";
import { Breadcrumbs, QuickAction, QuickActions } from "@/components/ui/ObjectHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { CostStructure } from "@/components/calc/CostSummary";
import { OrderPipeline } from "@/components/orders/OrderPipeline";
import {
  IconCalc,
  IconClients,
  IconFiles,
  IconProducts,
  IconQuote,
  IconSpec,
  IconVersions,
} from "@/components/ui/Icons";
import { formatDateUk, formatMoneyUah, formatUnit, cn } from "@/lib/utils";
import { formatSizeRun, lineCostOnSizes, uniqueBomCount } from "@/lib/size-bom";
import { fabricMetersNeeded } from "@/lib/fabric-pricing";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { corridorFor, corridorHref, itemNeed } from "@/lib/order-corridor";
import {
  approvedProposal,
  buildOrderProposals,
  latestCompleteProposal,
} from "@/lib/order-proposals";
import { listEntityActivity } from "@/server/domains/activity/service";
import { ActivityTimeline, mapActivityEvents } from "@/components/activity/ActivityTimeline";
import { OrderMarginControl } from "@/components/orders/OrderMarginControl";
import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { listProducts } from "@/server/domains/products/service";
import { publicUploadUrl } from "@/lib/supabase/client";
import { ConfigurationTab } from "./ConfigurationTab";
import { CalculationTab } from "./CalculationTab";
import { VersionsTab } from "./VersionsTab";
import { FilesTab } from "./FilesTab";
import type { ReadinessCheck } from "./HandoverDialog";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; item?: string; action?: string }>;
}) {
  const { id } = await params;
  const { tab, item: itemParam, action: actionParam } = await searchParams;
  const activeTab = tab || "configuration";

  const access = await getCurrentUserAccess();
  const session = await auth();
  let order = await getOrder(id);
  if (!order) notFound();
  let item =
    (itemParam ? order.items.find((row) => row.id === itemParam) : null) ?? order.items[0];
  if (!item) notFound();

  if (
    item.materials.some(
      (row) => row.material?.type === "FABRIC" && row.fabricDeliveryComputed == null,
    )
  ) {
    await refreshOrderItemFabricPricing(item.id);
    order = (await getOrder(id))!;
    item =
      (itemParam ? order.items.find((row) => row.id === itemParam) : null) ?? order.items[0];
    if (!item) notFound();
  }

  const tabHref = (key: string) =>
    `/orders/${order.id}?tab=${key}${order.items.length > 1 ? `&item=${item.id}` : ""}`;

  const [materials, units, operationsCatalog, decorationsCatalog, pricing, projectPricing, activityEvents, catalogProducts] =
    await Promise.all([
      listMaterials(),
      listUnits(),
      listOperations(),
      listDecorations(),
      getPricingForOrder(order.id),
      getPricingDefaults(),
      listEntityActivity("order", order.id, 20),
      listProducts(),
    ]);

  const calc = buildCalcFromOrderItem(item, pricing, {
    cutRate: cutRateContextFromProduct(item.product),
  });
  const totalQuantity = item.totalQuantity;
  const orderQuantity = order.items.reduce((sum, row) => sum + row.totalQuantity, 0);
  const locked = order.status === "HANDED_TO_PRODUCTION" || order.status === "CLOSED";
  const canApprove = accessHas(access, "changeOrderStatus");

  const fabricGlobals = await getFabricPricingGlobals();
  const quantitiesBySize = Object.fromEntries(
    item.sizes.map((size) => [size.sizeCode, size.quantity]),
  );

  const materialRows = item.materials.map((row) => {
    const consumption = Number(row.consumptionPerUnit);
    const waste = Number(row.wastePercent);
    const price = Number(row.purchasePrice);
    const unitCost = consumption * (1 + waste / 100) * price;
    const siblings = item.materials.map((line) => ({
      id: line.id,
      groupKey: line.materialId ?? line.nameSnapshot,
      sizeCode: line.sizeCode,
    }));
    const cut = row.material?.priceMeterUahCutVat != null
      ? Number(row.material.priceMeterUahCutVat)
      : null;
    const minM =
      row.material?.minWholesaleMeters != null
        ? Number(row.material.minWholesaleMeters)
        : row.material?.metersPerRoll != null
          ? Number(row.material.metersPerRoll)
          : null;
    let pricingHint: string | null = null;
    if (row.material?.type === "FABRIC" && cut != null && cut > 0) {
      const nearCut = Math.abs(price - cut) < 0.05;
      pricingHint = nearCut
        ? minM
          ? `ціна на відріз (гурт від ${minM} м)`
          : "ціна на відріз"
        : "гуртова ціна";
    }
    return {
      id: row.id,
      name: row.nameSnapshot,
      unit: formatUnit(row.unitCodeSnapshot),
      consumption,
      waste,
      price,
      unitCost,
      totalCost: lineCostOnSizes(
        {
          id: row.id,
          groupKey: row.materialId ?? row.nameSnapshot,
          sizeCode: row.sizeCode,
          consumption,
          waste,
          price,
        },
        siblings,
        item.sizes,
      ),
      sizeCode: row.sizeCode ?? null,
      groupKey: row.materialId ?? row.nameSnapshot,
      pricingHint,
      supplierName: row.supplierNameSnapshot ?? row.material?.supplierCode ?? null,
      isFabric: row.material?.type === "FABRIC",
    };
  });

  const itemCutRate = cutRateContextFromProduct(item.product);

  const operationRows = item.operations.map((row) => {
    const unitCost =
      row.calculationMethod === "SHIFT_OUTPUT"
        ? Number(row.standardOutput ?? 0) > 0
          ? Number(row.shiftCost ?? 0) / Number(row.standardOutput)
          : 0
        : resolveOrderOperationUnitRate(row, totalQuantity, itemCutRate) ?? 0;
    const qtyForRow = item.sizes
      .filter((size) => !row.sizeCode || row.sizeCode === size.sizeCode)
      .reduce((sum, size) => sum + size.quantity, 0);
    return {
      id: row.id,
      name: row.nameSnapshot,
      method: row.calculationMethod,
      unitCost,
      totalCost: unitCost * (row.sizeCode ? qtyForRow : totalQuantity),
      sizeCode: row.sizeCode ?? null,
      groupKey: row.operationId ?? row.nameSnapshot,
    };
  });

  const decorationRows = item.decorations.map((row) => ({
    id: row.id,
    name: row.nameSnapshot,
    setupCost: Number(row.setupCost),
    unitRate: Number(row.unitRate),
    totalCost: Number(row.setupCost) + Number(row.unitRate) * totalQuantity,
  }));

  const fabricDeliveryRows = item.materials
    .filter((row) => row.material?.type === "FABRIC")
    .map((row) => {
      const meters = fabricMetersNeeded({
        consumptionPerUnit: Number(row.consumptionPerUnit),
        wastePercent: Number(row.wastePercent),
        quantitiesBySize,
        sizeCode: row.sizeCode,
      });
      const metersPerKg =
        row.material?.metersPerKg != null ? Number(row.material.metersPerKg) : null;
      const kgNeeded =
        metersPerKg != null && metersPerKg > 0 && meters > 0
          ? Math.round((meters / metersPerKg) * 10) / 10
          : null;
      return {
        id: row.id,
        name: row.nameSnapshot,
        sizeCode: row.sizeCode ?? null,
        amount: Number(row.fabricDeliveryAmount ?? 0),
        manual: row.fabricDeliveryManual,
        cargoUsdPerKg:
          row.cargoUsdPerKg != null
            ? Number(row.cargoUsdPerKg)
            : fabricGlobals.fabricCargoUsdPerKg,
        usdUahRate:
          row.usdUahRate != null ? Number(row.usdUahRate) : fabricGlobals.usdUahRate,
        kgNeeded,
      };
    });

  const fabricDeliveryAmount = Number(item.fabricDeliveryAmount ?? 0);

  const versions = item.versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    label: version.label,
    comment: version.comment,
    isApproved: version.isApproved,
    createdAt: version.createdAt.toISOString(),
    authorName: version.author.name,
    sellingPricePerUnit: Number(version.sellingPricePerUnit),
    marginPercent: Number(version.marginPercent),
    totalSellingValue: Number(version.totalSellingValue),
    proposalRevision: version.proposalRevision,
    proposalLabel: version.proposalLabel,
  }));

  const proposalItems = order.items.map((row) => ({
    id: row.id,
    nameUk: row.nameUk,
    totalQuantity: row.totalQuantity,
    versions: row.versions.map((version) => ({
      id: version.id,
      orderItemId: row.id,
      versionNumber: version.versionNumber,
      label: version.label,
      comment: version.comment,
      isApproved: version.isApproved,
      createdAt: version.createdAt,
      proposalRevision: version.proposalRevision,
      proposalLabel: version.proposalLabel,
      sellingPricePerUnit: version.sellingPricePerUnit,
      totalSellingValue: version.totalSellingValue,
      marginPercent: version.marginPercent,
      costPerUnit: version.costPerUnit,
      author: version.author,
    })),
  }));
  const proposals = buildOrderProposals(proposalItems);
  const latestProposal = latestCompleteProposal(proposalItems);
  const approvedProposalGroup = approvedProposal(proposalItems);
  const draftLines = order.items.map((row) => {
    const lineCalc = buildCalcFromOrderItem(row, pricing, {
      cutRate: cutRateContextFromProduct(row.product),
    });
    const draft = draftLineFromItem(row, lineCalc);
    return {
      orderItemId: row.id,
      nameUk: row.nameUk,
      totalQuantity: row.totalQuantity,
      costPerUnit: draft.costPerUnit,
      sellingPricePerUnit: draft.sellingPricePerUnit,
      marginPercent: draft.marginPercent,
      totalSellingValue: draft.totalSellingValue,
      fromPriceList: draft.fromPriceList,
      basePricePerUnit: draft.basePricePerUnit,
    };
  });
  const hasCommercialPriceList = draftLines.some((line) => line.fromPriceList);
  const orderDraftTotal = draftLines.reduce((sum, line) => sum + line.totalSellingValue, 0);
  const draftDrift =
    latestProposal != null &&
    Math.abs(latestProposal.totalSellingValue - orderDraftTotal) > 0.009;

  const approvedVersion = versions.find((version) => version.isApproved);
  const allItemsApproved = Boolean(approvedProposalGroup);
  const allItemsHaveQty = order.items.every((row) => row.totalQuantity > 0);
  const hasAnyApprovedVersion = allItemsApproved;
  const hasCompleteProposal = Boolean(latestProposal);
  const hasApprovedProposal = Boolean(approvedProposalGroup);
  const orderApprovedTotal = approvedProposalGroup?.totalSellingValue ?? orderDraftTotal;

  const readiness: ReadinessCheck[] = [
    {
      key: "version",
      label:
        order.items.length > 1
          ? "Погоджено пропозицію по всіх позиціях"
          : "Є погоджена пропозиція",
      done: allItemsApproved,
      hint: allItemsApproved
        ? `${order.items.length} поз. · ${formatMoneyUah(orderApprovedTotal)}`
        : latestProposal
          ? `Пропозиція v${latestProposal.revision} збережена — потрібне погодження`
          : "Збережіть пропозицію у вкладці «Пропозиції»",
    },
    {
      key: "quantity",
      label: "Вказано кількість",
      done: allItemsHaveQty,
      hint: `${orderQuantity} шт${order.items.length > 1 ? ` · ${order.items.length} поз.` : ""}`,
    },
    {
      key: "materials",
      label: "Заповнено матеріали",
      done: materialRows.length > 0,
      hint: `${materialRows.length} позицій`,
    },
    {
      key: "operations",
      label: "Заповнено операції",
      done: operationRows.length > 0,
      hint: `${operationRows.length} позицій`,
    },
    {
      key: "deadline",
      label: "Встановлено дедлайн",
      done: Boolean(order.deadline),
      hint: order.deadline ? formatDateUk(order.deadline) : "Дата не вказана",
    },
  ];

  const needsArtwork = order.items.some((row) => row.decorations.length > 0);
  if (needsArtwork) {
    readiness.push({
      key: "artwork",
      label: "Додано макет нанесення",
      done: order.files.length > 0,
      hint:
        order.files.length > 0
          ? `${order.files.length} файл.`
          : "Завантажте макет у вкладці «Документи»",
    });
  }

  const tabs = [
    {
      key: "configuration",
      label: "Комплектація",
      href: tabHref("configuration"),
      icon: <IconProducts size={15} />,
      count: materialRows.length + operationRows.length + decorationRows.length,
    },
    {
      key: "calculation",
      label: "Калькуляція",
      href: tabHref("calculation"),
      icon: <IconCalc size={15} />,
    },
    {
      key: "versions",
      label: "Пропозиції",
      href: tabHref("versions"),
      icon: <IconVersions size={15} />,
      count: proposals.length,
    },
    {
      key: "files",
      label: "Документи",
      href: tabHref("files"),
      icon: <IconFiles size={15} />,
    },
  ];

  const handoverReady = readiness.every((check) => check.done);
  const action = corridorFor({
    status: order.status,
    deadline: order.deadline,
    filesCount: order.files.length,
    hasCompleteProposal,
    hasApprovedProposal,
    items: order.items.map((row) => ({
      id: row.id,
      nameUk: row.nameUk,
      totalQuantity: row.totalQuantity,
      materialsCount: row.materials.length,
      operationsCount: row.operations.length,
      decorationsCount: row.decorations.length,
      versionCount: row.versions.length,
      hasApprovedVersion: row.versions.some((version) => version.isApproved),
      specificationLocked: Boolean(row.specification),
      inLatestProposal: latestProposal?.lines.some((line) => line.orderItemId === row.id) ?? false,
    })),
  });
  const orderFlags = { hasCompleteProposal, hasApprovedProposal };
  const nextHref = corridorHref(order.id, action);
  const onNextTab = activeTab === action.tab && (!action.focusItemId || action.focusItemId === item.id);
  const showHeaderCta =
    action.key !== "cancelled" &&
    !(action.key === "compose" && onNextTab) &&
    !(action.key === "artwork" && onNextTab) &&
    !(action.key === "closed" && !action.specificationReady);
  const headerPrimary = action.key !== "handover" || handoverReady;
  const withRail = activeTab !== "configuration";
  const itemRows = order.items.map((row) => {
    const lineCalc = buildCalcFromOrderItem(row, pricing, {
      cutRate: cutRateContextFromProduct(row.product),
    });
    const draft = draftLineFromItem(row, lineCalc);
    return {
      id: row.id,
      nameUk: row.nameUk,
      quantity: row.totalQuantity,
      sizeRun: formatSizeRun(row.sizes),
      materialsCount: uniqueBomCount(
        row.materials.map((line) => ({
          id: line.id,
          groupKey: line.materialId ?? line.nameSnapshot,
        })),
      ),
      operationsCount: uniqueBomCount(
        row.operations.map((line) => ({
          id: line.id,
          groupKey: line.operationId ?? line.nameSnapshot,
        })),
      ),
      decorationsCount: row.decorations.length,
      versionLabel: approvedProposalGroup?.lines.find((line) => line.orderItemId === row.id)
        ? `v${approvedProposalGroup.revision} · погоджено`
        : latestProposal?.lines.find((line) => line.orderItemId === row.id)
          ? `v${latestProposal.revision}`
          : row.versions[0]
            ? `v${row.versions[0].versionNumber}`
            : "немає",
      unitPrice: row.totalQuantity > 0 ? draft.sellingPricePerUnit : null,
      need: itemNeed(
        {
          id: row.id,
          nameUk: row.nameUk,
          totalQuantity: row.totalQuantity,
          materialsCount: row.materials.length,
          operationsCount: row.operations.length,
          decorationsCount: row.decorations.length,
          versionCount: row.versions.length,
          hasApprovedVersion: row.versions.some((version) => version.isApproved),
          specificationLocked: Boolean(row.specification),
          inLatestProposal: latestProposal?.lines.some((line) => line.orderItemId === row.id) ?? false,
        },
        orderFlags,
      ),
      sourceProductId: row.sourceProductId,
    };
  });
  const catalog = catalogProducts.map((product) => ({
    id: product.id,
    label: product.internalCode ? `${product.nameUk} (${product.internalCode})` : product.nameUk,
    nameUk: product.nameUk,
    internalCode: product.internalCode,
    imageUrl: product.imageUrl,
    materialsCount: product.materials.length,
    operationsCount: product.operations.length,
    decorationsCount: product.decorations.length,
    sizes: product.sizes.map((size) => ({ code: size.size.code, nameUk: size.size.nameUk })),
  }));

  const facts = [
    {
      label: "Клієнт",
      value: (
        <Link
          href={`/clients/${order.clientId}`}
          className="hover:text-[var(--color-primary-700)] hover:underline"
        >
          {order.client.companyName}
        </Link>
      ),
    },
    { label: "Менеджер", value: order.manager.name },
    { label: "Дедлайн", value: formatDateUk(order.deadline) },
    { label: "Кількість", value: `${orderQuantity} шт` },
  ];

  const marginControl = (
    <OrderMarginControl
      orderId={order.id}
      locked={locked}
      pricingMethod={pricing.pricingMethod}
      projectDefault={projectPricing.targetRatePercent}
      orderOverride={order.targetMarginPercent != null ? Number(order.targetMarginPercent) : null}
      minimumMarginPercent={pricing.minimumMarginPercent}
      costPerUnit={Number(calc.costPerUnit)}
      totalQuantity={totalQuantity}
      layout={withRail ? "panel" : "strip"}
    />
  );

  const activeDraft = draftLines.find((line) => line.orderItemId === item.id);

  const moneyRail = (
    <aside className="space-y-3 xl:sticky xl:top-[72px] xl:h-fit">
      {marginControl}
      {activeDraft?.fromPriceList ? (
        <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
          <p className="type-caption">Комерційна ціна з прайсу</p>
          <p className="text-[20px] font-semibold tabular">
            {formatMoneyUah(activeDraft.sellingPricePerUnit)}
            <span className="ml-1 text-[12px] font-normal text-[var(--color-text-quiet)]">/ од.</span>
          </p>
          <p className="type-caption mt-1">
            Разом {formatMoneyUah(activeDraft.totalSellingValue)} · собівартість{" "}
            {formatMoneyUah(activeDraft.costPerUnit)} / од.
          </p>
        </div>
      ) : null}
      <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <h2 className="type-subsection mb-3">Структура собівартості</h2>
        <CostStructure calc={calc} fabricDeliveryAmount={fabricDeliveryAmount} />
        {approvedProposalGroup ? (
          <p className="type-caption mt-3 border-t border-[var(--color-divider)] pt-2">
            Погоджено пропозицію v{approvedProposalGroup.revision}:{" "}
            {formatMoneyUah(approvedProposalGroup.totalSellingValue)} за замовлення
          </p>
        ) : approvedVersion ? (
          <p className="type-caption mt-3 border-t border-[var(--color-divider)] pt-2">
            Погоджено v{approvedVersion.versionNumber}:{" "}
            {formatMoneyUah(approvedVersion.sellingPricePerUnit)} / од.
          </p>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Breadcrumbs items={[{ label: "Замовлення", href: "/orders" }, { label: order.number }]} />
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <h1 className="type-page-title">{order.number}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="type-body-secondary mt-1">
              {order.title && order.title !== item.nameUk ? order.title : item.nameUk}
              {order.items.length > 1 ? ` · ${order.items.length} позиції` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <QuickActions>
              <QuickAction
                icon={<IconClients size={15} />}
                href={`/clients/${order.clientId}`}
                hint="orderClientCard"
              >
                Клієнт
              </QuickAction>
              {action.quotationReady ? (
                <QuickAction
                  icon={<IconQuote size={15} />}
                  href={`/orders/${order.id}/quotation`}
                  hint="orderQuotation"
                >
                  КП
                </QuickAction>
              ) : null}
              {action.specificationReady ? (
                <QuickAction
                  icon={<IconSpec size={15} />}
                  href={`/orders/${order.id}/specification`}
                  hint="orderSpecification"
                >
                  Специфікація
                </QuickAction>
              ) : null}
            </QuickActions>
            {showHeaderCta ? (
              <Link
                href={
                  action.key === "spec" || action.key === "closed"
                    ? `/orders/${order.id}/specification`
                    : nextHref
                }
                className={headerPrimary ? "btn-primary" : "btn-secondary"}
                target={action.key === "spec" || action.key === "closed" ? "_blank" : undefined}
              >
                {action.label}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,380px)]">
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              {facts.map((fact, index) => (
                <div
                  key={fact.label}
                  className={cn(
                    "px-3.5 py-2.5 sm:px-4",
                    index < facts.length - 1 && "sm:border-r sm:border-[var(--color-divider)]",
                    index < 2 && "border-b border-[var(--color-divider)] sm:border-b-0",
                  )}
                >
                  <dt className="type-caption">{fact.label}</dt>
                  <dd className="mt-0.5 truncate text-[13.5px] font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-[var(--color-divider)] px-3.5 py-2.5 lg:border-t-0 lg:border-l">
              <OrderPipeline status={order.status} nextTitle={`${action.index}/${action.of} · ${action.detail}`} />
            </div>
          </div>
          {order.comment ? (
            <p className="border-t border-[var(--color-divider)] px-4 py-2 type-caption">
              <span className="text-[var(--color-text-tertiary)]">Коментар: </span>
              {order.comment}
            </p>
          ) : null}
        </div>
      </header>

      <OrderItemsTable
        orderId={order.id}
        activeTab={activeTab}
        selectedId={item.id}
        locked={locked}
        handedOver={order.status === "HANDED_TO_PRODUCTION" || order.status === "CLOSED"}
        rows={itemRows}
        catalog={catalog}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="type-caption">Працюєте з позицією</p>
          <p className="text-[14px] font-semibold tracking-[-0.01em]">
            {item.nameUk}
            <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">
              {item.totalQuantity} шт
              {item.comment ? ` · ${item.comment}` : ""}
            </span>
          </p>
        </div>
        <SegmentedTabs items={tabs} active={activeTab} />
      </div>

      {activeTab === "configuration" ? (
        <div className="space-y-3">
          {marginControl}
          <ConfigurationTab
            orderId={order.id}
            itemId={item.id}
            locked={locked}
            productName={item.nameUk}
            comment={item.comment}
            sizes={item.sizes.map((size) => ({
              id: size.id,
              sizeCode: size.sizeCode,
              sizeNameUk: size.sizeNameUk,
              quantity: size.quantity,
            }))}
            materials={materialRows}
            operations={operationRows}
            decorations={decorationRows}
            materialOptions={materials.map((material) => ({
              id: material.id,
              label: `${material.nameUk} (${formatUnit(material.unitOfMeasure.code)})`,
            }))}
            operationOptions={operationsCatalog.map((operation) => ({
              id: operation.id,
              label: operation.nameUk,
            }))}
            decorationOptions={decorationsCatalog.map((decoration) => ({
              id: decoration.id,
              label: decoration.nameUk,
            }))}
            unitOptions={units.map((unit) => ({ id: unit.id, label: unit.nameUk }))}
            materialsSubtotal={Number(calc.materialsSubtotal)}
            operationsSubtotal={Number(calc.operationsSubtotal)}
            decorationsSubtotal={Number(calc.decorationsSubtotal)}
            corridorHint={
              action.focusItemId && action.focusItemId !== item.id
                ? null
                : action.key === "compose"
                  ? { title: action.title, detail: action.detail }
                  : action.key === "saveVersion"
                    ? { title: action.title, detail: action.detail }
                    : null
            }
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <div className="min-w-0">
            {activeTab === "calculation" ? (
              <CalculationTab
                calc={calc}
                totalQuantity={totalQuantity}
                materials={materialRows}
                operations={operationRows}
                decorations={decorationRows}
                fabricDeliveryLines={fabricDeliveryRows}
                fabricDeliveryAmount={fabricDeliveryAmount}
                pricingMethod={pricing.pricingMethod}
                targetRatePercent={pricing.targetRatePercent}
                minimumMarginPercent={pricing.minimumMarginPercent}
                isOrderOverride={pricing.isOrderOverride}
                hasCommercialPriceList={Boolean(activeDraft?.fromPriceList)}
                commercialSellingPricePerUnit={activeDraft?.fromPriceList ? activeDraft.sellingPricePerUnit : undefined}
                commercialTotalValue={activeDraft?.fromPriceList ? activeDraft.totalSellingValue : undefined}
                commercialMarginPercent={activeDraft?.fromPriceList ? activeDraft.marginPercent : undefined}
                corridorHint={
                  action.focusItemId && action.focusItemId !== item.id
                    ? null
                    : action.key === "compose" || action.key === "saveVersion"
                      ? {
                          title: action.title,
                          detail: action.detail,
                          href: action.key === "saveVersion" ? nextHref : tabHref("configuration"),
                          label: action.label,
                        }
                      : null
                }
              />
            ) : null}

            {activeTab === "versions" ? (
              <VersionsTab
                orderId={order.id}
                orderNumber={order.number}
                itemCount={order.items.length}
                activeItemName={item.nameUk}
                proposals={proposals}
                draftLines={draftLines}
                minimumMarginPercent={pricing.minimumMarginPercent}
                orderTotalQuantity={orderQuantity}
                orderTotalValue={orderDraftTotal}
                status={order.status}
                canApprove={canApprove}
                specificationLockedAt={item.specification?.lockedAt.toISOString() ?? null}
                readiness={readiness}
                autoSave={actionParam === "save"}
                draftDrift={draftDrift}
              />
            ) : null}

            {activeTab === "files" ? (
              <FilesTab
                orderId={order.id}
                itemId={item.id}
                hasApprovedVersion={hasAnyApprovedVersion}
                specificationLockedAt={item.specification?.lockedAt.toISOString() ?? null}
                needsArtwork={needsArtwork}
                locked={locked}
                files={order.files.map((file) => ({
                  id: file.id,
                  fileName: file.fileName,
                  mimeType: file.mimeType,
                  sizeBytes: file.sizeBytes,
                  createdAt: file.createdAt.toISOString(),
                  url: publicUploadUrl(file.storageKey),
                }))}
              />
            ) : null}
          </div>
          {moneyRail}
        </div>
      )}

      <ActivityTimeline
        events={mapActivityEvents(activityEvents)}
        title="Історія замовлення"
        empty="Подій ще немає — зʼявляться після збереження пропозицій і змін статусу"
      />
    </div>
  );
}

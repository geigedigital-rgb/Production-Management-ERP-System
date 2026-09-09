import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getOrder, refreshOrderItemFabricPricing } from "@/server/domains/orders/service";
import { listMaterials, listUnits, getFabricPricingGlobals } from "@/server/domains/catalog/materials";
import { listDecorations, listOperations } from "@/server/domains/catalog/operations";
import { buildCalcFromOrderItem, calcOptionsFromProduct, getPricingDefaults, getPricingForOrder, resolveOrderOperationUnitRate, resolveFixedCostAllocationForOrderItem } from "@/server/domains/calculation/from-entities";
import { fixedCostOptionsFromDb } from "@/server/domains/fixed-costs/service";
import {
  resolveSewerCount,
  validateFixedCostParams,
  type FixedCostValidationError,
} from "@/lib/fixed-costs";
import { draftLineFromItem } from "@/lib/order-item-commercial";
import { Breadcrumbs, QuickAction, QuickActions } from "@/components/ui/ObjectHeader";
import { Banner } from "@/components/ui/Banner";
import { ViewTabs } from "@/components/ui/Tabs";
import {
  OrderChevronPipeline,
  OrderFactsStrip,
  OrderWorkspaceHeader,
  OrderWorkspacePanel,
  OrderWorkspaceShell,
} from "@/components/orders/OrderWorkspaceLayout";
import { CostStructure } from "@/components/calc/CostSummary";
import {
  IconCalc,
  IconClients,
  IconFiles,
  IconProducts,
  IconQuote,
  IconSpec,
  IconVersions,
} from "@/components/ui/Icons";
import { formatDateUk, formatMoneyUah, formatUnit } from "@/lib/utils";
import { formatSizeRun, lineCostOnSizes, uniqueBomCount } from "@/lib/size-bom";
import { fabricMetersNeeded } from "@/lib/fabric-pricing";
import {
  accessHas,
  canEditOrderComposition,
  canViewOrderCosts,
  getCurrentUserAccess,
} from "@/server/auth/access";
import { SubmitForCalculationButton } from "@/components/orders/SubmitForCalculationButton";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { corridorFor, corridorHref, itemNeed } from "@/lib/order-corridor";
import {
  approvedProposal,
  buildOrderProposals,
  latestCompleteProposal,
} from "@/lib/order-proposals";
import { listEntityActivity } from "@/server/domains/activity/service";
import { ActivityTimeline, mapActivityEvents } from "@/components/activity/ActivityTimeline";
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
  let activeTab = tab || "configuration";

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

  const [materials, units, operationsCatalog, decorationsCatalog, pricing, projectPricing, activityEvents, catalogProducts, fixedCosts] =
    await Promise.all([
      listMaterials(),
      listUnits(),
      listOperations(),
      listDecorations(),
      getPricingForOrder(order.id),
      getPricingDefaults(),
      listEntityActivity("order", order.id, 20),
      listProducts(),
      fixedCostOptionsFromDb(),
    ]);

  const itemCalcOptions = {
    ...calcOptionsFromProduct(item.product),
    fixedCosts,
  };
  const calc = buildCalcFromOrderItem(item, pricing, itemCalcOptions);
  const fixedCostAllocation =
    fixedCosts != null
      ? resolveFixedCostAllocationForOrderItem(
          item,
          fixedCosts,
          itemCalcOptions,
          pricing.sizeRules,
        )
      : null;
  const { sewerCount: sewerCountForValidation } = resolveSewerCount({
    companySewerCount: fixedCosts?.companySewerCount ?? 0,
    orderOverride: item.sewerCountOverride,
  });
  const fixedCostError: FixedCostValidationError | null = fixedCosts
    ? validateFixedCostParams({
        workingDaysPerMonth: fixedCosts.workingDaysPerMonth,
        sewerCount: sewerCountForValidation,
        dailySewerPay: fixedCosts.dailySewerPay,
        monthlyTotal: fixedCosts.monthlyTotal,
      })
    : "MONTHLY_TOTAL_ZERO";
  const totalQuantity = item.totalQuantity;
  const orderQuantity = order.items.reduce((sum, row) => sum + row.totalQuantity, 0);
  const locked = order.status === "HANDED_TO_PRODUCTION" || order.status === "CLOSED";
  const canApprove = accessHas(access, "changeOrderStatus");
  const canViewCosts = canViewOrderCosts(access);
  const canRunCalc = accessHas(access, "saveVersions");
  const canEditComposition = canEditOrderComposition(access, order.status);
  const canCreateCatalog = accessHas(access, "createInlineCatalog");
  const compositionLocked = locked || !canEditComposition;

  if (!canViewCosts && (activeTab === "calculation" || activeTab === "versions")) {
    redirect(
      `/orders/${id}?tab=configuration${itemParam ? `&item=${itemParam}` : ""}`,
    );
  }

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

  const itemCalcOptionsForRates = itemCalcOptions;

  const operationRows = item.operations.map((row) => {
    const unitCost =
      row.calculationMethod === "SHIFT_OUTPUT"
        ? Number(row.standardOutput ?? 0) > 0
          ? Number(row.shiftCost ?? 0) / Number(row.standardOutput)
          : 0
        : resolveOrderOperationUnitRate(row, totalQuantity, itemCalcOptionsForRates) ?? 0;
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
      ...calcOptionsFromProduct(row.product),
      fixedCosts,
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
      priceSource: draft.priceSource,
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
    ...(canViewCosts
      ? [
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
        ]
      : []),
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
  const withRail = canViewCosts && activeTab !== "configuration";
  const itemRows = order.items.map((row) => {
    const lineCalc = buildCalcFromOrderItem(row, pricing, {
      ...calcOptionsFromProduct(row.product),
      fixedCosts,
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
      unitPrice: canViewCosts && row.totalQuantity > 0 ? draft.sellingPricePerUnit : null,
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
      hint: order.client.contactPerson ?? undefined,
    },
    { label: "Менеджер", value: order.manager.name },
    { label: "Дедлайн", value: formatDateUk(order.deadline) },
    { label: "Кількість", value: `${orderQuantity} шт` },
    {
      label: "Позиції",
      value: String(order.items.length),
      hint: order.items.length > 1 ? "у замовленні" : undefined,
    },
    ...(canViewCosts
      ? [
          {
            label: "Сума",
            value: formatMoneyUah(orderApprovedTotal),
            hint: approvedProposalGroup
              ? `пропозиція v${approvedProposalGroup.revision}`
              : "чернетка",
          },
        ]
      : []),
  ];

  const activeDraft = draftLines.find((line) => line.orderItemId === item.id);
  const clientPricePerUnit = activeDraft?.sellingPricePerUnit ?? Number(calc.sellingPricePerUnit);
  const clientTotal = activeDraft?.totalSellingValue ?? Number(calc.totalSellingValue);
  const costPerUnit = activeDraft?.costPerUnit ?? Number(calc.costPerUnit);
  const costTotal = costPerUnit * totalQuantity;
  const profitPerUnit = clientPricePerUnit - costPerUnit;
  const profitTotal = clientTotal - costTotal;
  const marginPct =
    activeDraft?.marginPercent ??
    (clientTotal > 0 ? (profitTotal / clientTotal) * 100 : 0);
  const priceSourceLabel =
    activeDraft?.priceSource === "pricelist"
      ? "з базового прайсу виробу"
      : activeDraft?.priceSource === "sewing_markup"
        ? "націнка на пошив за тиражем"
        : "немає прайсу — як собівартість";

  const moneyRail = canViewCosts ? (
    <aside className="space-y-3 xl:sticky xl:top-[72px] xl:h-fit">
      <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <p className="type-caption">Ціна для клієнта</p>
        <p className="text-[20px] font-semibold tabular">
          {formatMoneyUah(clientPricePerUnit)}
          <span className="ml-1 text-[12px] font-normal text-[var(--color-text-quiet)]">/ од.</span>
        </p>
        <p className="type-caption mt-0.5">{priceSourceLabel}</p>
        <dl className="mt-3 space-y-1.5 border-t border-[var(--color-divider)] pt-3 text-[13px]">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-text-secondary)]">Собівартість / од.</dt>
            <dd className="tabular">{formatMoneyUah(costPerUnit)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-text-secondary)]">Націнка / од.</dt>
            <dd className="tabular font-medium text-[var(--color-success-text)]">
              {formatMoneyUah(profitPerUnit)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-text-secondary)]">Маржа</dt>
            <dd className="tabular font-medium">{marginPct.toFixed(1)}%</dd>
          </div>
          {totalQuantity > 1 ? (
            <>
              <div className="flex justify-between gap-2 border-t border-[var(--color-divider)] pt-1.5">
                <dt className="text-[var(--color-text-secondary)]">Разом продаж</dt>
                <dd className="tabular font-semibold">{formatMoneyUah(clientTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-secondary)]">Разом собівартість</dt>
                <dd className="tabular">{formatMoneyUah(costTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-secondary)]">Заробимо</dt>
                <dd className="tabular font-semibold text-[var(--color-success-text)]">
                  {formatMoneyUah(profitTotal)}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
        {activeDraft?.priceSource === "cost" ? (
          <p className="type-caption mt-2 text-[var(--color-warning-text)]">
            Зафіксуйте прайс у картці виробу («Прайс і крій»), щоб ціна відрізнялась від собівартості.
          </p>
        ) : null}
      </div>
      <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <h2 className="type-subsection mb-3">Структура собівартості</h2>
        <CostStructure
          calc={calc}
          fabricDeliveryAmount={fabricDeliveryAmount}
          fixedCostAmount={fixedCostAllocation?.fixedCostTotal ?? 0}
        />
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
  ) : null;

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Замовлення", href: "/orders" }, { label: order.number }]} />

      <OrderWorkspaceShell
        header={
          <OrderWorkspaceHeader
            title={order.number}
            badge={<OrderStatusBadge status={order.status} dot />}
            subtitle={
              <>
                {order.title && order.title !== item.nameUk ? (
                  <span>{order.title}</span>
                ) : (
                  <span>{item.nameUk}</span>
                )}
                {order.items.length > 1 ? (
                  <span className="text-[var(--color-text-tertiary)]">
                    {" "}
                    · {order.items.length} позиції
                  </span>
                ) : null}
              </>
            }
            meta={
              <p className="text-[13px] text-[var(--color-primary-700)]">
                <Link
                  href={`/clients/${order.clientId}`}
                  className="hover:underline"
                >
                  {order.client.companyName}
                </Link>
                {order.client.contactPerson ? ` · ${order.client.contactPerson}` : ""}
              </p>
            }
            actions={
              <>
                <QuickActions>
                  <QuickAction
                    icon={<IconClients size={15} />}
                    href={`/clients/${order.clientId}`}
                    hint="orderClientCard"
                  >
                    Клієнт
                  </QuickAction>
                  {action.quotationReady && accessHas(access, "generateQuotations") ? (
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
                {order.status === "DRAFT" && accessHas(access, "manageOrders") ? (
                  <SubmitForCalculationButton
                    orderId={order.id}
                    disabled={
                      !order.items.every(
                        (row) =>
                          row.totalQuantity > 0 &&
                          row.materials.length > 0 &&
                          row.operations.length > 0,
                      )
                    }
                    disabledReason="Заповніть кількості, матеріали та операції по всіх позиціях."
                  />
                ) : showHeaderCta && (canRunCalc || canApprove || action.key === "spec" || action.key === "closed") ? (
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
              </>
            }
          />
        }
        facts={<OrderFactsStrip facts={facts} />}
        pipeline={
          <OrderChevronPipeline
            status={order.status}
            nextTitle={`${action.index}/${action.of} · ${action.detail}`}
          />
        }
        footer={
          <p className="type-caption flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>
              <span className="text-[var(--color-text-tertiary)]">Коментар: </span>
              {order.comment?.trim() || "—"}
            </span>
            {!locked ? (
              <Link
                href={tabHref("configuration")}
                className="font-medium text-[var(--color-primary-700)] hover:underline"
              >
                Змінити
              </Link>
            ) : null}
          </p>
        }
      />

      <OrderItemsTable
        orderId={order.id}
        activeTab={activeTab}
        selectedId={item.id}
        locked={compositionLocked}
        handedOver={order.status === "HANDED_TO_PRODUCTION" || order.status === "CLOSED"}
        rows={itemRows}
        catalog={catalog}
        showPrices={canViewCosts}
      />

      <OrderWorkspacePanel
        tabs={
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="type-caption">Позиція</p>
              <p className="text-[14px] font-semibold tracking-[-0.01em]">
                {item.nameUk}
                <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">
                  {item.totalQuantity} шт
                  {item.comment ? ` · ${item.comment}` : ""}
                </span>
              </p>
            </div>
            <ViewTabs items={tabs} active={activeTab} className="border-b-0" />
          </div>
        }
      >
        {activeTab === "configuration" ? (
          <div className="space-y-3">
            {order.status === "DRAFT" && !canRunCalc ? (
              <Banner tone="info" title="Комплектація для менеджера">
                Зберіть склад і кількості, потім натисніть «На розрахунок адміну». Калькуляцію й ціни
                робить адміністратор.
              </Banner>
            ) : null}
            {order.status !== "DRAFT" && !canEditComposition ? (
              <Banner tone="info" title="На розрахунку в адміністратора">
                Комплектацію передано. Зміни складу та калькуляція доступні адміністратору.
              </Banner>
            ) : null}
            <ConfigurationTab
            orderId={order.id}
            itemId={item.id}
            locked={compositionLocked}
            hideCosts={!canViewCosts}
            canCreateCatalog={canCreateCatalog}
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
              composition: material.composition?.trim() || null,
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
            companySewerCount={fixedCosts?.companySewerCount ?? 0}
            sewerCountOverride={item.sewerCountOverride}
            fixedCostAllocation={fixedCostAllocation}
            fixedCostError={fixedCostError}
            canEditFixedCosts={canEditComposition && !locked}
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
                fixedCostAllocation={fixedCostAllocation}
                fixedCostError={fixedCostError}
                orderId={order.id}
                orderItemId={item.id}
                companySewerCount={fixedCosts?.companySewerCount ?? 0}
                sewerCountOverride={item.sewerCountOverride}
                canEditSewerCount={canEditComposition && !locked}
                sizeQuantities={item.sizes.map((size) => ({
                  sizeCode: size.sizeCode,
                  quantity: size.quantity,
                }))}
                pricingMethod={pricing.pricingMethod}
                targetRatePercent={pricing.targetRatePercent}
                minimumMarginPercent={pricing.minimumMarginPercent}
                isOrderOverride={pricing.isOrderOverride}
                hasCommercialPriceList={Boolean(activeDraft?.fromPriceList)}
                commercialSellingPricePerUnit={clientPricePerUnit}
                commercialTotalValue={clientTotal}
                commercialMarginPercent={marginPct}
                commercialProfitPerUnit={profitPerUnit}
                commercialProfitTotal={profitTotal}
                priceSource={activeDraft?.priceSource}
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
      </OrderWorkspacePanel>

      <ActivityTimeline
        events={mapActivityEvents(activityEvents)}
        title="Історія замовлення"
        empty="Подій ще немає — зʼявляться після збереження пропозицій і змін статусу"
      />
    </div>
  );
}

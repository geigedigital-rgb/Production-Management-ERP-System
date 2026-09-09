import Link from "next/link";
import {
  Table,
  TableCard,
  TableToolbar,
  TBody,
  TD,
  TFoot,
  TH,
  THead,
  TR,
  TableSectionHeader,
  TableSectionSubtotal,
} from "@/components/ui/Table";
import { Banner } from "@/components/ui/Banner";
import { formatMoneyUah } from "@/lib/utils";
import type { CalculationResult } from "@/server/domains/calculation/engine";
import type { DecorationRow, FabricDeliveryRow, MaterialRow, OperationRow } from "./ConfigurationTab";
import {
  isOversizeCode,
  oversizeMaterialPct,
  oversizeOperationPct,
  oversizeUpliftCaption,
  resolveSizeCoeffs,
} from "@/lib/size-coeffs";
import {
  FIXED_COST_LINE_NAME_UK,
  fixedCostValidationMessage,
  type FixedCostAllocation,
  type FixedCostValidationError,
} from "@/lib/fixed-costs";
import {
  OrderFixedCostError,
  OrderSewerCountControl,
} from "@/components/orders/OrderSewerCountControl";

/**
 * Line-item breakdown for the calculation tab.
 * Totals and cost structure live in the page rail — not duplicated here.
 */
export function CalculationTab({
  calc,
  totalQuantity,
  materials,
  operations,
  decorations,
  fabricDeliveryLines = [],
  fabricDeliveryAmount = 0,
  fixedCostAllocation = null,
  fixedCostError = null,
  orderId,
  orderItemId,
  companySewerCount,
  sewerCountOverride = null,
  canEditSewerCount = false,
  minimumMarginPercent,
  corridorHint,
  hasCommercialPriceList = false,
  commercialSellingPricePerUnit,
  commercialTotalValue,
  commercialMarginPercent,
  sizeQuantities = [],
}: {
  calc: CalculationResult;
  totalQuantity: number;
  materials: MaterialRow[];
  operations: OperationRow[];
  decorations: DecorationRow[];
  fabricDeliveryLines?: FabricDeliveryRow[];
  fabricDeliveryAmount?: number;
  fixedCostAllocation?: FixedCostAllocation | null;
  fixedCostError?: FixedCostValidationError | null;
  orderId: string;
  orderItemId: string;
  companySewerCount: number;
  sewerCountOverride?: number | null;
  canEditSewerCount?: boolean;
  pricingMethod?: "MARGIN" | "MARKUP";
  targetRatePercent?: number;
  minimumMarginPercent: number;
  isOrderOverride?: boolean;
  corridorHint?: { title: string; detail: string; href?: string; label?: string } | null;
  hasCommercialPriceList?: boolean;
  commercialSellingPricePerUnit?: number;
  commercialTotalValue?: number;
  commercialMarginPercent?: number;
  sizeQuantities?: Array<{ sizeCode: string; quantity: number }>;
}) {
  const perUnit = (value: number) => (totalQuantity > 0 ? value / totalQuantity : 0);
  const margin = Number(calc.marginPercent);
  const commercialMargin = commercialMarginPercent ?? margin;
  const belowMinimum = hasCommercialPriceList
    ? commercialMargin < minimumMarginPercent
    : margin < minimumMarginPercent;
  const oversizeRows = sizeQuantities
    .filter((row) => row.quantity > 0 && isOversizeCode(row.sizeCode))
    .map((row) => ({
      ...row,
      ...resolveSizeCoeffs(row.sizeCode),
    }));
  const fixedCostTotal = fixedCostAllocation?.fixedCostTotal ?? 0;
  const otherAdditionalCosts = Math.max(
    0,
    Number(calc.additionalCostsSubtotal) - fabricDeliveryAmount - fixedCostTotal,
  );
  const fabricDeliveryRows = fabricDeliveryLines.filter((row) => row.amount > 0);
  const materialsSubtotal = Number(calc.materialsSubtotal);
  const operationsSubtotal = Number(calc.operationsSubtotal);
  const decorationsSubtotal = Number(calc.decorationsSubtotal);

  function fabricDeliveryFormula(row: FabricDeliveryRow) {
    const kg = row.kgNeeded != null ? `${row.kgNeeded} кг` : "кг";
    const mode = row.manual ? " · вручну" : "";
    return `${kg} × $${row.cargoUsdPerKg}/кг × ${row.usdUahRate} ₴/$${mode}`;
  }

  return (
    <div className="space-y-4">
      {hasCommercialPriceList ? (
        <Banner tone="info" title="Два шари розрахунку">
          Комерційна ціна для клієнта — з фіксованого прайсу (+ брендування у пропозиції). Таблиця
          нижче — внутрішня собівартість для планування виробництва; вона не змінює ціну в КП.
        </Banner>
      ) : null}
      {corridorHint ? (
        <Banner
          tone="info"
          title={corridorHint.title}
          action={
            corridorHint.href ? (
              <Link href={corridorHint.href} className="btn-primary btn-primary-sm">
                {corridorHint.label ?? "Далі"}
              </Link>
            ) : null
          }
        >
          {corridorHint.detail}
        </Banner>
      ) : null}
      {fixedCostError ? (
        <Banner
          tone="danger"
          title="Постійні витрати не налаштовані"
          action={
            <Link href="/settings/fixed-costs" className="btn-primary btn-primary-sm">
              Довідник
            </Link>
          }
        >
          {fixedCostValidationMessage(fixedCostError)} Розрахунок / збереження пропозиції
          недоступні, доки параметри не виправлені.
        </Banner>
      ) : null}
      {belowMinimum ? (
        <Banner
          tone="danger"
          title={`Маржа ${commercialMargin.toFixed(1)}% нижче мінімуму ${minimumMarginPercent}%`}
        >
          Збереження пропозиції з такою ціною доступне лише адміністратору.
        </Banner>
      ) : null}

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Деталі статей</span>}
          right={
            <span className="type-caption tabular">
              на {totalQuantity} шт
              {hasCommercialPriceList ? " · ціна з прайсу виробу" : " · без прайсу (собівартість)"}
            </span>
          }
        />
        <Table>
          <THead>
            <TH>Стаття</TH>
            <TH>Як пораховано</TH>
            <TH align="right">За од.</TH>
            <TH align="right">Разом</TH>
          </THead>
          <TBody>
            {oversizeRows.length > 0 ? (
              <>
                <TableSectionHeader title="Розміри XXL+" first />
                {oversizeRows.map((row) => (
                  <TR key={row.sizeCode}>
                    <TD className="font-medium text-[var(--color-text-primary)]">
                      {row.sizeCode}
                    </TD>
                    <TD className="type-caption">
                      матеріали ×{row.materialCoeff.toFixed(2)} · операції ×
                      {row.operationCoeff.toFixed(2)} (+{oversizeMaterialPct()}% / +
                      {oversizeOperationPct()}% до спільної норми)
                    </TD>
                    <TD numeric className="text-[var(--color-text-secondary)]">
                      —
                    </TD>
                    <TD numeric>{row.quantity} шт</TD>
                  </TR>
                ))}
                <TableSectionSubtotal
                  label="Разом oversized"
                  perUnit="—"
                  total={`${oversizeRows.reduce((sum, row) => sum + row.quantity, 0)} шт`}
                />
              </>
            ) : null}

            <TableSectionHeader title="Матеріали" first={oversizeRows.length === 0} />
            {oversizeRows.length > 0 ? (
              <TR muted>
                <TD colSpan={4} className="type-caption">
                  У сумах нижче вже враховано {oversizeUpliftCaption()} на частку тиражу XXL+.
                </TD>
              </TR>
            ) : null}
            {materials.length === 0 ? (
              <TR muted>
                <TD colSpan={4}>Матеріалів немає</TD>
              </TR>
            ) : (
              materials.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium text-[var(--color-text-primary)]">
                    {row.name}
                    {row.sizeCode ? (
                      <span className="type-caption ml-1.5">{row.sizeCode}</span>
                    ) : null}
                  </TD>
                  <TD className="type-caption">
                    {row.consumption} {row.unit} × (1 + {row.waste}%) × {formatMoneyUah(row.price)}
                    {row.sizeCode ? ` · ${row.sizeCode}` : ""}
                    {oversizeRows.length > 0 && !row.sizeCode
                      ? ` · для XXL+ ще ×${(1 + oversizeMaterialPct() / 100).toFixed(2)}`
                      : ""}
                  </TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {formatMoneyUah(row.unitCost)}
                  </TD>
                  <TD numeric>{formatMoneyUah(row.totalCost)}</TD>
                </TR>
              ))
            )}
            {materials.length > 0 ? (
              <TableSectionSubtotal
                label="Разом матеріали"
                perUnit={formatMoneyUah(perUnit(materialsSubtotal))}
                total={formatMoneyUah(materialsSubtotal)}
              />
            ) : null}

            <TableSectionHeader title="Операції" />
            {oversizeRows.length > 0 ? (
              <TR muted>
                <TD colSpan={4} className="type-caption">
                  Для XXL+ ставка операцій ×{(1 + oversizeOperationPct() / 100).toFixed(2)} вже в
                  підсумку.
                </TD>
              </TR>
            ) : null}
            {operations.length === 0 ? (
              <TR muted>
                <TD colSpan={4}>Операцій немає</TD>
              </TR>
            ) : (
              operations.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">{row.name}</TD>
                  <TD className="type-caption">
                    {formatMoneyUah(row.unitCost)} × {totalQuantity} шт
                  </TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {formatMoneyUah(row.unitCost)}
                  </TD>
                  <TD numeric>{formatMoneyUah(row.totalCost)}</TD>
                </TR>
              ))
            )}
            {operations.length > 0 ? (
              <TableSectionSubtotal
                label="Разом операції"
                perUnit={formatMoneyUah(perUnit(operationsSubtotal))}
                total={formatMoneyUah(operationsSubtotal)}
              />
            ) : null}

            <TableSectionHeader title={FIXED_COST_LINE_NAME_UK} />
            <TR muted>
              <TD colSpan={4} className="py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <OrderSewerCountControl
                    orderId={orderId}
                    orderItemId={orderItemId}
                    companySewerCount={companySewerCount}
                    sewerCountOverride={sewerCountOverride}
                    locked={!canEditSewerCount}
                  />
                  <OrderFixedCostError error={fixedCostError} />
                </div>
              </TD>
            </TR>
            {fixedCostAllocation && fixedCostAllocation.fixedCostTotal > 0 ? (
              <>
                {fixedCostAllocation.bySize.length > 1 ? (
                  fixedCostAllocation.bySize.map((row) => (
                    <TR key={`pv-${row.sizeCode}`}>
                      <TD className="font-medium">{FIXED_COST_LINE_NAME_UK}</TD>
                      <TD className="text-[var(--color-text-secondary)]">
                        Коеф. {fixedCostAllocation.metrics.coefficient.toFixed(1)}
                        <span className="type-caption ml-1.5">{row.sizeCode}</span>
                      </TD>
                      <TD numeric className="text-[var(--color-text-secondary)]">
                        {formatMoneyUah(row.fixedCostPerUnit)}
                      </TD>
                      <TD numeric>{formatMoneyUah(row.fixedCostTotal)}</TD>
                    </TR>
                  ))
                ) : (
                  <TR>
                    <TD className="font-medium">{FIXED_COST_LINE_NAME_UK}</TD>
                    <TD className="text-[var(--color-text-secondary)]">
                      Коеф. {fixedCostAllocation.metrics.coefficient.toFixed(1)}
                    </TD>
                    <TD numeric className="text-[var(--color-text-secondary)]">
                      {formatMoneyUah(fixedCostAllocation.fixedCostPerUnit)}
                    </TD>
                    <TD numeric>{formatMoneyUah(fixedCostAllocation.fixedCostTotal)}</TD>
                  </TR>
                )}
                <TableSectionSubtotal
                  label="Разом постійні витрати"
                  perUnit={formatMoneyUah(fixedCostAllocation.fixedCostPerUnit)}
                  total={formatMoneyUah(fixedCostAllocation.fixedCostTotal)}
                />
              </>
            ) : !fixedCostError ? (
              <TR muted>
                <TD colSpan={4} className="type-caption">
                  Немає «Пошив» — ПВ = 0.
                </TD>
              </TR>
            ) : null}

            {decorations.length > 0 ? (
              <>
                <TableSectionHeader title="Нанесення" />
                {decorations.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium">{row.name}</TD>
                    <TD className="type-caption">
                      приладка {formatMoneyUah(row.setupCost)} + {formatMoneyUah(row.unitRate)} ×{" "}
                      {totalQuantity}
                    </TD>
                    <TD numeric className="text-[var(--color-text-secondary)]">
                      {formatMoneyUah(perUnit(row.totalCost))}
                    </TD>
                    <TD numeric>{formatMoneyUah(row.totalCost)}</TD>
                  </TR>
                ))}
                <TableSectionSubtotal
                  label="Разом нанесення"
                  perUnit={formatMoneyUah(perUnit(decorationsSubtotal))}
                  total={formatMoneyUah(decorationsSubtotal)}
                />
              </>
            ) : null}

            {fabricDeliveryRows.length > 0 ? (
              <>
                <TableSectionHeader title="Доставка" />
                {fabricDeliveryRows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium text-[var(--color-text-primary)]">
                      {row.name}
                      {row.sizeCode ? (
                        <span className="type-caption ml-1.5">{row.sizeCode}</span>
                      ) : null}
                    </TD>
                    <TD className="type-caption">{fabricDeliveryFormula(row)}</TD>
                    <TD numeric className="text-[var(--color-text-secondary)]">
                      {formatMoneyUah(perUnit(row.amount))}
                    </TD>
                    <TD numeric>{formatMoneyUah(row.amount)}</TD>
                  </TR>
                ))}
                <TableSectionSubtotal
                  label="Разом доставка тканини"
                  perUnit={formatMoneyUah(perUnit(fabricDeliveryAmount))}
                  total={formatMoneyUah(fabricDeliveryAmount)}
                />
              </>
            ) : null}

            {otherAdditionalCosts > 0 ? (
              <>
                <TableSectionHeader title="Інші витрати" />
                <TR>
                  <TD className="font-medium">Додаткові статті</TD>
                  <TD className="type-caption">Загальновиробничі витрати замовлення</TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {formatMoneyUah(perUnit(otherAdditionalCosts))}
                  </TD>
                  <TD numeric>{formatMoneyUah(otherAdditionalCosts)}</TD>
                </TR>
                <TableSectionSubtotal
                  label="Разом інші витрати"
                  perUnit={formatMoneyUah(perUnit(otherAdditionalCosts))}
                  total={formatMoneyUah(otherAdditionalCosts)}
                />
              </>
            ) : null}
          </TBody>
          <TFoot>
            <tr>
              <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                Собівартість
              </TD>
              <TD numeric className="text-[var(--color-text-secondary)]">
                {formatMoneyUah(Number(calc.costPerUnit))}
              </TD>
              <TD numeric>{formatMoneyUah(Number(calc.totalCost))}</TD>
            </tr>
            <tr className="border-t border-[var(--color-divider)]">
              <TD colSpan={2}>
                {hasCommercialPriceList && commercialSellingPricePerUnit != null ? (
                  <>
                    Комерційна ціна для клієнта
                    <span className="type-caption ml-1.5">маржа {commercialMargin.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    Ціна продажу (розрахункова)
                    <span className="type-caption ml-1.5">маржа {margin.toFixed(1)}%</span>
                  </>
                )}
              </TD>
              <TD numeric className="font-semibold">
                {formatMoneyUah(
                  hasCommercialPriceList && commercialSellingPricePerUnit != null
                    ? commercialSellingPricePerUnit
                    : Number(calc.sellingPricePerUnit),
                )}
              </TD>
              <TD numeric className="font-semibold">
                {formatMoneyUah(
                  hasCommercialPriceList && commercialTotalValue != null
                    ? commercialTotalValue
                    : Number(calc.totalSellingValue),
                )}
              </TD>
            </tr>
          </TFoot>
        </Table>
      </TableCard>
    </div>
  );
}

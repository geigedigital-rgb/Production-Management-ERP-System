import { cn, formatMoneyUah } from "@/lib/utils";
import type { CalculationResult } from "@/server/domains/calculation/engine";
import { Banner } from "@/components/ui/Banner";

const baseSegments = [
  { key: "materialsSubtotal", label: "Матеріали", color: "var(--color-primary-600)" },
  { key: "operationsSubtotal", label: "Операції", color: "var(--color-primary-400)" },
  { key: "decorationsSubtotal", label: "Нанесення", color: "var(--color-primary-200)" },
] as const;

/** Cost structure bar — shows where the cost actually comes from at a glance. */
export function CostStructure({
  calc,
  fabricDeliveryAmount = 0,
  fixedCostAmount = 0,
}: {
  calc: CalculationResult;
  fabricDeliveryAmount?: number;
  fixedCostAmount?: number;
}) {
  const total = Number(calc.totalCost) || 1;
  const otherAdditional = Math.max(
    0,
    Number(calc.additionalCostsSubtotal) - fabricDeliveryAmount - fixedCostAmount,
  );
  const rows = [
    ...baseSegments
      .map((segment) => ({
        ...segment,
        value: Number(calc[segment.key]),
        share: (Number(calc[segment.key]) / total) * 100,
      }))
      .filter((row) => row.value > 0),
    ...(fixedCostAmount > 0
      ? [
          {
            key: "fixedCosts",
            label: "Постійні витрати",
            color: "var(--color-warning-text)",
            value: fixedCostAmount,
            share: (fixedCostAmount / total) * 100,
          },
        ]
      : []),
    ...(fabricDeliveryAmount > 0
      ? [
          {
            key: "fabricDelivery",
            label: "Доставка",
            color: "var(--color-primary-100)",
            value: fabricDeliveryAmount,
            share: (fabricDeliveryAmount / total) * 100,
          },
        ]
      : []),
    ...(otherAdditional > 0
      ? [
          {
            key: "otherAdditional",
            label: "Інші витрати",
            color: "var(--color-border-strong)",
            value: otherAdditional,
            share: (otherAdditional / total) * 100,
          },
        ]
      : []),
  ];

  if (rows.length === 0) {
    return <p className="type-caption">Дані для структури собівартості ще відсутні.</p>;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
        {rows.map((row) => (
          <span
            key={row.key}
            style={{ width: `${row.share}%`, background: row.color }}
            title={`${row.label}: ${row.share.toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-[13px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: row.color }} />
            <span className="flex-1 text-[var(--color-text-secondary)]">{row.label}</span>
            <span className="tabular text-[var(--color-text-tertiary)]">{row.share.toFixed(0)}%</span>
            <span className="tabular w-24 text-right text-[var(--color-text-primary)]">
              {formatMoneyUah(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compact summary card: one hero price, margin, structure — no duplicated banners.
 */
export function CostSummary({
  calc,
  quantity,
  title = "Підсумок",
  subtitle,
  footer,
  className,
}: {
  calc: CalculationResult;
  quantity: number;
  /** @deprecated No longer used for warnings. */
  minimumMarginPercent?: number;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const margin = Number(calc.marginPercent);
  const empty = Number(calc.totalCost) === 0;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="type-subsection">{title}</h2>
        {subtitle ? <p className="type-caption mt-0.5">{subtitle}</p> : null}
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="type-caption">Ціна / од.</p>
          <p className="type-total mt-0.5">{formatMoneyUah(Number(calc.sellingPricePerUnit))}</p>
          <p className="type-caption mt-1">
            собівартість {formatMoneyUah(Number(calc.costPerUnit))}
            {quantity > 1 ? ` · ${quantity} шт` : " / од."}
          </p>
          {quantity > 1 ? (
            <p className="type-caption mt-1 text-[var(--color-text-tertiary)]">
              Разом собівартість {formatMoneyUah(Number(calc.totalCost))}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-y border-[var(--color-divider)] py-2.5">
          <span className="text-[13px] text-[var(--color-text-secondary)]">Маржа</span>
          <span className="tabular text-[13.5px] font-semibold text-[var(--color-success-text)]">
            {margin.toFixed(1)}%
          </span>
        </div>

        {empty ? (
          <Banner tone="warning" title="Комплектація порожня">
            Додайте матеріали та операції.
          </Banner>
        ) : (
          <CostStructure calc={calc} />
        )}

        <dl className="space-y-2 border-t border-[var(--color-divider)] pt-3 text-[13px]">
          {quantity > 1 ? (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-secondary)]">Разом продаж</dt>
                <dd className="tabular font-semibold">{formatMoneyUah(Number(calc.totalSellingValue))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-secondary)]">Прибуток</dt>
                <dd className="tabular text-[var(--color-success-text)]">
                  {formatMoneyUah(Number(calc.profitAmount))}
                </dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-secondary)]">Прибуток / од.</dt>
              <dd className="tabular text-[var(--color-success-text)]">
                {formatMoneyUah(Number(calc.profitAmount))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {footer ? (
        <div className="border-t border-[var(--color-border)] px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}

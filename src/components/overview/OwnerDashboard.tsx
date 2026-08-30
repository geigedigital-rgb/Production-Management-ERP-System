import Link from "next/link";
import {
  IconAlert,
  IconCalc,
  IconCheck,
  IconClock,
  IconInfo,
  IconOrders,
  IconPricing,
} from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { hintFor } from "@/lib/ui-hints";
import { formatCompactUah } from "@/app/(app)/overview/dashboard-model";
import { ordersWord, type OwnerDashboardData } from "@/server/domains/overview/dashboard";
import { dashboardQuery } from "@/app/(app)/overview/dashboard-model";
import { OwnerDecisions } from "@/components/overview/OwnerDecisions";

function moneyParts(value: number) {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(value);
}

function KpiMoney({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="text-[28px] leading-[34px] font-[650] tracking-[-0.02em] text-[#17212B]">
        —
      </span>
    );
  }
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="tabular text-[28px] leading-[34px] font-[650] tracking-[-0.02em] text-[#17212B]">
        {moneyParts(value)}
      </span>
      <span className="text-[14px] leading-5 font-medium text-[#66717D]">₴</span>
    </span>
  );
}

function StageDays({ days }: { days: number | null }) {
  if (days == null) return <span>—</span>;
  if (days < 1) return <span>{"< 1 дн."}</span>;
  return <span>{days.toFixed(1).replace(".", ",")} дн.</span>;
}

function changeTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" }).format(date);
}

function withOrdersHash(href: string) {
  return `${href}#orders`;
}

export function OwnerDashboard({
  data,
  focus,
}: {
  data: OwnerDashboardData;
  focus: string;
}) {
  const { range, managerId, kpis, pricing } = data;
  const q = (nextFocus: string) =>
    dashboardQuery({ range, managerId, focus: nextFocus });

  const kpisRow = [
    {
      key: "portfolio",
      label: "Активний портфель",
      hint: "dashPortfolio" as const,
      href: withOrdersHash(q("all")),
      value: kpis.orderCount === 0 && kpis.portfolio === 0 ? null : kpis.portfolio,
      isMoney: true,
      secondary:
        kpis.orderCount === 0
          ? "Немає активних замовлень"
          : `${kpis.orderCount} ${ordersWord(kpis.orderCount)}`,
      icon: IconOrders,
      danger: false,
      selected: focus === "all" || focus === "",
    },
    {
      key: "profit",
      label: "Очікуваний валовий прибуток",
      hint: "dashProfit" as const,
      href: withOrdersHash(q("all")),
      value: kpis.profitShare == null ? null : kpis.profit,
      isMoney: true,
      secondary:
        kpis.profitShare == null
          ? "Немає погодженої калькуляції"
          : `${(kpis.profitShare * 100).toFixed(1).replace(".", ",")} % портфеля`,
      icon: IconPricing,
      danger: false,
      selected: false,
    },
    {
      key: "margin",
      label: "Середня маржа",
      hint: "dashMargin" as const,
      href: withOrdersHash(q("all")),
      value: kpis.avgMargin,
      isMoney: false,
      secondary: `ціль ${pricing.targetRatePercent}% · мінімум ${pricing.minimumMarginPercent}%`,
      icon: IconCalc,
      danger:
        kpis.avgMargin != null && kpis.avgMargin < pricing.minimumMarginPercent,
      selected: false,
    },
    {
      key: "risk",
      label: "Сума під ризиком",
      hint: "dashAtRisk" as const,
      href: withOrdersHash(q("risk")),
      value: kpis.atRiskCount === 0 && kpis.atRisk === 0 ? 0 : kpis.atRisk,
      isMoney: true,
      secondary:
        kpis.atRiskCount === 0
          ? "Ризикових замовлень немає"
          : `${kpis.atRiskCount} ${ordersWord(kpis.atRiskCount)} потребують дії`,
      icon: IconAlert,
      danger: kpis.atRiskCount > 0,
      selected: focus === "risk",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-[#E1E6E3] bg-white shadow-[0_1px_2px_rgba(18,32,25,0.04)] xl:grid-cols-4 xl:h-[104px]">
        {kpisRow.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "relative flex min-h-[104px] items-center gap-3 px-[22px] py-[18px] transition-colors duration-150 ease-out",
                "hover:bg-[#FAFBFA] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#69A98A]",
                item.selected && "bg-[#FAFBFA]",
              )}
            >
              {index < 3 ? (
                <span className="absolute top-1/2 right-0 hidden h-16 w-px -translate-y-1/2 bg-[#E5E9E7] xl:block" />
              ) : null}
              {(index === 0 || index === 2) && (
                <span className="absolute top-1/2 right-0 h-16 w-px -translate-y-1/2 bg-[#E5E9E7] xl:hidden" />
              )}
              {index < 2 ? (
                <span className="absolute right-[22px] bottom-0 left-[22px] h-px bg-[#E5E9E7] xl:hidden" />
              ) : null}
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-[10px]",
                  item.danger ? "bg-[#FFF0EE] text-[#C84236]" : "bg-[#EEF6F1] text-[#176A4B]",
                )}
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[13px] leading-[18px] font-medium text-[#17212B]">
                    {item.label}
                  </span>
                  <span
                    className="text-[#66717D]"
                    title={hintFor(item.hint).description}
                    aria-hidden
                  >
                    <IconInfo size={14} />
                  </span>
                </span>
                <span className="block">
                  {item.isMoney ? (
                    <KpiMoney value={item.value} />
                  ) : item.value == null ? (
                    <span className="text-[28px] leading-[34px] font-[650] text-[#17212B]">—</span>
                  ) : (
                    <span className="tabular text-[28px] leading-[34px] font-[650] tracking-[-0.02em] text-[#17212B]">
                      {item.value.toFixed(1).replace(".", ",")}
                      <span className="ml-0.5 text-[14px] leading-5 font-medium text-[#66717D]">%</span>
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "block truncate text-[12px] leading-4",
                    item.danger ? "text-[#C84236]" : "text-[#66717D]",
                  )}
                >
                  {item.secondary}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[7fr_5fr] min-[1440px]:grid-cols-[8fr_4fr]">
        <section className="flex h-[236px] flex-col overflow-hidden rounded-[12px] border border-[#E1E6E3] bg-white p-5 shadow-[0_1px_2px_rgba(18,32,25,0.04)]">
          <h2 className="shrink-0 text-[18px] leading-6 font-semibold tracking-[-0.01em] text-[#17212B]">
            Портфель і швидкість проходження
          </h2>
          <div className="mt-4 flex min-h-0 flex-1 overflow-x-auto min-[1440px]:overflow-visible">
            {data.stages.map((stage, index) => {
              const selected = focus === stage.key;
              const fill =
                stage.delayed && !selected
                  ? "#D99A42"
                  : stage.key === "CLOSED"
                    ? "#AAB5B0"
                    : selected
                      ? "#277955"
                      : "#4D9872";
              return (
                <Link
                  key={stage.key}
                  href={withOrdersHash(q(selected ? "all" : stage.key))}
                  title="Фільтрує таблицю замовлень нижче"
                  className={cn(
                    "relative flex min-w-[128px] flex-1 flex-col px-3.5 py-1 transition-colors duration-150 ease-out",
                    "hover:bg-[#FAFBFA] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#69A98A]",
                    selected && "bg-[#EEF6F1] text-[#176A4B]",
                    stage.delayed && !selected && "bg-[#FFF8ED]",
                  )}
                >
                  {index < data.stages.length - 1 ? (
                    <span className="absolute top-1/2 right-0 h-[132px] w-px -translate-y-1/2 bg-[#E7EBE9]" />
                  ) : null}
                  <span
                    className={cn(
                      "text-[13px] leading-[18px] font-medium",
                      selected ? "text-[#176A4B]" : "text-[#17212B]",
                    )}
                  >
                    {stage.label}
                  </span>
                  <span className="mt-1.5 tabular text-[24px] leading-[30px] font-[650] tracking-[-0.02em]">
                    {stage.count}
                  </span>
                  <span className="mt-1.5 truncate text-[13px] leading-[18px] text-[#66717D]">
                    {stage.amount > 0 ? formatCompactUah(stage.amount) : "—"}
                  </span>
                  <span
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-[3px] bg-[#EDF1EF]"
                    aria-hidden
                  >
                    <span
                      className="block h-1.5 rounded-[3px] transition-[width] duration-[240ms] ease-out motion-reduce:transition-none"
                      style={{
                        width: `${Math.round(stage.share * 100)}%`,
                        minWidth: stage.share > 0 ? 8 : 0,
                        background: fill,
                      }}
                    />
                  </span>
                  <span
                    className="mt-2 cursor-help text-[12px] leading-4 text-[#66717D]"
                    title={hintFor("dashStageDays").description}
                  >
                    <StageDays days={stage.avgDays} />
                  </span>
                  {stage.delayLabel ? (
                    <span className="mt-1 text-[12px] leading-4 font-medium text-[#B87516]">
                      {stage.delayLabel}
                    </span>
                  ) : (
                    <span className="mt-1 h-4" />
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        <OwnerDecisions decisions={data.decisions} />
      </div>
    </>
  );
}

export function DashboardLowerBlocks({ data }: { data: OwnerDashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="rounded-[12px] border border-[#E1E6E3] bg-white p-[18px] shadow-[0_1px_2px_rgba(18,32,25,0.04)]">
        <h2 className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-[#17212B]">
          Ризики калькуляцій
        </h2>
        <ul className="mt-4">
          {data.risks.map((row) => (
            <li key={row.key} className="border-t border-[#E7EBE9] first:border-t-0">
              <Link
                href={row.href}
                className="flex h-12 items-center gap-3 transition-colors duration-150 ease-out hover:bg-[#FAFBFA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69A98A]"
              >
                <span
                  className={cn(
                    "w-9 shrink-0 text-right tabular text-[14px] leading-5 font-semibold",
                    row.count > 0 ? "text-[#17212B]" : "text-[#66717D]",
                  )}
                >
                  {row.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-5 text-[#17212B]">
                    {row.label}
                  </span>
                  <span className="block truncate text-[12px] leading-4 text-[#66717D]">
                    {row.hint}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/settings/resources"
          className="mt-1 flex h-10 items-center text-[13px] font-semibold text-[#176A4B] transition-colors duration-150 hover:text-[#12583E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69A98A]"
        >
          Перевірити довідники
        </Link>
      </section>

      <section className="rounded-[12px] border border-[#E1E6E3] bg-white p-[18px] shadow-[0_1px_2px_rgba(18,32,25,0.04)]">
        <h2 className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-[#17212B]">
          Готовність до виробництва
        </h2>
        {data.readiness.length === 0 ? (
          <p className="mt-4 text-[13px] leading-[18px] text-[#66717D]">
            Немає погоджених замовлень, які чекають передачі в цех.
          </p>
        ) : (
          <ul className="mt-4">
            {data.readiness.map((row) => {
              const tone =
                row.percent >= 100 ? "success" : row.percent >= 60 ? "warning" : "danger";
              return (
                <li key={row.orderId} className="border-t border-[#E7EBE9] first:border-t-0">
                  <div className="flex h-12 items-center gap-2">
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center",
                        tone === "success" && "text-[#2F805B]",
                        tone === "warning" && "text-[#B87516]",
                        tone === "danger" && "text-[#C84236]",
                      )}
                    >
                      {tone === "success" ? <IconCheck size={16} /> : <IconAlert size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] leading-5 font-medium text-[#17212B]">
                          {row.number}
                        </span>
                        <span
                          className="h-1.5 w-[72px] shrink-0 overflow-hidden rounded-[3px] bg-[#EDF1EF]"
                          aria-hidden
                        >
                          <span
                            className="block h-1.5 rounded-[3px] transition-[width] duration-[240ms] ease-out motion-reduce:transition-none"
                            style={{
                              width: `${row.percent}%`,
                              minWidth: row.percent > 0 ? 8 : 0,
                              background:
                                tone === "success"
                                  ? "#277955"
                                  : tone === "warning"
                                    ? "#D99A42"
                                    : "#C84236",
                            }}
                          />
                        </span>
                      </span>
                      <span className="block truncate text-[12px] leading-4 text-[#66717D]">
                        {row.missing}
                      </span>
                    </span>
                    <Link
                      href={row.href}
                      className="inline-flex h-[30px] min-w-[86px] shrink-0 items-center justify-center rounded-[8px] border border-[#E1E6E3] px-2.5 text-[13px] font-semibold text-[#17212B] transition-colors duration-150 ease-out hover:bg-[#FAFBFA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69A98A]"
                    >
                      {row.actionLabel}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[12px] border border-[#E1E6E3] bg-white p-[18px] shadow-[0_1px_2px_rgba(18,32,25,0.04)]">
        <h2 className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-[#17212B]">
          Критичні зміни
        </h2>
        {data.changes.length === 0 ? (
          <p className="mt-4 text-[13px] leading-[18px] text-[#66717D]">
            За обраний період критичних змін немає.
          </p>
        ) : (
          <ul className="mt-4">
            {data.changes.map((row) => {
              const body = (
                <>
                  <span className="grid size-4 shrink-0 place-items-center text-[#66717D]">
                    <IconClock size={16} />
                  </span>
                  <span className="w-[52px] shrink-0 tabular text-[12px] leading-4 text-[#66717D]">
                    {changeTime(row.at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-[#17212B]">
                    {row.text}
                  </span>
                </>
              );
              return (
                <li key={row.id} className="border-t border-[#E7EBE9] first:border-t-0">
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="flex h-10 items-center gap-2 transition-colors duration-150 ease-out hover:bg-[#FAFBFA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69A98A]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex h-10 items-center gap-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function DashboardHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1
          className="text-[32px] leading-[38px] tracking-[-0.02em] text-[#17212B]"
          style={{ fontWeight: 650 }}
        >
          Центр управління
        </h1>
        <p className="text-[14px] leading-5 text-[#66717D]">
          Прибутковість, ризики та готовність активних замовлень
        </p>
      </div>
      {children}
    </div>
  );
}

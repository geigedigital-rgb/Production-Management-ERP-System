"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  updateProductCommercialPricesAction,
  updateProductCutRatesAction,
  updateProductOperationRateTiersAction,
} from "@/server/domains/products/actions";
import {
  hintForQty,
  hydrateCommercialPriceTiers,
  type TirageCostHint,
} from "@/components/products/ProductPriceFields";
import { resolveCutRatePerUnit, resolveOptimalCutQty } from "@/lib/cut-rate";
import { resolveCommercialPricePerUnit } from "@/lib/commercial-price";
import { resolveQuantityTierRate } from "@/lib/quantity-tiers";
import { defaultSewingMultiplierForQty, suggestSellingFromSewingMarkup } from "@/lib/sewing-markup";
import {
  buildTirageFormulaTips,
  buildTirageHeaderTips,
} from "@/lib/tirage-formula-tips";
import { cn, formatAmount, formatMoneyUah } from "@/lib/utils";

type Row = {
  minQuantity: number;
  cutRate: number;
  deliveryRate: number;
  pricePerUnit: number;
  sewingMultiplier: number;
  showOnCard: boolean;
};

type DeliveryOp = {
  productOperationId: string;
  name: string;
  tiers: Array<{ minQuantity: number; ratePerUnit: number }>;
};

type Baseline = {
  rows: Row[];
  optimalQty: number;
  optimalCutTotal: number;
  isBaseModel: boolean;
};

/** Digit inputs — width comes from the column / className. */
const DIGIT_INPUT =
  "h-7 min-w-0 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-right text-[12.5px] tabular-nums text-[var(--color-text)] " +
  "focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color-mix(in_srgb,var(--color-text-secondary)_18%,transparent)] " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function CompactInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={[DIGIT_INPUT, className ?? ""].join(" ")} />;
}

/** Dense table cell — no ₴ (unit shown once in the table caption). */
function MoneyCell({
  value,
  tone,
  tip,
}: {
  value: number;
  tone?: "quiet" | "strong";
  tip?: string;
}) {
  const color =
    tone === "strong"
      ? "font-medium text-[var(--color-text)]"
      : "text-[var(--color-text-secondary)]";
  const body = (
    <span className={`type-mono text-[12px] tabular-nums ${color}`}>
      {Number.isFinite(value) ? formatAmount(value) : "—"}
    </span>
  );
  return tip ? <FormulaTip tip={tip}>{body}</FormulaTip> : body;
}

/** Hover tip: CSS for cells; fixed portal for headers so overflow-x does not clip. */
function FormulaTip({
  tip,
  children,
  className,
  placement = "above",
}: {
  tip: string;
  children: ReactNode;
  className?: string;
  placement?: "above" | "below";
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      top: placement === "below" ? r.bottom + 6 : r.top - 6,
      left: r.left + r.width / 2,
    });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <span
      ref={anchorRef}
      className={cn("relative inline-flex max-w-full cursor-help", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && coords
        ? createPortal(
            <span
              role="tooltip"
              className={
                "pointer-events-none fixed z-[100] w-max max-w-[20rem] -translate-x-1/2 " +
                (placement === "above" ? "-translate-y-full " : "") +
                "rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-left " +
                "text-[11px] leading-snug font-normal normal-case tracking-normal whitespace-pre-line " +
                "text-[var(--color-text-secondary)] shadow-[var(--shadow-soft)]"
              }
              style={{ top: coords.top, left: coords.left }}
            >
              {tip}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function HeaderTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <FormulaTip tip={tip} placement="below">
      <span className="border-b border-dotted border-[var(--color-text-quiet)]/55">{children}</span>
    </FormulaTip>
  );
}

const thClass = "px-2 py-2 type-caption font-medium text-[var(--color-text-quiet)]";
const tdClass = "px-2 py-1.5 align-middle";
const tdNum = `${tdClass} whitespace-nowrap text-right`;

const LEAVE_MESSAGE =
  "Є незбережені зміни в «Прайс і крій». Зберегти їх чи вийти без змін?";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cloneRows(rows: Row[]): Row[] {
  return rows.map((row) => ({ ...row }));
}

function rowsEqual(a: Row[], b: Row[]) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => {
    const other = b[index];
    if (!other) return false;
    return (
      row.minQuantity === other.minQuantity &&
      row.cutRate === other.cutRate &&
      row.deliveryRate === other.deliveryRate &&
      row.pricePerUnit === other.pricePerUnit &&
      row.sewingMultiplier === other.sewingMultiplier &&
      row.showOnCard === other.showOnCard
    );
  });
}

function cutRateFromOptimalTotal(optimalTotal: number, qty: number): number {
  if (!(qty > 0) || !(optimalTotal >= 0) || !Number.isFinite(optimalTotal)) return 0;
  return Math.round((optimalTotal / qty) * 100) / 100;
}

function ensureOptimalRow(rows: Row[], optimalQty: number, cutRate: number): Row[] {
  if (!(optimalQty > 0)) return rows;
  const idx = rows.findIndex((row) => row.minQuantity === optimalQty);
  if (idx >= 0) {
    const next = [...rows];
    next[idx] = { ...next[idx]!, cutRate };
    return next.sort((a, b) => a.minQuantity - b.minQuantity);
  }
  const last = rows[rows.length - 1];
  return [
    ...rows,
    {
      minQuantity: optimalQty,
      cutRate,
      deliveryRate: last?.deliveryRate ?? 0,
      pricePerUnit: last?.pricePerUnit ?? 0,
      sewingMultiplier: last?.sewingMultiplier ?? defaultSewingMultiplierForQty(optimalQty),
      showOnCard: false,
    },
  ].sort((a, b) => a.minQuantity - b.minQuantity);
}

/** Розкладає крій по всіх сходинках від вартості оптимуму: ₴/шт = вартість_оптимуму ÷ тираж_сходинки. */
function spreadCutFromOptimal(rows: Row[], optimalTotal: number): Row[] {
  return rows.map((row) => ({
    ...row,
    cutRate: cutRateFromOptimalTotal(optimalTotal, row.minQuantity),
  }));
}

/** Mutually exclusive tirage totals. Собів = мат + крій + пошив + достав + інші + ПВ. */
function liveTirageSheet(args: {
  hint: TirageCostHint | null;
  qty: number;
  cutRate: number;
  deliveryRate: number;
}) {
  const qty = args.qty > 0 ? args.qty : 0;
  const materials = roundMoney((args.hint?.materialsPerUnit ?? 0) * qty);
  const sewing = roundMoney((args.hint?.sewingPerUnit ?? 0) * qty);
  const other = roundMoney((args.hint?.otherOpsPerUnit ?? 0) * qty);
  const pv = roundMoney((args.hint?.additionalPerUnit ?? 0) * qty);
  const cut = roundMoney(args.cutRate * qty);
  const delivery = roundMoney(args.deliveryRate * qty);
  const cost = roundMoney(materials + cut + sewing + delivery + other + pv);
  return { materials, sewing, other, pv, cut, delivery, cost };
}

export function ProductPriceCutPanel({
  productId,
  optimalQty: initialOptimalQty,
  cutTiers,
  deliveryOp = null,
  isBaseModel: initialIsBaseModel,
  priceTiers,
  costHints = [],
  onDirtyChange,
}: {
  productId: string;
  optimalQty: number | null;
  cutTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  deliveryOp?: DeliveryOp | null;
  isBaseModel: boolean;
  priceTiers: Array<{ minQuantity: number; pricePerUnit: number; showOnCard?: boolean }>;
  costHints?: TirageCostHint[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const hasDelivery = Boolean(deliveryOp);
  const deliveryTiers = deliveryOp?.tiers ?? [];
  const dirtyRef = useRef(false);
  const pendingHrefRef = useRef<string | null>(null);
  const headerTips = useMemo(() => {
    const sample = costHints.find((h) => (h.otherLineNames?.length ?? 0) > 0) ?? costHints[0];
    return buildTirageHeaderTips({
      otherLineNames: sample?.otherLineNames,
      otherHasExtraAdditional: sample?.otherHasExtraAdditional,
    });
  }, [costHints]);

  const initialMerged = useMemo(() => {
    const qtySet = new Set<number>();
    for (const t of cutTiers) qtySet.add(t.minQuantity);
    for (const t of priceTiers) qtySet.add(t.minQuantity);
    for (const t of deliveryTiers) qtySet.add(t.minQuantity);
    const qtys = [...qtySet].sort((a, b) => a - b);
    if (qtys.length === 0) qtys.push(50);

    const cutMap = new Map(cutTiers.map((t) => [t.minQuantity, t.ratePerUnit]));
    const priceMap = new Map(priceTiers.map((t) => [t.minQuantity, t.pricePerUnit]));
    const cardMap = new Map(priceTiers.map((t) => [t.minQuantity, t.showOnCard === true]));
    const deliveryFallback = deliveryTiers[0]?.ratePerUnit ?? 0;

    const base = qtys.map((q) => ({
      minQuantity: q,
      cutRate: cutMap.get(q) ?? 0,
      deliveryRate: resolveQuantityTierRate({
        quantity: q,
        tiers: deliveryTiers,
        fallbackRate: deliveryFallback,
      }),
      pricePerUnit: priceMap.get(q) ?? 0,
      sewingMultiplier: defaultSewingMultiplierForQty(q),
      showOnCard: cardMap.get(q) ?? false,
    }));

    return hydrateCommercialPriceTiers(base, costHints).map((row, index) => ({
      minQuantity: row.minQuantity,
      pricePerUnit: row.pricePerUnit,
      sewingMultiplier: row.sewingMultiplier ?? defaultSewingMultiplierForQty(row.minQuantity),
      cutRate: base[index]?.cutRate ?? 0,
      deliveryRate: base[index]?.deliveryRate ?? 0,
      showOnCard: base[index]?.showOnCard ?? false,
    }));
  }, [cutTiers, priceTiers, costHints, deliveryTiers]);

  const resolvedInitialOptimal = useMemo(() => {
    if (initialOptimalQty != null && initialOptimalQty > 0) return initialOptimalQty;
    return (
      resolveOptimalCutQty({
        optimalQty: null,
        tiers: cutTiers.map((t) => ({ minQuantity: t.minQuantity, ratePerUnit: t.ratePerUnit })),
      }) ??
      cutTiers[cutTiers.length - 1]?.minQuantity ??
      50
    );
  }, [initialOptimalQty, cutTiers]);

  const initialOptimalTotal = useMemo(() => {
    const rate =
      cutTiers.find((t) => t.minQuantity === resolvedInitialOptimal)?.ratePerUnit ??
      cutTiers[cutTiers.length - 1]?.ratePerUnit ??
      0;
    return Math.round(rate * resolvedInitialOptimal * 100) / 100;
  }, [cutTiers, resolvedInitialOptimal]);

  const [rows, setRows] = useState(() => cloneRows(initialMerged));
  const [optimalQty, setOptimalQty] = useState(resolvedInitialOptimal);
  const [optimalCutTotal, setOptimalCutTotal] = useState(initialOptimalTotal);
  const [isBaseModel, setIsBaseModel] = useState(initialIsBaseModel);
  const [baseline, setBaseline] = useState<Baseline>(() => ({
    rows: cloneRows(initialMerged),
    optimalQty: resolvedInitialOptimal,
    optimalCutTotal: initialOptimalTotal,
    isBaseModel: initialIsBaseModel,
  }));
  const [message, setMessage] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDirty =
    !rowsEqual(rows, baseline.rows) ||
    optimalQty !== baseline.optimalQty ||
    optimalCutTotal !== baseline.optimalCutTotal ||
    isBaseModel !== baseline.isBaseModel;

  useEffect(() => {
    dirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = LEAVE_MESSAGE;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const hrefAttr = anchor.getAttribute("href");
      if (
        !hrefAttr ||
        hrefAttr.startsWith("#") ||
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:")
      ) {
        return;
      }
      let nextUrl: URL;
      try {
        nextUrl = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;
      event.preventDefault();
      event.stopPropagation();
      pendingHrefRef.current = next;
      setPendingHref(next);
      setLeaveOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  const previewQty = rows[0]?.minQuantity || 50;
  const previewCut = resolveCutRatePerUnit({
    quantity: previewQty,
    optimalQty,
    tiers: rows.map((r) => ({ minQuantity: r.minQuantity, ratePerUnit: r.cutRate })),
    fallbackRate: rows[rows.length - 1]?.cutRate ?? 0,
  });
  const previewPrice =
    resolveCommercialPricePerUnit({
      quantity: previewQty,
      tiers: rows.map((r) => ({ minQuantity: r.minQuantity, pricePerUnit: r.pricePerUnit })),
      fallbackPrice: rows[0]?.pricePerUnit ?? 0,
    }) ?? 0;

  function applyOptimal(nextQty: number, nextTotal: number, spreadAll: boolean) {
    const qty = Math.max(1, Math.round(nextQty) || 1);
    const total = Math.max(0, Number.isFinite(nextTotal) ? nextTotal : 0);
    const rate = cutRateFromOptimalTotal(total, qty);
    setOptimalQty(qty);
    setOptimalCutTotal(Math.round(total * 100) / 100);
    setRows((prev) => {
      const withRow = ensureOptimalRow(prev, qty, rate);
      return spreadAll ? spreadCutFromOptimal(withRow, total) : withRow;
    });
  }

  function addTirage() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const nextQty = last ? last.minQuantity * 2 : 50;
      const next: Row = {
        minQuantity: nextQty,
        cutRate: cutRateFromOptimalTotal(optimalCutTotal, nextQty),
        deliveryRate: last?.deliveryRate ?? 0,
        pricePerUnit: last?.pricePerUnit ?? 0,
        sewingMultiplier: last?.sewingMultiplier ?? defaultSewingMultiplierForQty(nextQty),
        showOnCard: false,
      };
      const hydrated = hydrateCommercialPriceTiers(
        [...prev, next].map((r) => ({
          minQuantity: r.minQuantity,
          pricePerUnit: r.pricePerUnit,
          sewingMultiplier: r.sewingMultiplier,
          cutRate: r.cutRate,
        })),
        costHints,
      );
      return hydrated.map((h, i) => ({
        minQuantity: h.minQuantity,
        cutRate: i < prev.length ? prev[i]!.cutRate : next.cutRate,
        deliveryRate: i < prev.length ? prev[i]!.deliveryRate : next.deliveryRate,
        pricePerUnit: h.pricePerUnit,
        sewingMultiplier: h.sewingMultiplier ?? defaultSewingMultiplierForQty(h.minQuantity),
        showOnCard: i < prev.length ? prev[i]!.showOnCard : false,
      }));
    });
  }

  function markSaved(nextRows: Row[]) {
    setBaseline({
      rows: cloneRows(nextRows),
      optimalQty,
      optimalCutTotal,
      isBaseModel,
    });
  }

  function persist(): Promise<boolean> {
    setMessage(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const cutResult = await updateProductCutRatesAction({
          productId,
          optimalQty,
          tiers: rows.map((r) => ({
            minQuantity: r.minQuantity,
            ratePerUnit: r.cutRate,
          })),
        });
        if (!cutResult.ok) {
          setMessage(cutResult.error);
          resolve(false);
          return;
        }
        if (deliveryOp) {
          const formData = new FormData();
          formData.set("productId", productId);
          formData.set("productOperationId", deliveryOp.productOperationId);
          formData.set(
            "rateTiersJson",
            JSON.stringify(
              rows.map((r) => ({
                minQuantity: r.minQuantity,
                ratePerUnit: r.deliveryRate,
              })),
            ),
          );
          const deliveryResult = await updateProductOperationRateTiersAction(formData);
          if (!deliveryResult.ok) {
            setMessage("Не вдалося зберегти доставку");
            resolve(false);
            return;
          }
        }
        const priceResult = await updateProductCommercialPricesAction({
          productId,
          isBaseModel,
          tiers: rows.map((r) => ({
            minQuantity: r.minQuantity,
            pricePerUnit: r.pricePerUnit,
            showOnCard: r.showOnCard,
          })),
        });
        if (!priceResult.ok) {
          setMessage(priceResult.error);
          resolve(false);
          return;
        }
        markSaved(rows);
        setMessage(
          hasDelivery ? "Крій, доставку і прайс збережено" : "Крій і прайс збережено",
        );
        router.refresh();
        resolve(true);
      });
    });
  }

  function discardAndLeave() {
    const href = pendingHrefRef.current ?? pendingHref;
    setLeaveOpen(false);
    setPendingHref(null);
    pendingHrefRef.current = null;
    setRows(cloneRows(baseline.rows));
    setOptimalQty(baseline.optimalQty);
    setOptimalCutTotal(baseline.optimalCutTotal);
    setIsBaseModel(baseline.isBaseModel);
    if (href) router.push(href);
  }

  async function saveAndLeave() {
    const href = pendingHrefRef.current ?? pendingHref;
    const ok = await persist();
    if (!ok) return;
    setLeaveOpen(false);
    setPendingHref(null);
    pendingHrefRef.current = null;
    if (href) router.push(href);
  }

  return (
    <div className="space-y-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="type-label">Прайс і крій</p>
          <p className="type-caption mt-0.5">
            Суми в таблиці — на весь тираж, крім крою, доставки і ціни (₴/шт). Статті не дублюються.
            {hasDelivery ? " Доставка — сітка ₴/шт за тиражем." : ""} Галочка «Картка» — прайс у меню
            «Вироби».
          </p>
        </div>
        <label className="inline-flex items-center gap-2 type-caption">
          <input
            type="checkbox"
            checked={isBaseModel}
            onChange={(event) => setIsBaseModel(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)]"
          />
          Базова модель (без націнки за крій)
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <label className="flex flex-col gap-1">
          <span className="type-caption text-[var(--color-text-quiet)]">Оптимум, шт</span>
          <CompactInput
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className="h-8 w-[7rem] text-[13px]"
            value={optimalQty}
            onChange={(event) => applyOptimal(Number(event.target.value), optimalCutTotal, true)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="type-caption text-[var(--color-text-quiet)]">Крій на оптимум, ₴</span>
          <CompactInput
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className="h-8 w-[8rem] text-[13px]"
            value={optimalCutTotal}
            onChange={(event) => applyOptimal(optimalQty, Number(event.target.value), true)}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="type-caption text-[var(--color-text-quiet)]">₴/шт</span>
          <p className="flex h-8 items-center type-mono text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
            {formatMoneyUah(cutRateFromOptimalTotal(optimalCutTotal, optimalQty))}
          </p>
        </div>
      </div>

      {message ? <p className="type-caption text-[var(--color-text-muted)]">{message}</p> : null}
      {isDirty ? (
        <p className="type-caption text-[var(--color-warning-text)]">Є незбережені зміни</p>
      ) : null}

      <div className="w-full overflow-x-auto rounded-[12px] border border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-divider)] bg-[var(--color-bg)]/40 px-2.5 py-1.5">
          <p className="type-caption text-[var(--color-text-quiet)]">
            Мат + Крій×тираж + Пошив + Достав×тираж + Пакування + ПВ = Собів · суми в ₴
          </p>
        </div>
        <table className="w-full min-w-[64rem] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[3.25rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[5.75rem]" />
            {hasDelivery ? <col className="w-[5.75rem]" /> : null}
            <col />
            <col />
            <col />
            <col />
            <col />
            <col className="w-[4.5rem]" />
            <col className="w-[6.75rem]" />
            <col />
            <col />
            <col className="w-[3.75rem]" />
            <col className="w-[2.25rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--color-divider)] bg-[var(--color-bg)]/50">
              <th className={`${thClass} text-center`}>
                <HeaderTip tip={headerTips.card}>Картка</HeaderTip>
              </th>
              <th className={thClass}>
                <HeaderTip tip={headerTips.qty}>Тираж</HeaderTip>
              </th>
              <th className={thClass}>
                <HeaderTip tip={headerTips.cut}>Крій</HeaderTip>
              </th>
              {hasDelivery ? (
                <th className={thClass}>
                  <HeaderTip tip={headerTips.delivery}>Достав.</HeaderTip>
                </th>
              ) : null}
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.materials}>Мат.</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.sewing}>Пошив</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.other}>Пакування</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.pv}>ПВ</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.cost}>Собів.</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.multiplier}>×</HeaderTip>
              </th>
              <th className={thClass}>
                <HeaderTip tip={headerTips.price}>Ціна/шт</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.selling}>Продаж</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.profit}>Прибуток</HeaderTip>
              </th>
              <th className={`${thClass} text-right`}>
                <HeaderTip tip={headerTips.margin}>Маржа</HeaderTip>
              </th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const hint = hintForQty(costHints, row.minQuantity);
              const sewingPerUnit = hint?.sewingPerUnit ?? 0;
              const qty = row.minQuantity;
              const sheet = liveTirageSheet({
                hint,
                qty,
                cutRate: row.cutRate,
                deliveryRate: hasDelivery ? row.deliveryRate : 0,
              });
              const selling = roundMoney(row.pricePerUnit * qty);
              const profit = roundMoney(selling - sheet.cost);
              const marginPercent = selling > 0 ? (profit / selling) * 100 : 0;
              const tips = buildTirageFormulaTips({
                qty,
                cutRate: row.cutRate,
                cutTotal: sheet.cut,
                deliveryRate: hasDelivery ? row.deliveryRate : 0,
                deliveryTotal: sheet.delivery,
                deliveryName: deliveryOp?.name,
                materials: sheet.materials,
                sewingTotal: sheet.sewing,
                sewingPerUnit,
                other: sheet.other,
                otherLineNames: hint?.otherLineNames,
                otherHasExtraAdditional: hint?.otherHasExtraAdditional,
                pv: sheet.pv,
                cost: sheet.cost,
                multiplier: row.sewingMultiplier,
                pricePerUnit: row.pricePerUnit,
                selling,
                profit,
                marginPercent,
              });
              const isOptimal = row.minQuantity === optimalQty;
              return (
                <tr
                  key={`${row.minQuantity}-${index}`}
                  className={[
                    "border-b border-[var(--color-divider)] last:border-0",
                    isOptimal ? "bg-[var(--color-surface-subtle)]" : "",
                  ].join(" ")}
                >
                  <td className={`${tdClass} text-center`}>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-[var(--color-border)]"
                      checked={row.showOnCard}
                      title="Базовий прайс у картці «Вироби»"
                      onChange={(event) => {
                        const showOnCard = event.target.checked;
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, showOnCard };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-1">
                      <CompactInput
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        className="w-full"
                        value={row.minQuantity}
                        onChange={(event) => {
                          const minQuantity = Math.max(
                            1,
                            Math.round(Number(event.target.value)) || 1,
                          );
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = {
                              ...row,
                              minQuantity,
                              cutRate: cutRateFromOptimalTotal(optimalCutTotal, minQuantity),
                            };
                            return next.sort((a, b) => a.minQuantity - b.minQuantity);
                          });
                        }}
                      />
                      {isOptimal ? (
                        <span className="type-caption shrink-0 text-[10px] text-[var(--color-text-quiet)]">
                          опт
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-col items-end gap-0.5">
                      <CompactInput
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className="w-full"
                        value={row.cutRate}
                        title={tips.cut}
                        onChange={(event) => {
                          const cutRate = Number(event.target.value);
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = { ...row, cutRate };
                            return next;
                          });
                          if (isOptimal && Number.isFinite(cutRate)) {
                            setOptimalCutTotal(Math.round(cutRate * optimalQty * 100) / 100);
                          }
                        }}
                      />
                      <FormulaTip tip={tips.cut}>
                        <span className="type-caption tabular-nums text-[var(--color-text-quiet)]">
                          {formatAmount(sheet.cut)}
                        </span>
                      </FormulaTip>
                    </div>
                  </td>
                  {hasDelivery ? (
                    <td className={tdClass}>
                      <div className="flex flex-col items-end gap-0.5">
                        <CompactInput
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          className="w-full"
                          value={row.deliveryRate}
                          title={tips.delivery}
                          onChange={(event) => {
                            const deliveryRate = Number(event.target.value);
                            setRows((prev) => {
                              const next = [...prev];
                              next[index] = { ...row, deliveryRate };
                              return next;
                            });
                          }}
                        />
                        <FormulaTip tip={tips.delivery}>
                          <span className="type-caption tabular-nums text-[var(--color-text-quiet)]">
                            {formatAmount(sheet.delivery)}
                          </span>
                        </FormulaTip>
                      </div>
                    </td>
                  ) : null}
                  <td className={tdNum}>
                    <MoneyCell value={sheet.materials} tip={tips.materials} />
                  </td>
                  <td className={tdNum}>
                    <MoneyCell value={sheet.sewing} tip={tips.sewing} />
                  </td>
                  <td className={tdNum}>
                    <MoneyCell value={sheet.other} tip={tips.other} />
                  </td>
                  <td className={tdNum}>
                    <MoneyCell value={sheet.pv} tip={tips.pv} />
                  </td>
                  <td className={tdNum}>
                    <MoneyCell value={sheet.cost} tip={tips.cost} tone="strong" />
                  </td>
                  <td className={tdClass}>
                    <FormulaTip tip={tips.multiplier} className="w-full">
                      <CompactInput
                        type="number"
                        min={1}
                        step="0.01"
                        inputMode="decimal"
                        className="w-full text-center"
                        value={row.sewingMultiplier}
                        title={tips.multiplier}
                        onChange={(event) => {
                          const sewingMultiplier = Number(event.target.value);
                          const costPerUnit = qty > 0 ? sheet.cost / qty : 0;
                          const pricePerUnit =
                            sewingPerUnit > 0 && Number.isFinite(sewingMultiplier)
                              ? suggestSellingFromSewingMarkup({
                                  costPerUnit,
                                  sewingPerUnit,
                                  multiplier: sewingMultiplier,
                                })
                              : row.pricePerUnit;
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = { ...row, sewingMultiplier, pricePerUnit };
                            return next;
                          });
                        }}
                      />
                    </FormulaTip>
                  </td>
                  <td className={tdClass}>
                    <FormulaTip tip={tips.price} className="w-full">
                      <CompactInput
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className="w-full font-semibold"
                        value={row.pricePerUnit}
                        title={tips.price}
                        onChange={(event) => {
                          const pricePerUnit = Number(event.target.value);
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = { ...row, pricePerUnit };
                            return next;
                          });
                        }}
                      />
                    </FormulaTip>
                  </td>
                  <td className={tdNum}>
                    <MoneyCell value={selling} tip={tips.selling} />
                  </td>
                  <td className={tdNum}>
                    <MoneyCell value={profit} tip={tips.profit} tone="strong" />
                  </td>
                  <td className={tdNum}>
                    <FormulaTip tip={tips.margin}>
                      <span className="type-mono text-[12px] font-medium tabular-nums text-[var(--color-text)]">
                        {Number.isFinite(marginPercent) ? `${marginPercent.toFixed(0)}%` : "—"}
                      </span>
                    </FormulaTip>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-[11px] text-[var(--color-text-quiet)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
                      disabled={rows.length <= 1}
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Видалити тираж"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] pt-3">
        <Button type="button" variant="secondary" size="sm" onClick={addTirage}>
          Додати тираж
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows((prev) =>
              spreadCutFromOptimal(
                ensureOptimalRow(
                  prev,
                  optimalQty,
                  cutRateFromOptimalTotal(optimalCutTotal, optimalQty),
                ),
                optimalCutTotal,
              ),
            )
          }
        >
          Розкласти крій
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows((prev) =>
              hydrateCommercialPriceTiers(
                prev.map((row) => ({
                  minQuantity: row.minQuantity,
                  pricePerUnit: row.pricePerUnit,
                  sewingMultiplier: row.sewingMultiplier,
                })),
                costHints,
                { force: true },
              ).map((hydrated, index) => ({
                ...prev[index]!,
                pricePerUnit: hydrated.pricePerUnit,
                sewingMultiplier: hydrated.sewingMultiplier ?? prev[index]!.sewingMultiplier,
              })),
            )
          }
        >
          Перерахувати ціни
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void persist();
          }}
          disabled={pending || !isDirty}
        >
          {pending
            ? "Збереження…"
            : hasDelivery
              ? "Зберегти крій, доставку і прайс"
              : "Зберегти крій і прайс"}
        </Button>
        <span className="type-caption ml-auto">
          {previewQty} шт → крій {formatMoneyUah(previewCut)} · клієнту{" "}
          {formatMoneyUah(previewPrice)}
        </span>
      </div>

      {leaveOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-cut-leave-title"
            className="w-full max-w-md rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]"
          >
            <p id="price-cut-leave-title" className="type-label">
              Незбережені зміни
            </p>
            <p className="type-caption mt-2 text-[var(--color-text-secondary)]">
              У таблиці «Прайс і крій» є зміни. Зберегти їх перед виходом чи вийти без збереження?
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLeaveOpen(false);
                  setPendingHref(null);
                  pendingHrefRef.current = null;
                }}
              >
                Залишитись
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={discardAndLeave}>
                Вийти без змін
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={() => void saveAndLeave()}>
                {pending ? "Збереження…" : "Зберегти і вийти"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

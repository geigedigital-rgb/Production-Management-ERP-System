"use client";

import { useEffect, useState } from "react";
import { HeaderBlock } from "@/components/ui/ObjectHeader";
import { formatMoneyUah } from "@/lib/utils";

const EXAMPLE_COST = 100;

function priceFor(method: string, rate: number) {
  if (method === "MARKUP") return EXAMPLE_COST * (1 + rate / 100);
  if (rate >= 100) return EXAMPLE_COST;
  return EXAMPLE_COST / (1 - rate / 100);
}

type Rules = { method: string; target: number; minimum: number };

/**
 * Mirrors the pricing form while it is being edited, so the effect of a rule
 * change is visible before anything is saved.
 */
export function PricingPreview({ formId, initial }: { formId: string; initial: Rules }) {
  const [rules, setRules] = useState(initial);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => {
      const data = new FormData(form);
      setRules({
        method: String(data.get("pricingMethod") ?? initial.method),
        target: Number(data.get("targetMarginPercent") ?? initial.target),
        minimum: Number(data.get("minimumMarginPercent") ?? initial.minimum),
      });
    };

    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId, initial.method, initial.target, initial.minimum]);

  const price = priceFor(rules.method, rules.target);
  const belowMinimum = Number.isFinite(rules.target) && rules.target < rules.minimum;

  return (
    <HeaderBlock title="Як це працює">
      <p className="type-body-secondary">
        При собівартості {formatMoneyUah(EXAMPLE_COST)} і ставці {rules.target}% ціна продажу складе{" "}
        <span className="font-semibold text-[var(--color-text-primary)]">{formatMoneyUah(price)}</span>.
      </p>
      <p className="type-caption mt-2">
        {rules.method === "MARGIN"
          ? "Маржа рахується від ціни продажу: ціна = собівартість ÷ (1 − ставка)."
          : "Націнка рахується від собівартості: ціна = собівартість × (1 + ставка)."}
      </p>
      {belowMinimum ? (
        <p className="type-caption mt-2 font-medium text-[var(--color-danger-text)]">
          Цільова ставка нижча за мінімальну ({rules.minimum}%) — збереження буде відхилено.
        </p>
      ) : null}
    </HeaderBlock>
  );
}

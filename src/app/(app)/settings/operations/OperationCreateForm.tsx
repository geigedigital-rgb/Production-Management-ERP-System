"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { FormGroup } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CreatePanel } from "@/components/ui/CreatePanel";
import {
  createOperationAction,
  updateOperationAction,
} from "@/server/domains/catalog/actions";
import {
  DEFAULT_OPERATION_QTY_TIERS,
  defaultOperationRateTiers,
  resolveQuantityTierRate,
  type QuantityRateTier,
} from "@/lib/quantity-tiers";
import { formatMoneyUah, cn } from "@/lib/utils";

type Method = "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER";

const methods: { value: Method; label: string; hint: string }[] = [
  {
    value: "UNIT_RATE",
    label: "Ставка за одиницю",
    hint: "Фіксована ₴/шт — не залежить від тиражу.",
  },
  {
    value: "SHIFT_OUTPUT",
    label: "Зміна / норма",
    hint: "Вартість = вартість зміни ÷ норму виробітку за зміну.",
  },
  {
    value: "QUANTITY_TIER",
    label: "Ставка за тиражем",
    hint: "₴/шт за сходинками тиражу (як у крою): береться найбільша сходинка ≤ кількості.",
  },
];

export type OperationFormDefaults = {
  id: string;
  nameUk: string;
  calculationMethod: Method;
  baseRate: number | null;
  shiftCost: number | null;
  standardOutputPerShift: number | null;
  note: string;
  rateTiers?: QuantityRateTier[];
};

function OperationRateTierEditor({
  tiers,
  onChange,
  previewQty = 100,
}: {
  tiers: QuantityRateTier[];
  onChange: (tiers: QuantityRateTier[]) => void;
  previewQty?: number;
}) {
  const previewRate = useMemo(
    () =>
      resolveQuantityTierRate({
        quantity: previewQty,
        tiers,
        fallbackRate: tiers[0]?.ratePerUnit ?? 0,
      }),
    [previewQty, tiers],
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[320px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-table-section-border)]">
              <th className="py-1.5">Тираж від, шт</th>
              <th className="py-1.5">₴ / шт</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((row, index) => (
              <tr key={index} className="border-b border-[var(--color-border-muted)]">
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={1}
                    className="field-input w-full"
                    value={row.minQuantity}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = { ...row, minQuantity: Number(event.target.value) };
                      onChange(next);
                    }}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="field-input w-full"
                    value={row.ratePerUnit}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = { ...row, ratePerUnit: Number(event.target.value) };
                      onChange(next);
                    }}
                  />
                </td>
                <td className="py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(tiers.filter((_, i) => i !== index))}
                    disabled={tiers.length <= 1}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange([
              ...tiers,
              {
                minQuantity: (tiers[tiers.length - 1]?.minQuantity ?? 0) + 50,
                ratePerUnit: tiers[tiers.length - 1]?.ratePerUnit ?? 0,
              },
            ])
          }
        >
          Додати сходинку
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange(
              defaultOperationRateTiers(tiers.find((t) => t.ratePerUnit > 0)?.ratePerUnit ?? 0),
            )
          }
        >
          Сітка {DEFAULT_OPERATION_QTY_TIERS.join("/")}
        </Button>
        <span className="type-caption">
          Приклад: {previewQty} шт → {formatMoneyUah(previewRate)} / шт
        </span>
      </div>
    </div>
  );
}

function OperationFields({ defaults }: { defaults?: OperationFormDefaults }) {
  const [method, setMethod] = useState<Method>(defaults?.calculationMethod ?? "UNIT_RATE");
  const [rateTiers, setRateTiers] = useState<QuantityRateTier[]>(() =>
    defaults?.rateTiers?.length
      ? defaults.rateTiers
      : defaultOperationRateTiers(defaults?.baseRate ?? 0),
  );
  const active = methods.find((item) => item.value === method)!;

  return (
    <>
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="rateTiersJson" value={JSON.stringify(rateTiers)} />

      <FormGroup label="Основне" columns={1}>
        <Input
          name="nameUk"
          label="Назва операції"
          required
          autoFocus={!defaults}
          placeholder="Пошиття"
          defaultValue={defaults?.nameUk}
        />
      </FormGroup>

      <FormGroup label="Спосіб розрахунку" columns={1}>
        <div className="grid gap-1.5">
          {methods.map((item) => (
            <label
              key={item.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border px-3 py-2.5 transition-colors",
                method === item.value
                  ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              <input
                type="radio"
                name="calculationMethod"
                value={item.value}
                checked={method === item.value}
                onChange={() => setMethod(item.value)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-primary-600)]"
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-[var(--color-text-primary)]">
                  {item.label}
                </span>
                <span className="type-caption block">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </FormGroup>

      {method === "UNIT_RATE" ? (
        <FormGroup label="Тариф" columns={2}>
          <Input
            name="baseRate"
            label="Ставка за одиницю, ₴"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaults?.baseRate ?? undefined}
          />
        </FormGroup>
      ) : null}

      {method === "SHIFT_OUTPUT" ? (
        <FormGroup label="Норматив зміни" columns={2}>
          <Input
            name="shiftCost"
            label="Вартість зміни, ₴"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaults?.shiftCost ?? undefined}
          />
          <Input
            name="standardOutputPerShift"
            label="Норма виробітку, од./зміну"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaults?.standardOutputPerShift ?? undefined}
          />
        </FormGroup>
      ) : null}

      {method === "QUANTITY_TIER" ? (
        <FormGroup
          label="Сітка за тиражем"
          columns={1}
          description="Базова сітка 30/50/100/150/200/250. Можна додати або прибрати сходинки."
        >
          <Input
            name="baseRate"
            label="Запасна ставка, ₴ (якщо тираж менший за першу сходинку)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults?.baseRate ?? undefined}
          />
          <OperationRateTierEditor tiers={rateTiers} onChange={setRateTiers} />
        </FormGroup>
      ) : null}

      <FormGroup label="Примітка" columns={1} description={active.hint}>
        <Input
          name="note"
          label="Коментар"
          placeholder="Обмеження, обладнання, виконавці"
          defaultValue={defaults?.note}
        />
      </FormGroup>
    </>
  );
}

export function OperationCreatePanel({
  triggerLabel = "Нова операція",
  variant = "primary",
  size = "md",
  onCreated,
}: {
  triggerLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  onCreated?: (result: Record<string, unknown>) => void;
}) {
  return (
    <CreatePanel
      title="Нова операція"
      description="Спосіб розрахунку визначає, які поля впливають на собівартість."
      triggerLabel={triggerLabel}
      submitLabel="Зберегти операцію"
      action={createOperationAction}
      variant={variant}
      size={size}
      onCreated={onCreated}
      width="lg"
    >
      <OperationFields />
    </CreatePanel>
  );
}

export function OperationEditPanel({ operation }: { operation: OperationFormDefaults }) {
  return (
    <CreatePanel
      key={operation.id}
      title="Редагувати операцію"
      description="Зміни вплинуть на нові калькуляції. Зафіксовані версії не зміняться."
      triggerLabel="Змінити"
      submitLabel="Зберегти зміни"
      action={updateOperationAction}
      showPlusIcon={false}
      variant="ghost"
      size="sm"
      width="lg"
    >
      <OperationFields defaults={operation} />
    </CreatePanel>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { FormGroup } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { CreatePanel } from "@/components/ui/CreatePanel";
import {
  createOperationAction,
  updateOperationAction,
} from "@/server/domains/catalog/actions";
import { cn } from "@/lib/utils";

type Method = "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER";

const methods: { value: Method; label: string; hint: string }[] = [
  { value: "UNIT_RATE", label: "Ставка за одиницю", hint: "Вартість операції фіксована на одне виріб." },
  {
    value: "SHIFT_OUTPUT",
    label: "Зміна / норма виробітку",
    hint: "Вартість = вартість зміни ÷ норму виробітку за зміну.",
  },
  {
    value: "QUANTITY_TIER",
    label: "За діапазоном кількості",
    hint: "Ставка береться з тарифної сітки в налаштуваннях ціноутворення.",
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
};

function OperationFields({ defaults }: { defaults?: OperationFormDefaults }) {
  const [method, setMethod] = useState<Method>(defaults?.calculationMethod ?? "UNIT_RATE");
  const active = methods.find((item) => item.value === method)!;

  return (
    <>
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormGroup label="Основне" columns={1}>
        <Input
          name="nameUk"
          label="Назва операції"
          required
          autoFocus={!defaults}
          placeholder="Розкрій"
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
        <Banner tone="info" title="Тариф береться з налаштувань">
          Ставка визначається діапазоном кількості в розділі «Ціноутворення». Базову ставку можна вказати
          як запасне значення.
          <div className="mt-2">
            <Input
              name="baseRate"
              label="Запасна ставка, ₴"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaults?.baseRate ?? undefined}
            />
          </div>
        </Banner>
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
    >
      <OperationFields defaults={operation} />
    </CreatePanel>
  );
}

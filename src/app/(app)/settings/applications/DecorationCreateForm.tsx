"use client";

import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { CreatePanel } from "@/components/ui/CreatePanel";
import {
  createDecorationAction,
  updateDecorationAction,
} from "@/server/domains/catalog/actions";
import { decorationUnitLabels } from "@/server/domains/catalog/operation-schemas";

export type DecorationFormDefaults = {
  id: string;
  nameUk: string;
  calculationUnit: string;
  setupCost: number;
  unitRate: number;
  note: string;
};

function DecorationFields({ defaults }: { defaults?: DecorationFormDefaults }) {
  return (
    <>
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormGroup label="Основне" columns={1}>
        <Input
          name="nameUk"
          label="Назва методу"
          required
          autoFocus={!defaults}
          placeholder="Шовкодрук"
          defaultValue={defaults?.nameUk}
        />
      </FormGroup>

      <FormGroup label="Одиниця розрахунку" columns={1}>
        <Select
          name="calculationUnit"
          label="Розрахунок за"
          required
          defaultValue={defaults?.calculationUnit ?? "PLACEMENT"}
        >
          {Object.entries(decorationUnitLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormGroup>

      <FormGroup label="Тарифи" columns={2}>
        <Input
          name="setupCost"
          label="Приладка, ₴"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaults?.setupCost ?? 0}
          hint="Разова вартість на партію"
        />
        <Input
          name="unitRate"
          label="Тариф за одиницю, ₴"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaults?.unitRate ?? 0}
        />
      </FormGroup>

      <FormGroup label="Примітка" columns={1}>
        <Input
          name="note"
          label="Коментар"
          placeholder="Обмеження за матеріалами, розміри макета"
          defaultValue={defaults?.note}
        />
      </FormGroup>
    </>
  );
}

export function DecorationCreatePanel({
  triggerLabel = "Новий метод",
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
      title="Новий метод нанесення"
      description="Приладка враховується один раз на замовлення, тариф — на кожну одиницю."
      triggerLabel={triggerLabel}
      submitLabel="Зберегти метод"
      action={createDecorationAction}
      variant={variant}
      size={size}
      onCreated={onCreated}
    >
      <DecorationFields />
    </CreatePanel>
  );
}

export function DecorationEditPanel({ decoration }: { decoration: DecorationFormDefaults }) {
  return (
    <CreatePanel
      key={decoration.id}
      title="Редагувати метод нанесення"
      description="Зміни вплинуть на нові калькуляції. Зафіксовані версії не зміняться."
      triggerLabel="Змінити"
      submitLabel="Зберегти зміни"
      action={updateDecorationAction}
      showPlusIcon={false}
      variant="ghost"
      size="sm"
    >
      <DecorationFields defaults={decoration} />
    </CreatePanel>
  );
}

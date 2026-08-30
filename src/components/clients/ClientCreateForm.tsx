"use client";

import { Input } from "@/components/ui/Input";
import { FormGroup, Textarea } from "@/components/ui/Field";
import { CreatePanel } from "@/components/ui/CreatePanel";
import { createClientAction } from "@/server/domains/clients/actions";

/**
 * Client creation. Reused both on the clients page and inline inside the order
 * flow, so a missing client never interrupts order entry.
 */
export function ClientCreatePanel({
  onCreated,
  triggerLabel = "Новий клієнт",
  variant = "primary",
  size = "md",
}: {
  onCreated?: (client: { id: string; companyName: string }) => void;
  triggerLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <CreatePanel
      title="Новий клієнт"
      description="Мінімум — назва компанії. Решту реквізитів можна заповнити пізніше."
      triggerLabel={triggerLabel}
      submitLabel="Зберегти клієнта"
      action={createClientAction}
      variant={variant}
      size={size}
      width="lg"
      onCreated={(result) =>
        onCreated?.({
          id: String(result.clientId),
          companyName: String(result.companyName),
        })
      }
    >
      <FormGroup label="Компанія" columns={1}>
        <Input name="companyName" label="Назва компанії / ПІБ" required autoFocus />
      </FormGroup>

      <FormGroup label="Контакти" columns={2}>
        <Input name="contactPerson" label="Контактна особа" />
        <Input name="phone" label="Телефон" type="tel" placeholder="+380" />
        <Input name="email" label="Email" type="email" className="sm:col-span-2" />
      </FormGroup>

      <FormGroup label="Реквізити" columns={1}>
        <Textarea name="legalDetails" label="Юридичні реквізити" placeholder="ЄДРПОУ, адреса, IBAN" />
        <Input name="note" label="Примітка" placeholder="Умови роботи, знижки, домовленості" />
      </FormGroup>
    </CreatePanel>
  );
}

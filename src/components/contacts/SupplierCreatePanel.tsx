"use client";

import { Input } from "@/components/ui/Input";
import { FormGroup, Textarea } from "@/components/ui/Field";
import { CreatePanel } from "@/components/ui/CreatePanel";
import { createSupplierContactAction } from "@/server/domains/catalog/supplier-contact-actions";

export function SupplierCreatePanel({
  triggerLabel = "Новий постачальник",
  variant = "primary",
  size = "md",
}: {
  triggerLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <CreatePanel
      title="Новий постачальник"
      description="Назва обовʼязкова. Ціни матеріалів лишаються в картці матеріалу."
      triggerLabel={triggerLabel}
      submitLabel="Зберегти"
      action={createSupplierContactAction}
      variant={variant}
      size={size}
      width="lg"
    >
      <FormGroup label="Постачальник" columns={1}>
        <Input name="nameUk" label="Назва" required autoFocus />
      </FormGroup>
      <FormGroup label="Контакти" columns={2}>
        <Input name="contactPerson" label="Контактна особа" />
        <Input name="phone" label="Телефон" type="tel" placeholder="+380" />
        <Input name="email" label="Email" type="email" className="sm:col-span-2" />
        <Input
          name="defaultCargoUsdPerKg"
          label="CARGO $/кг (за замовч.)"
          type="number"
          step="0.01"
          placeholder="1.7"
        />
      </FormGroup>
      <FormGroup label="Примітка" columns={1}>
        <Textarea name="note" label="Примітка" placeholder="Умови, терміни, коментар" />
      </FormGroup>
    </CreatePanel>
  );
}

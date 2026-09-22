"use client";

import { ContactCard, ContactCardsGrid, type ContactField } from "@/components/contacts/ContactCard";
import { updateSupplierContactAction } from "@/server/domains/catalog/supplier-contact-actions";

export type SupplierCardRow = {
  id: string;
  nameUk: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  defaultCargoUsdPerKg: number | null;
  materialsCount: number;
};

export function SupplierContactCards({
  rows,
  canEdit,
}: {
  rows: SupplierCardRow[];
  canEdit: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <ContactCardsGrid>
      {rows.map((row) => {
        const fields: ContactField[] = [
          { key: "contactPerson", label: "Контакт", value: row.contactPerson ?? "" },
          {
            key: "phone",
            label: "Телефон",
            value: row.phone ?? "",
            kind: "tel",
            placeholder: "+380",
          },
          {
            key: "email",
            label: "Email",
            value: row.email ?? "",
            kind: "email",
          },
          {
            key: "defaultCargoUsdPerKg",
            label: "CARGO $/кг",
            value: row.defaultCargoUsdPerKg != null ? String(row.defaultCargoUsdPerKg) : "",
            kind: "number",
            placeholder: "1.7",
          },
        ];

        return (
          <ContactCard
            key={row.id}
            title={row.nameUk}
            titleKey="nameUk"
            meta={`${row.materialsCount} мат.`}
            disabled={!canEdit}
            fields={fields}
            onSave={async (values) => {
              const formData = new FormData();
              formData.set("id", row.id);
              for (const [key, value] of Object.entries(values)) {
                formData.set(key, value);
              }
              formData.set("note", row.note ?? "");
              const result = await updateSupplierContactAction(formData);
              return { ok: result.ok, error: result.ok ? undefined : result.error };
            }}
          />
        );
      })}
    </ContactCardsGrid>
  );
}

"use client";

import { ContactCard, ContactCardsGrid, type ContactField } from "@/components/contacts/ContactCard";
import { updateClientAction } from "@/server/domains/clients/actions";

export type ClientCardRow = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  legalDetails: string | null;
  note: string | null;
  ordersCount: number;
};

export function ClientContactCards({
  rows,
  canEdit,
}: {
  rows: ClientCardRow[];
  canEdit: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <ContactCardsGrid>
      {rows.map((row) => {
        const fields: ContactField[] = [
          {
            key: "companyName",
            label: "Компанія / ПІБ",
            value: row.companyName,
            required: true,
            wide: true,
          },
          { key: "contactPerson", label: "Контакт", value: row.contactPerson ?? "" },
          { key: "phone", label: "Телефон", value: row.phone ?? "", kind: "tel", placeholder: "+380" },
          { key: "email", label: "Email", value: row.email ?? "", kind: "email", wide: true },
          {
            key: "legalDetails",
            label: "Реквізити",
            value: row.legalDetails ?? "",
            kind: "textarea",
            wide: true,
            placeholder: "ЄДРПОУ, адреса, IBAN",
          },
          {
            key: "note",
            label: "Примітка",
            value: row.note ?? "",
            kind: "textarea",
            wide: true,
          },
        ];

        return (
          <ContactCard
            key={row.id}
            title={row.companyName}
            href={`/clients/${row.id}`}
            meta={`${row.ordersCount} зам.`}
            disabled={!canEdit}
            fields={fields}
            onSave={async (values) => {
              const formData = new FormData();
              formData.set("id", row.id);
              for (const [key, value] of Object.entries(values)) {
                formData.set(key, value);
              }
              const result = await updateClientAction(formData);
              return { ok: result.ok, error: result.ok ? undefined : result.error };
            }}
          />
        );
      })}
    </ContactCardsGrid>
  );
}

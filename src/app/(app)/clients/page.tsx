import { redirect } from "next/navigation";
import { listClients } from "@/server/domains/clients/service";
import { listSuppliers } from "@/server/domains/catalog/suppliers";
import { PageHeader } from "@/components/ui/Page";
import { ViewTabs } from "@/components/ui/Tabs";
import { SearchField, ResetFilters } from "@/components/ui/Filters";
import { ClientCreatePanel } from "@/components/clients/ClientCreateForm";
import { ClientContactCards } from "@/components/contacts/ClientContactCards";
import { SupplierContactCards } from "@/components/contacts/SupplierContactCards";
import { SupplierCreatePanel } from "@/components/contacts/SupplierCreatePanel";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");

  const { q, tab: tabRaw } = await searchParams;
  const tab = tabRaw === "suppliers" ? "suppliers" : "clients";
  const canEditClients = accessHas(access, "manageClients");
  const canEditSuppliers = accessHas(access, "manageCatalogs");

  const term = q?.toLowerCase().trim();

  const [clients, suppliers] = await Promise.all([
    listClients().catch(() => []),
    listSuppliers().catch(() => []),
  ]);

  const filteredClients = clients.filter((client) => {
    if (!term) return true;
    return [client.companyName, client.contactPerson, client.phone, client.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!term) return true;
    return [
      supplier.nameUk,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.note,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const tabQuery = (key: "clients" | "suppliers") => {
    const params = new URLSearchParams();
    if (key === "suppliers") params.set("tab", "suppliers");
    if (q?.trim()) params.set("q", q.trim());
    const qs = params.toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Контакти"
        description="Клієнти для замовлень і постачальники матеріалів — легкі картки з редагуванням на місці."
        actions={
          tab === "suppliers" ? (
            canEditSuppliers ? <SupplierCreatePanel /> : null
          ) : canEditClients ? (
            <ClientCreatePanel />
          ) : null
        }
      />

      <ViewTabs
        active={tab}
        items={[
          { key: "clients", label: "Клієнти", href: tabQuery("clients"), count: clients.length },
          {
            key: "suppliers",
            label: "Постачальники",
            href: tabQuery("suppliers"),
            count: suppliers.length,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          placeholder={
            tab === "suppliers"
              ? "Назва, контакт або телефон"
              : "Компанія, контакт або телефон"
          }
          className="w-64"
        />
        <ResetFilters keys={["q"]} />
        <span className="type-caption tabular text-[var(--color-text-quiet)]">
          {tab === "suppliers"
            ? `${filteredSuppliers.length} з ${suppliers.length}`
            : `${filteredClients.length} з ${clients.length}`}
        </span>
      </div>

      {tab === "suppliers" ? (
        filteredSuppliers.length === 0 ? (
          <div className="rounded-[var(--radius-surface)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
            <p className="text-[14px] font-medium text-[var(--color-text)]">
              {term ? "Постачальників не знайдено" : "Постачальників ще немає"}
            </p>
            <p className="type-caption mt-1">
              {term
                ? "Спробуйте інший запит."
                : "Додайте постачальника тут або під час редагування матеріалу."}
            </p>
            {!term && canEditSuppliers ? (
              <div className="mt-3 flex justify-center">
                <SupplierCreatePanel />
              </div>
            ) : null}
          </div>
        ) : (
          <SupplierContactCards
            canEdit={canEditSuppliers}
            rows={filteredSuppliers.map((row) => ({
              id: row.id,
              nameUk: row.nameUk,
              contactPerson: row.contactPerson,
              phone: row.phone,
              email: row.email,
              note: row.note,
              defaultCargoUsdPerKg:
                row.defaultCargoUsdPerKg != null ? Number(row.defaultCargoUsdPerKg) : null,
              materialsCount: row._count.materialOffers,
            }))}
          />
        )
      ) : filteredClients.length === 0 ? (
        <div className="rounded-[var(--radius-surface)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-[var(--color-text)]">
            {term ? "Клієнтів не знайдено" : "Клієнтів ще немає"}
          </p>
          <p className="type-caption mt-1">
            {term
              ? "Спробуйте інший запит."
              : "Створіть першого клієнта, щоб оформити замовлення."}
          </p>
          {!term && canEditClients ? (
            <div className="mt-3 flex justify-center">
              <ClientCreatePanel />
            </div>
          ) : null}
        </div>
      ) : (
        <ClientContactCards
          canEdit={canEditClients}
          rows={filteredClients.map((row) => ({
            id: row.id,
            companyName: row.companyName,
            contactPerson: row.contactPerson,
            phone: row.phone,
            email: row.email,
            legalDetails: row.legalDetails,
            note: row.note,
            ordersCount: row._count.orders,
          }))}
        />
      )}
    </div>
  );
}

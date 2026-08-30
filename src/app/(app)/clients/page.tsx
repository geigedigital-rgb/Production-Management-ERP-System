import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listClients } from "@/server/domains/clients/service";
import { PageHeader } from "@/components/ui/Page";
import { TableCard, TableToolbar } from "@/components/ui/Table";
import { SearchField, FilterChips, ResetFilters } from "@/components/ui/Filters";
import { ClientCreatePanel } from "@/components/clients/ClientCreateForm";
import { ClientsTable, type ClientsTableRow } from "@/components/clients/ClientsTable";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; activity?: string }>;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");

  const { q, activity } = await searchParams;
  const canDelete = accessHas(access, "manageClients");

  let clients: Awaited<ReturnType<typeof listClients>> = [];
  try {
    clients = await listClients();
  } catch {
    clients = [];
  }

  const withOrders = clients.filter((client) => client._count.orders > 0).length;
  const withoutOrders = clients.length - withOrders;

  const term = q?.toLowerCase().trim();
  const filtered = clients.filter((client) => {
    const matchesTerm = term
      ? [client.companyName, client.contactPerson, client.phone, client.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      : true;
    const matchesActivity =
      activity === "active"
        ? client._count.orders > 0
        : activity === "idle"
          ? client._count.orders === 0
          : true;
    return matchesTerm && matchesActivity;
  });

  const rows: ClientsTableRow[] = filtered.map((client) => ({
    id: client.id,
    companyName: client.companyName,
    contactPerson: client.contactPerson,
    phone: client.phone,
    email: client.email,
    ordersCount: client._count.orders,
    lastOrder: client.orders[0]
      ? {
          id: client.orders[0].id,
          number: client.orders[0].number,
          status: client.orders[0].status,
        }
      : null,
  }));

  return (
    <div>
      <PageHeader
        title="Клієнти"
        description="Компанія, контакт і останнє замовлення. Нового клієнта можна створити тут або прямо у формі замовлення."
        actions={<ClientCreatePanel />}
      />

      <TableCard>
        <TableToolbar
          left={
            <span className="type-caption tabular">
              {filtered.length} з {clients.length}
            </span>
          }
          filters={
            <>
              <SearchField placeholder="Компанія, контакт або телефон" className="w-64" />
              <FilterChips
                paramKey="activity"
                options={[
                  { value: "active", label: "З замовленнями", count: withOrders },
                  { value: "idle", label: "Без замовлень", count: withoutOrders },
                ]}
              />
              <ResetFilters keys={["q", "activity"]} />
            </>
          }
        />

        <ClientsTable
          rows={rows}
          canDelete={canDelete}
          empty={{
            title: term || activity ? "Клієнтів не знайдено" : "Клієнтів ще немає",
            description:
              term || activity
                ? "Спробуйте інший запит або створіть нового клієнта."
                : "Створіть першого клієнта, щоб оформити замовлення.",
            action: <ClientCreatePanel />,
          }}
        />
      </TableCard>
    </div>
  );
}

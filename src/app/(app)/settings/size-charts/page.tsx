import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/Page";
import { SizeChartsAdminPanel } from "@/components/settings/SizeChartsAdminPanel";
import { listSizeChartCatalog } from "@/server/domains/size-charts/service";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";

export default async function SizeChartsSettingsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!accessHas(access, "manageCatalogs")) redirect("/overview");

  const catalog = await listSizeChartCatalog();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Розмірна сітка"
        description="Розміри — те, що вибирають у виробі й замовленні. Підказка — окремі таблиці обхватів / зросту."
      />
      <SizeChartsAdminPanel
        variants={catalog.map((row) => ({
          id: row.id,
          code: row.code,
          nameUk: row.nameUk,
          description: row.description,
          sortOrder: row.sortOrder,
          status: row.status,
          productCount: row._count.products,
          sizes: row.sizes.map((size) => ({
            id: size.id,
            code: size.code,
            nameUk: size.nameUk,
            descriptionUk: size.descriptionUk ?? "",
            sortOrder: size.sortOrder,
            status: size.status,
          })),
        }))}
      />
    </div>
  );
}

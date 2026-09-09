import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import { FixedCostsAdminPanel } from "@/components/settings/FixedCostsAdminPanel";
import { getCurrentUserAccess } from "@/server/auth/access";
import { getFixedCostCatalog } from "@/server/domains/fixed-costs/service";

export default async function FixedCostsSettingsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (access.role !== "ADMINISTRATOR") redirect("/overview");

  let catalog: Awaited<ReturnType<typeof getFixedCostCatalog>> | null = null;
  let dbError = false;
  try {
    catalog = await getFixedCostCatalog();
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Постійні витрати"
        description="Статті на місяць, робочі дні, швачки та коефіцієнт для собівартості виробів."
      />
      {dbError || !catalog ? (
        <Banner tone="danger">Не вдалося завантажити довідник. Перевірте міграції БД.</Banner>
      ) : (
        <FixedCostsAdminPanel
          settings={catalog.settings}
          articles={catalog.articles}
          monthlyTotalActive={catalog.monthlyTotalActive}
          metrics={catalog.metrics}
        />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/Page";
import { ScreenPrintAdminPanel } from "@/components/settings/ScreenPrintAdminPanel";
import { getScreenPrintCatalog } from "@/server/domains/screen-print/service";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";

export default async function ScreenPrintSettingsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!accessHas(access, "manageCatalogs")) redirect("/overview");

  const catalog = await getScreenPrintCatalog();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Шовкотрафарет"
        description="Прайс нанесення за тиражем і кількістю кольорів (база ≤ А4) та коефіцієнти. Використовується лише на етапі замовлення — не в картці виробу."
      />
      <ScreenPrintAdminPanel cells={catalog.cells} coefficients={catalog.coefficients} />
    </div>
  );
}

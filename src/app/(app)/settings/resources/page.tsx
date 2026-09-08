import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import {
  getFabricPricingGlobals,
  listMaterials,
  listUnits,
} from "@/server/domains/catalog/materials";
import { getCatalogHealth, tipsForPage } from "@/server/domains/catalog/health";
import { PageHeader } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import { TableCard, TableToolbar } from "@/components/ui/Table";
import { SearchField, FilterChips, ResetFilters } from "@/components/ui/Filters";
import { MaterialCreatePanel } from "./MaterialCreateForm";
import { MaterialsTable, type MaterialsTableRow } from "@/components/catalog/MaterialsTable";
import { CatalogHealthBanner } from "@/components/catalog/CatalogHealthBanner";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";

export default async function MaterialsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; kind?: string }>;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!accessHas(access, "manageCatalogs")) redirect("/overview");

  const { q, type, kind } = await searchParams;

  let materials: Awaited<ReturnType<typeof listMaterials>> = [];
  let units: Awaited<ReturnType<typeof listUnits>> = [];
  let healthTips: Awaited<ReturnType<typeof getCatalogHealth>>["tips"] = [];
  let fabricGlobals: Awaited<ReturnType<typeof getFabricPricingGlobals>> = {
    usdUahRate: 45,
    fabricCargoUsdPerKg: 1.7,
    materialCostVatMode: "NET",
  };
  let dbError = false;

  try {
    const [mats, uns, health, globals] = await Promise.all([
      listMaterials({ search: q }),
      listUnits(),
      getCatalogHealth().catch(() => null),
      getFabricPricingGlobals(),
    ]);
    materials = mats;
    units = uns;
    fabricGlobals = globals;
    if (health) healthTips = tipsForPage(health.tips, "materials");
  } catch {
    dbError = true;
  }

  const filtered = materials.filter((row) => {
    if (type && row.type !== type) return false;
    if (kind && (row.fabricKindUk ?? "") !== kind) return false;
    return true;
  });
  const counts = {
    FABRIC: materials.filter((row) => row.type === "FABRIC").length,
    OTHER_MATERIAL: materials.filter((row) => row.type === "OTHER_MATERIAL").length,
    TRIM: materials.filter((row) => row.type === "TRIM").length,
  };
  const kindCounts = {
    Трикотаж: materials.filter((row) => row.fabricKindUk === "Трикотаж").length,
    Саржеві: materials.filter((row) => row.fabricKindUk === "Саржеві").length,
    Плащовка: materials.filter((row) => row.fabricKindUk === "Плащовка").length,
  };

  const canCreate =
    accessHas(access, "createInlineCatalog") ||
    accessHas(access, "manageCatalogs");
  const canDelete = accessHas(access, "archiveRecords");
  const unitOptions = units.map((u) => ({ id: u.id, label: u.nameUk }));
  const suppliers = [
    ...new Set(
      materials
        .map((row) => row.supplierCode?.replace(/\s+/g, " ").trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "uk"));

  const rows: MaterialsTableRow[] = filtered.map((row) => ({
    id: row.id,
    nameUk: row.nameUk,
    type: row.type,
    unitCode: row.unitOfMeasure.code,
    unitOfMeasureId: row.unitOfMeasureId,
    purchasePrice: Number(row.purchasePrice),
    waste: Number(row.defaultWastePercent),
    supplierCode: row.supplierCode ?? "",
    colorOrAttribute: row.colorOrAttribute ?? "",
    note: row.note ?? "",
    details:
      row.type === "FABRIC"
        ? [
            row.fabricKindUk,
            row.supplierCode,
            row.densityGsm ? `${row.densityGsm} г/м²` : null,
            row.composition,
            row.widthCm ? `шир. ${row.widthCm}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : [row.supplierCode, row.colorOrAttribute].filter(Boolean).join(" · "),
    densityGsm: row.densityGsm ?? "",
    composition: row.composition ?? "",
    metersPerKg: row.metersPerKg != null ? Number(row.metersPerKg) : null,
    priceKgUsd: row.priceKgUsd != null ? Number(row.priceKgUsd) : null,
    priceKgUsdCargo: row.priceKgUsdCargo != null ? Number(row.priceKgUsdCargo) : null,
    priceKgUsdVat: row.priceKgUsdVat != null ? Number(row.priceKgUsdVat) : null,
    priceMeterUahNoVat: row.priceMeterUahNoVat != null ? Number(row.priceMeterUahNoVat) : null,
    priceMeterUahVat: row.priceMeterUahVat != null ? Number(row.priceMeterUahVat) : null,
    priceMeterUahCutVat:
      row.priceMeterUahCutVat != null ? Number(row.priceMeterUahCutVat) : null,
    fabricKindUk: row.fabricKindUk ?? "",
    widthCm: row.widthCm ?? "",
    wholesaleNote: row.wholesaleNote ?? "",
    rollWeightKg: row.rollWeightKg != null ? Number(row.rollWeightKg) : null,
    metersPerRoll: row.metersPerRoll != null ? Number(row.metersPerRoll) : null,
    minWholesaleMeters:
      row.minWholesaleMeters != null ? Number(row.minWholesaleMeters) : null,
    costVatOverride: row.costVatOverride,
  }));

  return (
    <div>
      <PageHeader
        title="Матеріали"
        description="Назва тканини — як у каталозі CRM. Щільність, склад і постачальник — у своїх полях. У розрахунок іде активна собівартість за правилом ПДВ у «Ціноутворенні»."
        actions={
          canCreate && !dbError ? (
            <MaterialCreatePanel
              units={unitOptions}
              suppliers={suppliers}
              fabricGlobals={fabricGlobals}
            />
          ) : null
        }
      />

      {!dbError ? <CatalogHealthBanner tips={healthTips} className="mb-4" /> : null}

      {dbError ? (
        <Banner tone="danger" title="Немає зʼєднання з базою" className="mb-4">
          Перевірте <code>DATABASE_URL</code> у <code>.env.local</code>, потім виконайте{" "}
          <code>npm run db:migrate</code> та <code>npm run db:seed</code>.
        </Banner>
      ) : null}

      <TableCard>
        <TableToolbar
          left={
            <span className="type-caption tabular">
              {filtered.length} з {materials.length}
            </span>
          }
          filters={
            <>
              <SearchField
                placeholder="Пошук: назва, тип тканини, склад, постачальник"
                className="w-80"
              />
              <FilterChips
                paramKey="type"
                options={[
                  { value: "FABRIC", label: "Тканини", count: counts.FABRIC },
                  { value: "OTHER_MATERIAL", label: "Інші", count: counts.OTHER_MATERIAL },
                  { value: "TRIM", label: "Фурнітура", count: counts.TRIM },
                ]}
              />
              <FilterChips
                paramKey="kind"
                options={[
                  { value: "Трикотаж", label: "Трикотаж", count: kindCounts.Трикотаж },
                  { value: "Саржеві", label: "Саржеві", count: kindCounts.Саржеві },
                  { value: "Плащовка", label: "Плащовка", count: kindCounts.Плащовка },
                ]}
              />
              <ResetFilters keys={["q", "type", "kind"]} />
            </>
          }
        />

        <MaterialsTable
          rows={rows}
          units={unitOptions}
          suppliers={suppliers}
          fabricGlobals={fabricGlobals}
          canDelete={canDelete}
          canEdit={canCreate}
          empty={{
            title: dbError
              ? "Дані недоступні"
              : q || type || kind
                ? "Нічого не знайдено"
                : "Каталог порожній",
            description: dbError
              ? undefined
              : q || type || kind
                ? "Змініть запит або скиньте фільтри."
                : "Додайте перший матеріал — він одразу стане доступним у комплектаціях.",
          }}
        />
      </TableCard>
    </div>
  );
}

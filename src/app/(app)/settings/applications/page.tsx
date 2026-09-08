import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { listDecorations } from "@/server/domains/catalog/operations";
import { PageHeader } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import { TableCard, TableToolbar } from "@/components/ui/Table";
import { SearchField, FilterChips, ResetFilters } from "@/components/ui/Filters";
import {
  decorationUnitLabels,
  type DecorationUnit,
} from "@/server/domains/catalog/operation-schemas";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";
import { DecorationCreatePanel } from "./DecorationCreateForm";
import { DecorationsTable, type DecorationsTableRow } from "@/components/catalog/DecorationsTable";

export default async function ApplicationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unit?: string }>;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!accessHas(access, "manageCatalogs")) redirect("/overview");

  const { q, unit } = await searchParams;

  let decorations: Awaited<ReturnType<typeof listDecorations>> = [];
  let dbError = false;

  try {
    decorations = await listDecorations();
  } catch {
    dbError = true;
  }

  const filtered = decorations.filter((row) => {
    const matchesQuery = q ? row.nameUk.toLowerCase().includes(q.toLowerCase()) : true;
    const matchesUnit = unit ? row.calculationUnit === unit : true;
    return matchesQuery && matchesUnit;
  });

  const unitCounts = (Object.keys(decorationUnitLabels) as DecorationUnit[]).map((value) => ({
    value,
    label: decorationUnitLabels[value],
    count: decorations.filter((row) => row.calculationUnit === value).length,
  }));

  const canCreate =
    accessHas(access, "createInlineCatalog") ||
    accessHas(access, "manageCatalogs");
  const canDelete = accessHas(access, "archiveRecords");

  const rows: DecorationsTableRow[] = filtered.map((row) => ({
    id: row.id,
    nameUk: row.nameUk,
    calculationUnit: row.calculationUnit,
    unitLabel:
      decorationUnitLabels[row.calculationUnit as DecorationUnit] ?? row.calculationUnit,
    setupCost: Number(row.setupCost),
    unitRate: Number(row.unitRate),
    note: row.note ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="Нанесення"
        description="Приладка додається один раз на замовлення, тариф — на кожну одиницю. Разом вони формують вартість нанесення в калькуляції."
        actions={canCreate && !dbError ? <DecorationCreatePanel /> : null}
      />

      {dbError ? (
        <Banner tone="danger" title="Не вдалося завантажити нанесення" className="mb-4">
          Перевірте <code>DATABASE_URL</code> і перезапустіть <code>next dev</code> після{" "}
          <code>prisma generate</code>.
        </Banner>
      ) : null}

      <TableCard>
        <TableToolbar
          left={
            <span className="type-caption tabular">
              {filtered.length} з {decorations.length}
            </span>
          }
          filters={
            <>
              <SearchField placeholder="Пошук методу" className="w-56" />
              <FilterChips paramKey="unit" options={unitCounts} />
              <ResetFilters keys={["q", "unit"]} />
            </>
          }
        />

        <DecorationsTable
          rows={rows}
          canDelete={canDelete}
          canEdit={canCreate}
          empty={{
            title: dbError ? "Дані недоступні" : "Методів нанесення ще немає",
            description: dbError
              ? undefined
              : "Додайте метод, щоб використовувати його у виробах.",
            action: canCreate && !dbError ? <DecorationCreatePanel /> : null,
          }}
        />
      </TableCard>
    </div>
  );
}

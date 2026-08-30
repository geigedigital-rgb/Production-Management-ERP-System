import { notFound } from "next/navigation";
import { getOrder } from "@/server/domains/orders/service";
import { prisma } from "@/server/db/client";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import {
  PrintDocChip,
  PrintDocChips,
  PrintDocColumns,
  PrintDocHeader,
  PrintDocMeta,
  PrintDocMuted,
  PrintDocSection,
  PrintDocSignatures,
  PrintDocTable,
  PrintDocument,
} from "@/components/print/PrintDocument";
import { formatDateUk, formatMoneyUah, formatUnit } from "@/lib/utils";
import { lineNeedOnSizes } from "@/lib/size-bom";

type SpecSnapshot = {
  item?: {
    nameUk?: string;
    totalQuantity?: number;
    sizes?: Array<{ sizeCode?: string; sizeNameUk: string; quantity: number }>;
    materials?: Array<{
      nameSnapshot: string;
      unitCodeSnapshot: string;
      consumptionPerUnit: string | number;
      wastePercent: string | number;
      sizeCode?: string | null;
      materialId?: string | null;
    }>;
    operations?: Array<{ nameSnapshot: string; calculationMethod: string }>;
    decorations?: Array<{ nameSnapshot: string }>;
  };
};

export default async function SpecificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { id } = await params;
  const { item: itemParam } = await searchParams;
  const [order, company] = await Promise.all([getOrder(id), prisma.companySettings.findFirst()]);
  if (!order) notFound();

  const item =
    (itemParam ? order.items.find((row) => row.id === itemParam) : null) ??
    order.items.find((row) => row.specification) ??
    order.items[0];
  const specification = item?.specification;
  if (!item || !specification) notFound();

  const lockedVersion = item.versions.find((row) => row.id === specification.calculationVersionId);
  const snapshot = specification.snapshotJson as SpecSnapshot;
  const snap = snapshot?.item ?? {};
  const materials = snap.materials ?? [];
  const operations = snap.operations ?? [];
  const decorations = snap.decorations ?? [];
  const sizes = snap.sizes ?? [];
  const quantity = snap.totalQuantity ?? item.totalQuantity;
  const companyName = company?.legalName ?? "Виробнича компанія";
  const productName = snap.nameUk ?? item.nameUk;
  const runningTitle = `Специфікація ${order.number} · ${productName}`;
  const companyLines = [company?.address, company?.phone].filter((line): line is string => Boolean(line));

  return (
    <>
      <PrintToolbar
        backHref={`/orders/${order.id}?tab=files`}
        title={`Специфікація ${order.number}`}
      />

      <PrintDocument runningTitle={runningTitle}>
        <PrintDocHeader
          companyName={companyName}
          companyLines={companyLines.length > 0 ? companyLines : undefined}
          docType="Специфікація для виробництва"
          docNumber={order.number}
          docMeta={[
            productName,
            `Зафіксовано ${formatDateUk(specification.lockedAt)}`,
            "Документ незмінний",
          ]}
        />

        <PrintDocMeta
          cols={3}
          columns={[
            {
              label: "Замовник",
              content: (
                <p>
                  <strong>{order.client.companyName}</strong>
                </p>
              ),
            },
            {
              label: "Замовлення",
              content: (
                <p>
                  <strong>{order.number}</strong>
                </p>
              ),
            },
            {
              label: "Дедлайн",
              content: (
                <p>
                  <strong>{formatDateUk(order.deadline)}</strong>
                </p>
              ),
            },
          ]}
        />

        <PrintDocSection title={`Кількість за розмірами — разом ${quantity} шт`}>
          {sizes.length === 0 ? (
            <PrintDocMuted>Без розмірної сітки</PrintDocMuted>
          ) : (
            <PrintDocChips>
              {sizes.map((size) => (
                <PrintDocChip key={size.sizeNameUk}>
                  {size.sizeNameUk}: <strong>{size.quantity}</strong>
                </PrintDocChip>
              ))}
            </PrintDocChips>
          )}
        </PrintDocSection>

        <PrintDocSection title="Матеріали та норми витрати" breakable>
          <PrintDocTable
            head={
              <tr>
                <th>Матеріал</th>
                <th className="num">Норма / од.</th>
                <th className="num">Відходи</th>
                <th className="num">Потреба на партію</th>
              </tr>
            }
            rows={
              <>
                {materials.map((material, index) => {
                  const consumption = Number(material.consumptionPerUnit);
                  const waste = Number(material.wastePercent);
                  const siblings = materials.map((row, rowIndex) => ({
                    id: String(rowIndex),
                    groupKey: row.materialId ?? row.nameSnapshot,
                    sizeCode: row.sizeCode ?? null,
                  }));
                  const need = lineNeedOnSizes(
                    {
                      id: String(index),
                      groupKey: material.materialId ?? material.nameSnapshot,
                      sizeCode: material.sizeCode ?? null,
                      consumption,
                      waste,
                    },
                    siblings,
                    sizes.map((size) => ({
                      sizeCode: size.sizeCode ?? "",
                      quantity: size.quantity,
                    })),
                  );
                  return (
                    <tr key={`${material.nameSnapshot}-${index}`}>
                      <td>
                        {material.nameSnapshot}
                        {material.sizeCode ? (
                          <span className="print-doc-item-sub">{material.sizeCode}</span>
                        ) : null}
                      </td>
                      <td className="num">
                        {consumption} {formatUnit(material.unitCodeSnapshot)}
                      </td>
                      <td className="num">{waste}%</td>
                      <td className="num">
                        <strong>
                          {need.toFixed(3)} {formatUnit(material.unitCodeSnapshot)}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </>
            }
          />
        </PrintDocSection>

        <PrintDocSection title="Технологічна карта">
          <PrintDocColumns>
            <div>
              <h3 className="print-doc-section-title">Операції</h3>
              <ol className="print-doc-list">
                {operations.map((operation, index) => (
                  <li key={`${operation.nameSnapshot}-${index}`}>{operation.nameSnapshot}</li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="print-doc-section-title">Нанесення</h3>
              {decorations.length === 0 ? (
                <PrintDocMuted>Не використовується</PrintDocMuted>
              ) : (
                <ul className="print-doc-list-plain">
                  {decorations.map((decoration, index) => (
                    <li key={`${decoration.nameSnapshot}-${index}`}>{decoration.nameSnapshot}</li>
                  ))}
                </ul>
              )}
            </div>
          </PrintDocColumns>
        </PrintDocSection>

        <PrintDocSection>
          <div className="print-doc-summary">
            <div>
              <p className="print-doc-label">Планова собівартість партії</p>
              <p className="print-doc-summary-value">
                {lockedVersion ? formatMoneyUah(Number(lockedVersion.totalCost)) : "—"}
              </p>
              {lockedVersion ? (
                <PrintDocMuted>версія v{lockedVersion.versionNumber}</PrintDocMuted>
              ) : null}
            </div>
            <PrintDocSignatures
              items={[
                { label: `Менеджер · ${order.manager.name}` },
                { label: "Виробництво" },
              ]}
            />
          </div>
        </PrintDocSection>
      </PrintDocument>
    </>
  );
}

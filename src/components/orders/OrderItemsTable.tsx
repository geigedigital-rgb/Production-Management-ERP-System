"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/Page";
import {
  Table,
  TableCard,
  TableToolbar,
  TBody,
  TD,
  TFoot,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { IconProducts, IconTrash } from "@/components/ui/Icons";
import { formatMoneyUah, cn } from "@/lib/utils";
import { itemNeedLabel, itemNeedTone, type ItemNeed } from "@/lib/order-corridor";
import { removeOrderItemAction } from "@/server/domains/orders/actions";
import { AddOrderItemPanel, type AddableProduct } from "@/components/orders/AddOrderItemPanel";

export type OrderItemRow = {
  id: string;
  nameUk: string;
  quantity: number;
  sizeRun?: string;
  materialsCount: number;
  operationsCount: number;
  decorationsCount: number;
  versionLabel: string;
  unitPrice: number | null;
  need: ItemNeed;
  sourceProductId: string | null;
};

export function OrderItemsTable({
  orderId,
  activeTab,
  selectedId,
  locked,
  handedOver,
  rows,
  catalog,
  showPrices = true,
}: {
  orderId: string;
  activeTab: string;
  selectedId: string;
  locked?: boolean;
  handedOver?: boolean;
  rows: OrderItemRow[];
  catalog: AddableProduct[];
  showPrices?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);

  function select(id: string) {
    router.push(`/orders/${orderId}?tab=${activeTab}&item=${id}`);
  }

  function remove(row: OrderItemRow) {
    if (rows.length <= 1) return;
    if (!window.confirm(`Прибрати «${row.nameUk}» із цього замовлення?`)) return;
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", row.id);
    const fallback = rows.find((item) => item.id !== row.id)?.id;
    startTransition(async () => {
      const result = await removeOrderItemAction(formData);
      if (!result.ok) return;
      if (fallback) {
        router.push(`/orders/${orderId}?tab=${activeTab}&item=${fallback}`);
      }
      router.refresh();
    });
  }

  return (
    <TableCard>
      <TableToolbar
        left={
          <div className="min-w-0">
            <p className="type-subsection">Позиції замовлення</p>
            <p className="type-caption mt-0.5">
              Кожен рядок — окремий виріб. Натисніть рядок, щоб переглянути або змінити склад.
            </p>
          </div>
        }
        right={
          locked ? (
            <span className="type-caption">Зафіксовано</span>
          ) : (
            <AddOrderItemPanel orderId={orderId} products={catalog} />
          )
        }
      />
      <Table>
        <THead>
          <TH width="36px">#</TH>
          <TH>Виріб</TH>
          <TH align="right">К-сть</TH>
          <TH>Склад</TH>
          <TH>Версія</TH>
          {showPrices ? <TH align="right">Ціна / од.</TH> : null}
          <TH>Стан</TH>
          {!locked ? <TH width="44px" /> : null}
        </THead>
        <TBody>
          {rows.map((row, index) => {
            const active = row.id === selectedId;
            const state = handedOver ? "У виробництві" : itemNeedLabel[row.need];
            const tone = handedOver ? "neutral" : itemNeedTone(row.need);
            return (
              <TR
                key={row.id}
                onClick={() => select(row.id)}
                className={cn(
                  active && "bg-[var(--color-tint-sage)] hover:bg-[var(--color-tint-sage)]",
                )}
              >
                <TD numeric className="text-[var(--color-text-tertiary)]">
                  {index + 1}
                </TD>
                <TD>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)]">{row.nameUk}</p>
                    {row.sizeRun ? (
                      <p className="type-caption tabular">{row.sizeRun}</p>
                    ) : null}
                    {row.sourceProductId ? (
                      <Link
                        href={`/products/${row.sourceProductId}`}
                        onClick={(event) => event.stopPropagation()}
                        className="type-caption text-[var(--color-primary-700)] hover:underline"
                      >
                        Еталон у довіднику
                      </Link>
                    ) : (
                      <p className="type-caption">Без еталона</p>
                    )}
                  </div>
                </TD>
                <TD numeric nowrap>
                  {row.quantity} шт
                </TD>
                <TD nowrap className="text-[var(--color-text-secondary)]">
                  {row.materialsCount} мат. · {row.operationsCount} оп.
                  {row.decorationsCount > 0 ? ` · ${row.decorationsCount} нан.` : ""}
                </TD>
                <TD nowrap className="text-[var(--color-text-secondary)]">
                  {row.versionLabel}
                </TD>
                {showPrices ? (
                  <TD numeric nowrap>
                    {row.unitPrice != null ? formatMoneyUah(row.unitPrice) : "—"}
                  </TD>
                ) : null}
                <TD>
                  <StatusBadge tone={tone} dot>
                    {state}
                  </StatusBadge>
                </TD>
                {!locked ? (
                  <TD>
                    {rows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={`Прибрати ${row.nameUk}`}
                        className="text-[var(--color-text-tertiary)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          remove(row);
                        }}
                      >
                        <IconTrash size={14} />
                      </Button>
                    ) : null}
                  </TD>
                ) : null}
              </TR>
            );
          })}
        </TBody>
        <TFoot>
          <TR>
            <TD colSpan={2} className="font-medium">
              Разом у замовленні
            </TD>
            <TD numeric nowrap className="font-semibold">
              {totalQty} шт
            </TD>
            <TD colSpan={(showPrices ? 4 : 3) + (locked ? 0 : 1)} />
          </TR>
        </TFoot>
      </Table>
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 px-3.5 py-4 type-caption">
          <IconProducts size={16} />
          Позицій ще немає — додайте виріб з каталогу.
        </div>
      ) : null}
    </TableCard>
  );
}

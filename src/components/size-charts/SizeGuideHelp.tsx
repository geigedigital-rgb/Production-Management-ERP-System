"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { cn } from "@/lib/utils";
import {
  getSizeGuideForVariant,
  type SizeGuidePayload,
  type SizeGuideTable,
} from "@/server/domains/size-charts/size-instructions";

function GuideTableView({ table }: { table: SizeGuideTable }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--color-border)]">
      <Table>
        <THead>
          {table.columns.map((col) => (
            <TH key={col.key}>{col.label}</TH>
          ))}
        </THead>
        <TBody>
          {table.rows.map((row) => (
            <TR key={row.size}>
              {table.columns.map((col) => (
                <TD
                  key={col.key}
                  className={cn(col.key === "size" && "font-semibold tabular-nums")}
                >
                  {row.cells[col.key] ?? "—"}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

export function SizeGuideBody({
  guide,
  hideHeadline,
}: {
  guide: SizeGuidePayload;
  hideHeadline?: boolean;
}) {
  const [tableId, setTableId] = useState(guide.tables[0]?.id ?? "");
  const active =
    guide.tables.find((row) => row.id === tableId) ?? guide.tables[0] ?? null;

  useMemo(() => {
    if (!guide.tables.some((row) => row.id === tableId)) {
      setTableId(guide.tables[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.variantCode]);

  return (
    <div className="space-y-3">
      {!hideHeadline ? (
        <p className="text-[14px] font-semibold text-[var(--color-text)]">{guide.headline}</p>
      ) : null}

      {guide.tables.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
          {guide.tables.map((table) => {
            const on = table.id === active?.id;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => setTableId(table.id)}
                className={cn(
                  "rounded-[6px] px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                  on
                    ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]",
                )}
              >
                {table.title}
              </button>
            );
          })}
        </div>
      ) : active ? (
        <p className="text-[13px] font-medium text-[var(--color-text)]">{active.title}</p>
      ) : null}

      {active?.note ? (
        <p className="type-caption text-[var(--color-text-quiet)]">{active.note}</p>
      ) : null}

      {active ? <GuideTableView table={active} /> : null}
    </div>
  );
}

/** Ecommerce-style «Як підібрати розмір?» — modal with measurement tables. */
export function SizeGuideHelpButton({
  variantCode,
  variantName,
  className,
}: {
  variantCode?: string | null;
  variantName?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => getSizeGuideForVariant(variantCode), [variantCode]);
  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline",
          className,
        )}
      >
        Як підібрати розмір
        {variantName ? (
          <span className="font-normal text-[var(--color-text-quiet)]">· {variantName}</span>
        ) : null}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Таблиця розмірів"
        width="lg"
        footer={
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Зрозуміло
          </Button>
        }
      >
        <SizeGuideBody guide={guide} />
      </Modal>
    </>
  );
}

/** Inline guide for settings (one table at a time via tabs). */
export function SizeGuideInline({
  variantCode,
  fallbackNote,
}: {
  variantCode?: string | null;
  fallbackNote?: string | null;
}) {
  const guide = useMemo(() => getSizeGuideForVariant(variantCode), [variantCode]);
  if (!guide) {
    if (!fallbackNote?.trim()) return null;
    return (
      <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
        <p className="type-caption text-[var(--color-text-secondary)]">{fallbackNote}</p>
      </div>
    );
  }
  return <SizeGuideBody key={guide.variantCode} guide={guide} hideHeadline />;
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Overlay";
import { SoftBusy } from "@/components/ui/SoftBusy";
import {
  Table,
  TableCard,
  TableToolbar,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { SizeGuideInline } from "@/components/size-charts/SizeGuideHelp";
import {
  saveSizeChartVariantAction,
  saveVariantSizesAction,
} from "@/server/domains/size-charts/actions";
import { cn } from "@/lib/utils";

export type SizeChartSizeRow = {
  id?: string;
  code: string;
  nameUk: string;
  descriptionUk: string;
  sortOrder: number;
  status?: string;
};

export type SizeChartVariantRow = {
  id: string;
  code: string;
  nameUk: string;
  description: string | null;
  sortOrder: number;
  status: string;
  sizes: SizeChartSizeRow[];
  productCount: number;
};

function emptySize(sortOrder: number): SizeChartSizeRow {
  return { code: "", nameUk: "", descriptionUk: "", sortOrder };
}

function sizesFromVariant(row: SizeChartVariantRow): SizeChartSizeRow[] {
  return row.sizes
    .filter((size) => size.status !== "ARCHIVED")
    .map((size) => ({
      id: size.id,
      code: size.code,
      nameUk: size.nameUk,
      descriptionUk: size.descriptionUk ?? "",
      sortOrder: size.sortOrder,
    }));
}

export function SizeChartsAdminPanel({
  variants: initialVariants,
}: {
  variants: SizeChartVariantRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variants, setVariants] = useState(initialVariants);
  const [selectedId, setSelectedId] = useState(initialVariants[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [panel, setPanel] = useState<"guide" | "edit">("guide");
  const [createOpen, setCreateOpen] = useState(false);
  const [variantDraft, setVariantDraft] = useState({
    nameUk: "",
    code: "",
    description: "",
  });

  const selected = useMemo(
    () => variants.find((row) => row.id === selectedId) ?? null,
    [variants, selectedId],
  );

  const [sizeDrafts, setSizeDrafts] = useState<SizeChartSizeRow[]>(() =>
    initialVariants[0] ? sizesFromVariant(initialVariants[0]) : [],
  );

  function selectVariant(row: SizeChartVariantRow) {
    setSelectedId(row.id);
    setPanel("guide");
    setSizeDrafts(sizesFromVariant(row));
    setError(null);
    setMessage(null);
  }

  useMemo(() => {
    setVariants(initialVariants);
    const stillThere = initialVariants.some((row) => row.id === selectedId);
    if (!stillThere && initialVariants[0]) {
      selectVariant(initialVariants[0]);
      return;
    }
    const current = initialVariants.find((row) => row.id === selectedId);
    if (current && panel === "guide") {
      setSizeDrafts(sizesFromVariant(current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVariants]);

  function addVariant() {
    setError(null);
    if (!variantDraft.nameUk.trim()) {
      setError("Вкажіть назву варіанту сітки.");
      return;
    }
    const formData = new FormData();
    formData.set("nameUk", variantDraft.nameUk.trim());
    if (variantDraft.code.trim()) formData.set("code", variantDraft.code.trim());
    if (variantDraft.description.trim()) {
      formData.set("description", variantDraft.description.trim());
    }
    formData.set("sortOrder", String(variants.length + 1));
    startTransition(async () => {
      const result = await saveSizeChartVariantAction(formData);
      if (!result.ok) {
        setError(
          result.error === "DUPLICATE_CODE"
            ? "Такий код варіанту вже є."
            : result.error === "NAME_REQUIRED"
              ? "Вкажіть назву."
              : "Не вдалося зберегти варіант.",
        );
        return;
      }
      setVariantDraft({ nameUk: "", code: "", description: "" });
      setCreateOpen(false);
      setMessage("Варіант додано.");
      router.refresh();
    });
  }

  function saveSizes() {
    if (!selected) return;
    setError(null);
    const formData = new FormData();
    formData.set("variantId", selected.id);
    formData.set(
      "sizesJson",
      JSON.stringify(
        sizeDrafts
          .filter((row) => row.code.trim())
          .map((row, index) => ({
            code: row.code.trim(),
            nameUk: row.nameUk.trim() || row.code.trim(),
            descriptionUk: row.descriptionUk.trim() || null,
            sortOrder: index + 1,
          })),
      ),
    );
    startTransition(async () => {
      const result = await saveVariantSizesAction(formData);
      if (!result.ok) {
        setError(
          result.error === "DUPLICATE_CODE"
            ? "Коди розмірів у варіанті мають бути унікальні."
            : "Не вдалося зберегти розміри.",
        );
        return;
      }
      setMessage("Розміри збережено.");
      router.refresh();
    });
  }

  const activeVariants = variants.filter((row) => row.status === "ACTIVE");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)] lg:items-start">
      {/* Left: variant list only */}
      <TableCard className="overflow-visible">
        <TableToolbar
          left={<span className="type-label">Варіанти сітки</span>}
          right={
            <Button type="button" size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
              + Новий
            </Button>
          }
        />
        <ul className="max-h-[min(70vh,36rem)] space-y-0.5 overflow-y-auto p-2">
          {activeVariants.map((row) => {
            const active = row.id === selectedId;
            const count = row.sizes.filter((s) => s.status !== "ARCHIVED").length;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => selectVariant(row)}
                  className={cn(
                    "flex w-full flex-col rounded-[8px] px-2.5 py-2 text-left transition-colors",
                    active
                      ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                      : "hover:bg-[var(--color-surface-subtle)]",
                  )}
                >
                  <span className="text-[13px] font-medium leading-snug">{row.nameUk}</span>
                  <span className="mt-0.5 type-caption text-[var(--color-text-quiet)]">
                    {count} розм. · {row.productCount} вир.
                  </span>
                </button>
              </li>
            );
          })}
          {activeVariants.length === 0 ? (
            <li className="px-2.5 py-4 type-caption">Ще немає варіантів.</li>
          ) : null}
        </ul>
      </TableCard>

      {/* Right: guide / editor */}
      <SoftBusy busy={pending} className="min-w-0">
        <TableCard>
          {!selected ? (
            <div className="px-3.5 py-8 text-center type-caption">
              Оберіть варіант сітки зліва.
            </div>
          ) : (
            <>
              <TableToolbar
                left={
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--color-text)]">
                      {selected.nameUk}
                    </p>
                  </div>
                }
                right={
                  <div className="inline-flex rounded-[8px] border border-[var(--color-border)] p-0.5">
                    <button
                      type="button"
                      onClick={() => setPanel("guide")}
                      className={cn(
                        "rounded-[6px] px-2.5 py-1 text-[12.5px] font-medium",
                        panel === "guide"
                          ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]",
                      )}
                    >
                      Підбір
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel("edit")}
                      className={cn(
                        "rounded-[6px] px-2.5 py-1 text-[12.5px] font-medium",
                        panel === "edit"
                          ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]",
                      )}
                    >
                      Редагувати
                    </button>
                  </div>
                }
              />

              <div className="space-y-3 p-3.5">
                {error ? <Banner tone="danger">{error}</Banner> : null}
                {message ? <Banner tone="success">{message}</Banner> : null}

                {panel === "guide" ? (
                  <SizeGuideInline
                    variantCode={selected.code}
                    fallbackNote="Немає готової таблиці підбору — перейдіть у «Редагувати» і додайте розміри."
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="type-caption">
                      Код і назва показуються у виробі. Опис — текстова підказка, якщо немає
                      стандартної таблиці підбору.
                    </p>
                    <div className="overflow-hidden rounded-[8px] border border-[var(--color-border)]">
                      <Table>
                        <THead>
                          <TH className="w-[6.5rem]">Код</TH>
                          <TH className="w-[8rem]">Назва</TH>
                          <TH>Опис / інструкція</TH>
                          <TH className="w-10" />
                        </THead>
                        <TBody>
                          {sizeDrafts.map((row, index) => (
                            <TR key={`${row.id ?? "new"}-${index}`}>
                              <TD className="py-1.5 align-top">
                                <input
                                  className="h-8 w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] outline-none focus:border-[var(--color-primary-500)]"
                                  value={row.code}
                                  onChange={(event) => {
                                    const code = event.target.value;
                                    setSizeDrafts((prev) => {
                                      const next = [...prev];
                                      next[index] = {
                                        ...row,
                                        code,
                                        nameUk: row.nameUk || code,
                                      };
                                      return next;
                                    });
                                  }}
                                />
                              </TD>
                              <TD className="py-1.5 align-top">
                                <input
                                  className="h-8 w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] outline-none focus:border-[var(--color-primary-500)]"
                                  value={row.nameUk}
                                  onChange={(event) => {
                                    const nameUk = event.target.value;
                                    setSizeDrafts((prev) => {
                                      const next = [...prev];
                                      next[index] = { ...row, nameUk };
                                      return next;
                                    });
                                  }}
                                />
                              </TD>
                              <TD className="py-1.5 align-top">
                                <textarea
                                  rows={2}
                                  className="w-full resize-y rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12.5px] leading-snug outline-none focus:border-[var(--color-primary-500)]"
                                  value={row.descriptionUk}
                                  placeholder="Обхвати / підказка"
                                  onChange={(event) => {
                                    const descriptionUk = event.target.value;
                                    setSizeDrafts((prev) => {
                                      const next = [...prev];
                                      next[index] = { ...row, descriptionUk };
                                      return next;
                                    });
                                  }}
                                />
                              </TD>
                              <TD className="py-1.5 text-center align-top">
                                <button
                                  type="button"
                                  className="text-[13px] text-[var(--color-text-quiet)] hover:text-[var(--color-danger)]"
                                  onClick={() =>
                                    setSizeDrafts((prev) =>
                                      prev.filter((_, i) => i !== index),
                                    )
                                  }
                                  aria-label="Прибрати рядок"
                                >
                                  ×
                                </button>
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          setSizeDrafts((prev) => [...prev, emptySize(prev.length + 1)])
                        }
                      >
                        + Розмір
                      </Button>
                      <Button type="button" size="sm" disabled={pending} onClick={saveSizes}>
                        {pending ? "Збереження…" : "Зберегти розміри"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </TableCard>
      </SoftBusy>

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setError(null);
        }}
        title="Новий варіант сітки"
        description="Після створення додайте розміри в режимі «Редагувати»."
        width="sm"
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Скасувати
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={addVariant}>
              {pending ? "Збереження…" : "Додати варіант"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && createOpen ? <Banner tone="danger">{error}</Banner> : null}
          <Input
            label="Назва"
            value={variantDraft.nameUk}
            onChange={(event) =>
              setVariantDraft((prev) => ({ ...prev, nameUk: event.target.value }))
            }
            placeholder="Напр. Жіноча EU"
            autoFocus
          />
          <Input
            label="Код"
            optional
            value={variantDraft.code}
            onChange={(event) =>
              setVariantDraft((prev) => ({ ...prev, code: event.target.value }))
            }
            placeholder="Авто з назви"
          />
          <Input
            label="Короткий опис"
            optional
            value={variantDraft.description}
            onChange={(event) =>
              setVariantDraft((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormGroup, Textarea } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { SmartCard, SmartCardMeta } from "@/components/ui/SmartCard";
import { SplitWorkspace } from "@/components/layout/SplitWorkspace";
import { IconCheckCircle, IconCircle } from "@/components/ui/Icons";
import { createProductAction } from "@/server/domains/products/actions";
import { cn } from "@/lib/utils";

export function ProductCreateForm({ sizes }: { sizes: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  function toggleSize(id: string) {
    setSelectedSizes((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProductAction(formData);
      if (!result.ok) {
        setError("Заповніть назву виробу.");
        return;
      }
      router.push(`/products/${result.productId}`);
      router.refresh();
    });
  }

  const ready = name.trim().length > 0;

  return (
    <form action={onSubmit}>
      <SplitWorkspace
        left={
          <SmartCard
            title="Картка виробу"
            subtitle="Крок 1 — ідентифікація та розмірна сітка"
            meta={
              <>
                <SmartCardMeta label="Назва" value={name.trim() || "—"} />
                <SmartCardMeta label="Розмірів" value={selectedSizes.length} />
              </>
            }
          >
            <div className="space-y-5">
              <FormGroup label="Ідентифікація" columns={2}>
                <Input
                  name="nameUk"
                  label="Назва виробу"
                  required
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Костюм робочий"
                />
                <Input name="internalCode" label="Внутрішній код" placeholder="Необовʼязково" />
                <Textarea
                  name="description"
                  label="Короткий опис"
                  className="sm:col-span-2"
                  placeholder="Призначення, склад, особливості моделі"
                />
              </FormGroup>

              <FormGroup
                label="Розмірна сітка"
                description="Впливає на розподіл кількості у замовленні. Можна залишити порожньою."
                columns={1}
              >
                <div className="flex flex-wrap gap-1.5">
                  {sizes.length === 0 ? (
                    <p className="type-body-secondary">
                      Розміри ще не заведені — виріб буде створено без розмірної сітки.
                    </p>
                  ) : (
                    sizes.map((size) => {
                      const active = selectedSizes.includes(size.id);
                      return (
                        <label
                          key={size.id}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                            active
                              ? "border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]"
                              : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]",
                          )}
                        >
                          <input
                            type="checkbox"
                            name="sizeIds"
                            value={size.id}
                            checked={active}
                            onChange={() => toggleSize(size.id)}
                            className="h-3.5 w-3.5 accent-[var(--color-primary-600)]"
                          />
                          {size.label}
                        </label>
                      );
                    })
                  )}
                </div>
              </FormGroup>

              {error ? <Banner tone="danger">{error}</Banner> : null}
            </div>
          </SmartCard>
        }
        right={
          <div className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="type-subsection">Що буде далі</h2>
              <p className="type-caption mt-0.5">Комплектація — після створення картки</p>
            </div>

            <ol className="space-y-2.5 px-4 py-3">
              {[
                { label: "Створити картку виробу", done: ready },
                { label: "Додати матеріали та норми витрати", done: false },
                { label: "Додати операції та нанесення", done: false },
                { label: "Отримати розрахунковий прайс", done: false },
              ].map((step, index) => (
                <li key={step.label} className="flex items-start gap-2 text-[13.5px]">
                  {step.done ? (
                    <IconCheckCircle size={16} className="mt-0.5 text-[var(--color-success-text)]" />
                  ) : (
                    <IconCircle size={16} className="mt-0.5 text-[var(--color-text-tertiary)]" />
                  )}
                  <span className={index === 0 ? "" : "text-[var(--color-text-secondary)]"}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3">
              <Button type="submit" disabled={pending || !ready} className="flex-1">
                {pending ? "Створення…" : "Створити і відкрити"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/products")}
                disabled={pending}
              >
                Скасувати
              </Button>
            </div>
          </div>
        }
      />
    </form>
  );
}

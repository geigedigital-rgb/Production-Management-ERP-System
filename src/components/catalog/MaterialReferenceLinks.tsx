"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconClose, IconPlus } from "@/components/ui/Icons";
import { materialLinkLabel, normalizeMaterialUrl } from "@/lib/material-links";

/** Editable list of clickable material reference URLs. */
export function MaterialReferenceLinks({
  name = "referenceUrlsJson",
  value,
  onChange,
}: {
  name?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addLink() {
    const normalized = normalizeMaterialUrl(draft);
    if (!normalized) {
      setError("Вкажіть коректне посилання (https://…)");
      return;
    }
    if (value.includes(normalized)) {
      setError("Таке посилання вже додано");
      return;
    }
    onChange([...value, normalized]);
    setDraft("");
    setError(null);
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <p className="type-label">Посилання</p>
      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((url) => (
            <li
              key={url}
              className="flex items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-1.5"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
                title={url}
              >
                {materialLinkLabel(url)}
              </a>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                aria-label="Видалити посилання"
                onClick={() => onChange(value.filter((item) => item !== url))}
              >
                <IconClose size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-caption">Немає посилань · додайте прайс / каталог постачальника</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="Нове посилання"
          optional
          value={draft}
          placeholder="https://…"
          error={error ?? undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addLink();
            }
          }}
          className="min-w-[14rem] flex-1"
        />
        <Button type="button" variant="secondary" size="sm" onClick={addLink}>
          <IconPlus size={14} />
          Додати
        </Button>
      </div>
    </div>
  );
}

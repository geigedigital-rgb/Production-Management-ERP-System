import { cn } from "@/lib/utils";
import { swatchForColorLabel } from "@/lib/trim-colors";

/** Color swatch when chosen; pulsing «?» while manager choices are still pending. */
export function DraftColorSlotMarker({
  value,
  attention = false,
  attentionTitle,
}: {
  value: string | null | undefined;
  attention?: boolean;
  attentionTitle?: string;
}) {
  const label = value?.trim();
  const swatch = label ? swatchForColorLabel(label) : null;

  if (!attention && !swatch) return null;

  return (
    <span className="mt-1 flex shrink-0 items-center gap-1">
      {swatch ? (
        <span
          className={cn(
            "size-3.5 rounded-full ring-1 ring-black/10",
            swatch.bordered && "border border-[var(--color-border-strong)]",
          )}
          style={{ backgroundColor: swatch.swatch }}
          title={swatch.label}
          aria-label={swatch.label}
        />
      ) : null}
      {attention ? (
        <span
          className={cn(
            "flex size-3.5 items-center justify-center rounded-full border border-[var(--color-warning-text)]/45 bg-[var(--color-warning-bg)] text-[10px] font-bold leading-none text-[var(--color-warning-text)]",
            "animate-choice-pulse",
          )}
          title={attentionTitle ?? "Потрібен вибір"}
          aria-label={attentionTitle ?? "Потрібен вибір"}
          role="status"
        >
          ?
        </span>
      ) : null}
    </span>
  );
}

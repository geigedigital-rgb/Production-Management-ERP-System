import { cn } from "@/lib/utils";
import { hintFor, type UiHint, type UiHintKey } from "@/lib/ui-hints";

type HintContent = UiHint | UiHintKey;

function resolveHint(hint: HintContent): UiHint {
  return typeof hint === "string" ? hintFor(hint) : hint;
}

/**
 * Lightweight branded hover/focus tip.
 * Prefer keys from `ui-hints.ts` so copy stays in one place when logic changes.
 */
export function Hint({
  hint,
  children,
  side = "bottom",
  className,
  maxWidth = 260,
  showTitle = true,
}: {
  hint: HintContent;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
  maxWidth?: number;
  /** Hide when the trigger already shows the same label. */
  showTitle?: boolean;
}) {
  const content = resolveHint(hint);

  return (
    <span className={cn("group/hint relative inline-flex max-w-full", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max -translate-x-1/2 px-1",
          "opacity-0 transition-[opacity,transform] duration-150 ease-out",
          "group-hover/hint:opacity-100 group-focus-within/hint:opacity-100",
          side === "bottom" &&
            "top-[calc(100%+8px)] translate-y-0.5 group-hover/hint:translate-y-0 group-focus-within/hint:translate-y-0",
          side === "top" &&
            "bottom-[calc(100%+8px)] -translate-y-0.5 group-hover/hint:translate-y-0 group-focus-within/hint:translate-y-0",
        )}
        style={{ maxWidth }}
      >
        <span
          className={cn(
            "block rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-2 text-left shadow-[var(--shadow-card)]",
            "ring-1 ring-black/[0.03]",
          )}
        >
          {showTitle ? (
            <span className="block text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
              {content.title}
            </span>
          ) : null}
          <span
            className={cn(
              "block text-[12px] leading-snug text-[var(--color-text-secondary)]",
              showTitle && "mt-0.5",
            )}
          >
            {content.description}
          </span>
        </span>
      </span>
    </span>
  );
}

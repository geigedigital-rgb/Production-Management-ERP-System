import { cn } from "@/lib/utils";
import { orderPipeline, orderStatusHintFor, orderStatusLabel } from "@/lib/order-status";
import { IconCheck } from "@/components/ui/Icons";

const shortLabel: Record<string, string> = {
  DRAFT: "Чернетка",
  CALCULATION: "Розрахунок",
  PENDING_APPROVAL: "Погодження",
  APPROVED: "Погоджено",
  HANDED_TO_PRODUCTION: "Цех",
};

/** Horizontal stepper — sits in the order header, not as a tall side card. */
export function OrderPipeline({
  status,
  nextTitle,
}: {
  status: string;
  nextTitle?: string;
}) {
  const cancelled = status === "CANCELLED";
  const closed = status === "CLOSED";
  const currentIndex = orderPipeline.indexOf(status as (typeof orderPipeline)[number]);
  const effectiveIndex = closed ? orderPipeline.length - 1 : currentIndex;

  return (
    <div className="min-w-0">
      <ol className="flex items-start gap-0">
        {orderPipeline.map((stage, index) => {
          const done = !cancelled && index < effectiveIndex;
          const current = !cancelled && index === effectiveIndex;
          const last = index === orderPipeline.length - 1;

          return (
            <li key={stage} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    done &&
                      "border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-[var(--color-on-primary)]",
                    current && "border-[var(--color-primary-600)] text-[var(--color-primary-700)]",
                    !done &&
                      !current &&
                      "border-[var(--color-border-strong)] text-[var(--color-text-tertiary)]",
                  )}
                >
                  {done ? <IconCheck size={11} /> : index + 1}
                </span>
                <span
                  title={orderStatusHintFor(stage)}
                  className={cn(
                    "max-w-[4.8rem] text-center text-[10.5px] leading-tight",
                    current
                      ? "font-semibold text-[var(--color-text-primary)]"
                      : done
                        ? "text-[var(--color-text-secondary)]"
                        : "text-[var(--color-text-tertiary)]",
                  )}
                >
                  {shortLabel[stage] ?? orderStatusLabel[stage]}
                </span>
              </div>
              {last ? null : (
                <span
                  className={cn(
                    "mt-2.5 h-px min-w-[8px] flex-1",
                    done || current
                      ? "bg-[var(--color-primary-300)]"
                      : "bg-[var(--color-border)]",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
      {cancelled ? (
        <p className="mt-1.5 text-[12px] font-semibold text-[var(--color-danger-text)]">Скасовано</p>
      ) : nextTitle ? (
        <p className="mt-1.5 text-[12px] leading-4 text-[var(--color-text-secondary)]">{nextTitle}</p>
      ) : null}
    </div>
  );
}

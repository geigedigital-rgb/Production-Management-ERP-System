import { cn } from "@/lib/utils";

/**
 * Two-column workspace: formation on the left, catalog or editor on the right.
 * On narrow screens the right panel stacks below.
 */
export function SplitWorkspace({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  if (!right) {
    return <div className={cn("space-y-4", className)}>{left}</div>;
  }

  return (
    <div
      className={cn(
        "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] xl:items-start",
        className,
      )}
    >
      <div className="min-w-0 space-y-4">{left}</div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-[72px] xl:max-h-[calc(100vh-140px)] xl:overflow-y-auto">
        {right}
      </aside>
    </div>
  );
}

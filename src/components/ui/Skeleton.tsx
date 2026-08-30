import { cn } from "@/lib/utils";

/** Base shimmer block for skeleton layouts. */
export function Bone({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse rounded-[8px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Inline spinner for buttons and compact loading states. */
export function Spinner({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70",
        size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
        className,
      )}
    />
  );
}

function SkeletonCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

const TABLE_COL_WIDTHS = ["w-[22%]", "w-[14%]", "w-[10%]", "w-[12%]", "w-[10%]", "w-[14%]"];

export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3" aria-hidden>
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className="h-8 w-48 max-w-full" />
        <Bone className="h-4 w-96 max-w-full" />
      </div>
      {withAction ? <Bone className="h-10 w-40 shrink-0 rounded-[var(--radius-control)]" /> : null}
    </div>
  );
}

export function TableToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5" aria-hidden>
      <Bone className="h-10 w-64 max-w-full rounded-[var(--radius-control)]" />
      <Bone className="h-8 w-20 rounded-[var(--radius-control)]" />
      <Bone className="h-8 w-24 rounded-[var(--radius-control)]" />
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 8,
  columns = 6,
  withHeader = true,
}: {
  rows?: number;
  columns?: number;
  withHeader?: boolean;
}) {
  return (
    <>
      {withHeader ? (
        <div className="flex h-11 items-center gap-4 border-b border-[var(--color-divider)] px-4">
          {Array.from({ length: columns }).map((_, index) => (
            <Bone key={index} className={cn("h-3.5", TABLE_COL_WIDTHS[index % TABLE_COL_WIDTHS.length])} />
          ))}
        </div>
      ) : null}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex h-12 items-center gap-4 border-b border-[var(--color-divider)] px-4 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, col) => (
            <Bone key={col} className={cn("h-4", TABLE_COL_WIDTHS[col % TABLE_COL_WIDTHS.length])} />
          ))}
        </div>
      ))}
    </>
  );
}

/** List page: header + filter toolbar + table. */
export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton />
      <SkeletonCard>
        <TableToolbarSkeleton />
        <TableRowsSkeleton rows={rows} />
      </SkeletonCard>
    </div>
  );
}

/** Side panel form while fetching detail. */
export function SidePanelSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      {Array.from({ length: sections }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Bone className="h-4 w-28" />
          <Bone className="h-10 w-full rounded-[var(--radius-control)]" />
          <div className="grid grid-cols-2 gap-3">
            <Bone className="h-10 w-full rounded-[var(--radius-control)]" />
            <Bone className="h-10 w-full rounded-[var(--radius-control)]" />
          </div>
          <Bone className="h-14 w-full rounded-[var(--radius-control)]" />
        </div>
      ))}
    </div>
  );
}

/** Global search dropdown while fetching. */
export function SearchDropdownSkeleton() {
  return (
    <div className="py-1.5" aria-busy="true" aria-live="polite">
      {Array.from({ length: 3 }).map((_, group) => (
        <div key={group} className="px-3 py-1">
          <Bone className="mb-2 h-3 w-20" />
          {Array.from({ length: 2 }).map((_, row) => (
            <div key={row} className="flex items-center gap-2.5 py-2">
              <Bone className="size-4 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Bone className="h-3.5 w-[68%]" />
                <Bone className="h-3 w-[42%]" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Order card page with header facts, items table and tab content. */
export function OrderDetailPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2" aria-hidden>
        <Bone className="h-4 w-24" />
        <Bone className="h-3 w-3 rounded-full" />
        <Bone className="h-4 w-36" />
      </div>

      <SkeletonCard className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="space-y-2">
            <Bone className="h-7 w-72 max-w-full" />
            <Bone className="h-4 w-52 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Bone className="h-9 w-28 rounded-[var(--radius-control)]" />
            <Bone className="h-9 w-32 rounded-[var(--radius-control)]" />
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--color-divider)] lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-1.5 border-b border-[var(--color-divider)] p-3.5 sm:border-b-0 sm:border-r last:border-r-0"
            >
              <Bone className="h-3 w-16" />
              <Bone className="h-4 w-24" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard>
        <TableRowsSkeleton rows={3} columns={5} />
      </SkeletonCard>

      <div className="flex flex-wrap items-end justify-between gap-3" aria-hidden>
        <div className="space-y-1.5">
          <Bone className="h-3 w-32" />
          <Bone className="h-5 w-56 max-w-full" />
        </div>
        <Bone className="h-9 w-72 max-w-full rounded-[var(--radius-control)]" />
      </div>

      <SkeletonCard>
        <TableRowsSkeleton rows={7} columns={5} />
      </SkeletonCard>
    </div>
  );
}

/** Product / client detail card. */
export function ObjectDetailPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2" aria-hidden>
        <Bone className="h-4 w-20" />
        <Bone className="h-3 w-3 rounded-full" />
        <Bone className="h-4 w-40" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Bone className="h-8 w-64 max-w-full" />
          <Bone className="h-4 w-48 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-28 rounded-[var(--radius-control)]" />
          <Bone className="h-9 w-32 rounded-[var(--radius-control)]" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={index} className="p-4">
            <Bone className="h-3 w-20" />
            <Bone className="mt-2 h-7 w-16" />
          </SkeletonCard>
        ))}
      </div>

      <SkeletonCard>
        <TableRowsSkeleton rows={5} columns={4} />
      </SkeletonCard>
    </div>
  );
}

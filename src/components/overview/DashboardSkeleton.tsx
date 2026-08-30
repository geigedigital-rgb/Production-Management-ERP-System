import { Bone } from "@/components/ui/Skeleton";

function SectionShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Bone className="h-[38px] w-[280px] rounded-[10px]" />
          <Bone className="h-5 w-[360px] max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-10 w-[228px] rounded-[9px]" />
          <Bone className="h-10 w-[168px]" />
          <Bone className="h-10 w-[176px]" />
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] xl:grid-cols-4 xl:h-[104px]">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-[104px] items-center gap-3 px-[22px] py-[18px]"
          >
            <Bone className="size-9 shrink-0 rounded-[10px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-[18px] w-[120px]" />
              <Bone className="h-[34px] w-[88px] rounded-[10px]" />
              <Bone className="h-4 w-[140px]" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[7fr_5fr] min-[1440px]:grid-cols-[8fr_4fr]">
        <SectionShell className="h-[236px] p-5">
          <Bone className="h-6 w-[280px]" />
          <div className="mt-4 flex h-[132px] gap-0">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex min-w-[128px] flex-1 flex-col px-3.5 py-1">
                <Bone className="h-[18px] w-16" />
                <Bone className="mt-2 h-[30px] w-10 rounded-[10px]" />
                <Bone className="mt-2 h-[18px] w-20" />
                <Bone className="mt-2 h-1.5 w-full rounded-[3px]" />
                <Bone className="mt-2 h-4 w-12" />
              </div>
            ))}
          </div>
        </SectionShell>
        <SectionShell className="h-[236px]">
          <div className="flex h-8 items-center justify-between px-[18px] pt-4">
            <Bone className="h-6 w-[160px]" />
            <Bone className="h-4 w-6" />
          </div>
          <div className="mt-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex h-11 items-center gap-2 px-[18px]">
                <Bone className="size-[18px] rounded-full" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Bone className="h-[14px] w-[70%]" />
                  <Bone className="h-3 w-[40%]" />
                </div>
                <Bone className="h-[30px] w-[86px]" />
              </div>
            ))}
          </div>
        </SectionShell>
      </div>

      <SectionShell>
        <div className="flex h-12 items-center justify-between border-b border-[var(--color-divider)] px-4">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-28" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-12 items-center gap-4 border-b border-[var(--color-divider)] px-4 last:border-b-0"
          >
            <Bone className="h-4 w-[22%]" />
            <Bone className="h-4 w-[12%]" />
            <Bone className="h-4 w-[8%]" />
            <Bone className="h-4 w-[12%]" />
            <Bone className="h-4 w-[10%]" />
            <Bone className="h-4 w-[14%]" />
          </div>
        ))}
      </SectionShell>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, block) => (
          <SectionShell key={block} className="p-[18px]">
            <Bone className="h-6 w-48" />
            <div className="mt-4 space-y-0">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex h-12 items-center gap-3">
                  <Bone className="h-4 w-8" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Bone className="h-4 w-[70%]" />
                    <Bone className="h-3 w-[50%]" />
                  </div>
                </div>
              ))}
            </div>
          </SectionShell>
        ))}
      </div>
    </div>
  );
}

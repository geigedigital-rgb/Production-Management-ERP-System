"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { IconPlus } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { dashboardQuery } from "@/app/(app)/overview/dashboard-model";
import type { DashboardRange } from "@/app/(app)/overview/dashboard-model";

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
  { id: "quarter", label: "Квартал" },
];

export function DashboardToolbar({
  range,
  managerId,
  focus,
  managers,
}: {
  range: DashboardRange;
  managerId: string | null;
  focus: string;
  managers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="inline-flex h-10 items-center rounded-[9px] border border-[#E1E6E3] bg-[#FAFBFA] p-1">
        {RANGES.map((item) => {
          const on = range === item.id;
          return (
            <Link
              key={item.id}
              href={dashboardQuery({ range: item.id, managerId, focus })}
              className={cn(
                "inline-flex h-8 items-center rounded-[8px] px-3 text-[14px] font-semibold transition-colors duration-150",
                on
                  ? "bg-white text-[#17212B] shadow-[0_1px_2px_rgba(18,32,25,0.04)]"
                  : "text-[#66717D] hover:text-[#17212B]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <Select
        size="md"
        value={managerId ?? ""}
        onChange={(event) =>
          router.push(
            dashboardQuery({
              range,
              managerId: event.target.value || null,
              focus,
            }),
          )
        }
        className="w-[168px]"
        options={[
          { value: "", label: "Усі менеджери" },
          ...managers.map((manager) => ({ value: manager.id, label: manager.name })),
        ]}
      />

      <Link href="/orders/new" className="btn-primary h-10 px-[18px]">
        <IconPlus size={18} />
        Нове замовлення
      </Link>
    </div>
  );
}

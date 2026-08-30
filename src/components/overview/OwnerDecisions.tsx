"use client";

import { useState } from "react";
import Link from "next/link";
import { SidePanel } from "@/components/ui/Overlay";
import { IconAlert, IconCheck, IconCheckCircle, IconChevronRight } from "@/components/ui/Icons";
import { cn, formatMoneyShort } from "@/lib/utils";
import type { OwnerDecision } from "@/server/domains/overview/dashboard";

export function OwnerDecisions({ decisions }: { decisions: OwnerDecision[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = decisions.find((row) => row.id === openId) ?? null;

  return (
    <section className="flex h-[236px] flex-col overflow-hidden rounded-[12px] border border-[#E1E6E3] bg-white shadow-[0_1px_2px_rgba(18,32,25,0.04)]">
      <div className="flex h-8 shrink-0 items-center justify-between px-[18px] pt-4">
        <h2 className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-[#17212B]">
          Рішення власника
        </h2>
        <span className="tabular text-[12px] leading-4 text-[#66717D]">{decisions.length}</span>
      </div>

      {decisions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-4">
          <IconCheckCircle size={18} className="text-[#2F805B]" />
          <p className="text-center text-[13px] leading-[18px] text-[#66717D]">
            Рішень, що блокують роботу, немає
          </p>
        </div>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 overflow-y-auto px-0">
          {decisions.map((row) => (
            <li key={row.id} className="border-t border-[#E7EBE9] first:border-t-0">
              <div className="flex h-11 items-center gap-2 px-[18px]">
                <span
                  className={cn(
                    "grid w-7 shrink-0 place-items-center",
                    row.tone === "danger" && "text-[#C84236]",
                    row.tone === "warning" && "text-[#B87516]",
                    row.tone === "success" && "text-[#2F805B]",
                  )}
                >
                  {row.tone === "success" ? <IconCheck size={18} /> : <IconAlert size={18} />}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenId(row.id)}
                  className="min-w-0 flex-1 rounded-[8px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69A98A]"
                >
                  <span className="block truncate text-[14px] leading-5 font-medium text-[#17212B]">
                    {row.title}
                  </span>
                  <span className="block truncate text-[12px] leading-4 text-[#66717D]">
                    {row.context}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenId(row.id)}
                  className="inline-flex h-[30px] min-w-[86px] shrink-0 items-center justify-center rounded-[8px] border border-[#E1E6E3] px-2.5 text-[13px] font-semibold text-[#17212B] transition-colors duration-150 ease-out hover:bg-[#FAFBFA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69A98A]"
                >
                  {row.actionLabel}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SidePanel
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open?.title ?? "Рішення"}
        description={open ? `${open.number} · ${open.clientName}` : undefined}
        width="sm"
        footer={
          open ? (
            <Link href={open.href} className="btn-primary">
              {open.actionLabel}
              <IconChevronRight size={16} />
            </Link>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-3">
            <p className="text-[14px] leading-5 text-[#17212B]">
              Сума продажу:{" "}
              <span className="font-semibold tabular">
                {open.amount > 0 ? formatMoneyShort(open.amount) : "—"}
              </span>
            </p>
            <ul className="space-y-2">
              {open.issues.map((issue) => (
                <li key={issue} className="flex gap-2 text-[13px] leading-[18px] text-[#66717D]">
                  <IconAlert size={16} className="mt-0.5 shrink-0 text-[#B87516]" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SidePanel>
    </section>
  );
}

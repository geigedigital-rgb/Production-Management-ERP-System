"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Overlay";
import { StatusBadge } from "@/components/ui/Page";
import {
  Table,
  TableCard,
  TableEmpty,
  TableToolbar,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { IconCheck, IconChevronDown, IconChevronRight, IconLock } from "@/components/ui/Icons";
import { cn, formatDateUk, formatMoneyUah } from "@/lib/utils";
import type { OrderProposalGroup } from "@/lib/order-proposals";
import { approveProposalAction } from "@/server/domains/orders/actions";
import { HandoverDialog, type ReadinessCheck } from "./HandoverDialog";
import { SaveProposalPanel, type ProposalDraftLine } from "./SaveProposalPanel";

export function VersionsTab({
  orderId,
  orderNumber,
  itemCount,
  activeItemName,
  proposals,
  draftLines,
  minimumMarginPercent,
  orderTotalQuantity,
  orderTotalValue,
  status,
  canApprove,
  specificationLockedAt,
  readiness,
  autoSave = false,
  draftDrift = false,
}: {
  orderId: string;
  orderNumber: string;
  itemCount: number;
  activeItemName: string;
  proposals: OrderProposalGroup[];
  draftLines: ProposalDraftLine[];
  minimumMarginPercent: number;
  orderTotalQuantity: number;
  orderTotalValue: number;
  status: string;
  canApprove: boolean;
  specificationLockedAt: string | null;
  readiness: ReadinessCheck[];
  autoSave?: boolean;
  draftDrift?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approveTarget, setApproveTarget] = useState<OrderProposalGroup | null>(null);
  const [expanded, setExpanded] = useState<string | null>(proposals[0]?.key ?? null);
  const [error, setError] = useState<string | null>(null);

  const approved = proposals.find((row) => row.isComplete && row.isApproved);
  const latestComplete = proposals.find((row) => row.isComplete) ?? null;
  const handedOver = status === "HANDED_TO_PRODUCTION";
  const handoverReady = readiness.every((check) => check.done);
  const needsApproval = Boolean(latestComplete) && !approved && canApprove && !handedOver;

  function approve(proposal: OrderProposalGroup) {
    if (proposal.revision == null) return;
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("proposalRevision", String(proposal.revision));
    startTransition(async () => {
      const result = await approveProposalAction(formData);
      if (!result.ok) {
        setError("Не вдалося погодити пропозицію.");
        return;
      }
      setApproveTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {itemCount > 1 ? (
        <Banner tone="info" title={`Замовлення: ${itemCount} позиції`}>
          Пропозиція фіксує ціни всіх виробів разом. Зараз переглядаєте позицію «{activeItemName}» — збереження
          стосується всього замовлення.
        </Banner>
      ) : null}

      {draftDrift && !handedOver ? (
        <Banner tone="warning" title="Поточний розрахунок відрізняється від останньої пропозиції">
          Чернетка змінилась після збереження. Збережіть нову пропозицію, щоб оновити КП для клієнта.
        </Banner>
      ) : null}

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Пропозиції для клієнта</span>}
          right={
            !handedOver ? (
              <SaveProposalPanel
                orderId={orderId}
                lines={draftLines}
                minimumMarginPercent={minimumMarginPercent}
                accent={!needsApproval && !approved}
                defaultOpen={autoSave}
              />
            ) : (
              <span className="type-caption inline-flex items-center gap-1">
                <IconLock size={14} /> Специфікацію зафіксовано
              </span>
            )
          }
        />
        <Table>
          <THead>
            <TH>Пропозиція</TH>
            <TH align="right">Позицій</TH>
            <TH align="right">К-сть</TH>
            <TH align="right">Разом до сплати</TH>
            <TH>Стан</TH>
            <TH width="140px" stickyRight />
          </THead>
          <TBody>
            {proposals.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title="Збережених пропозицій ще немає"
                description="Пропозиція фіксує ціни всіх позицій — саме її побачить клієнт у КП."
              />
            ) : (
              proposals.map((proposal) => {
                const open = expanded === proposal.key;
                const title =
                  proposal.revision != null
                    ? `Пропозиція v${proposal.revision}`
                    : `Позиція v${proposal.lines[0]?.versionNumber ?? "?"}`;
                return (
                  <Fragment key={proposal.key}>
                    <TR>
                      <TD>
                        <button
                          type="button"
                          className="flex items-start gap-2 text-left"
                          onClick={() => setExpanded(open ? null : proposal.key)}
                        >
                          {open ? (
                            <IconChevronDown size={16} className="mt-0.5 shrink-0" />
                          ) : (
                            <IconChevronRight size={16} className="mt-0.5 shrink-0" />
                          )}
                          <span>
                            <span className="font-medium">{title}</span>
                            {proposal.label ? (
                              <span className="ml-1 font-normal text-[var(--color-text-secondary)]">
                                {proposal.label}
                              </span>
                            ) : null}
                            <span className="type-caption mt-0.5 block">
                              {formatDateUk(proposal.createdAt)} · {proposal.authorName}
                            </span>
                          </span>
                        </button>
                      </TD>
                      <TD numeric>{proposal.lines.length}</TD>
                      <TD numeric className="tabular">
                        {proposal.totalQuantity} шт
                      </TD>
                      <TD numeric className="font-medium tabular">
                        {formatMoneyUah(proposal.totalSellingValue)}
                      </TD>
                      <TD nowrap>
                        {!proposal.isComplete ? (
                          <StatusBadge dot tone="warning">
                            Неповна
                          </StatusBadge>
                        ) : proposal.isApproved ? (
                          <StatusBadge dot tone="success">
                            Погоджено
                          </StatusBadge>
                        ) : (
                          <StatusBadge dot>Чернетка</StatusBadge>
                        )}
                      </TD>
                      <TD align="right" stickyRight>
                        {proposal.isComplete && !proposal.isApproved && canApprove && !handedOver ? (
                          <Button
                            size="sm"
                            variant={needsApproval && proposal.key === latestComplete?.key ? "primary" : "secondary"}
                            onClick={() => setApproveTarget(proposal)}
                            hint="approveProposal"
                          >
                            <IconCheck size={14} />
                            Погодити
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                    {open
                      ? proposal.lines.map((line) => (
                          <TR key={`${proposal.key}-${line.id}`} className="bg-[var(--color-surface-subtle)]/50">
                            <TD colSpan={2} className="pl-10 text-[var(--color-text-secondary)]">
                              {line.itemNameUk}
                            </TD>
                            <TD numeric className="tabular">
                              {line.totalQuantity} шт
                            </TD>
                            <TD numeric className="tabular">
                              {formatMoneyUah(line.sellingPricePerUnit)} / од. →{" "}
                              {formatMoneyUah(line.totalSellingValue)}
                            </TD>
                            <TD numeric className={cn("tabular", line.marginPercent < minimumMarginPercent && "text-[var(--color-danger-text)]")}>
                              {line.marginPercent.toFixed(1)}%
                            </TD>
                            <TD />
                          </TR>
                        ))
                      : null}
                  </Fragment>
                );
              })
            )}
          </TBody>
        </Table>
      </TableCard>

      {approved || handedOver ? (
        <div
          className={cn(
            "rounded-[var(--radius-surface)] border p-4",
            handoverReady
              ? "border-[var(--color-primary-200)] bg-[var(--color-tint-sage)]/40"
              : "border-[var(--color-border)] bg-[var(--color-surface)]",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="type-subsection">Передача у виробництво</h3>
              <p className="type-body-secondary mt-0.5 max-w-xl">
                {handedOver
                  ? `Специфікацію зафіксовано ${specificationLockedAt ? formatDateUk(specificationLockedAt) : ""}. Виробництво працює за погодженою пропозицією.`
                  : handoverReady
                    ? `Погоджено пропозицію v${approved!.revision} на ${formatMoneyUah(approved!.totalSellingValue)}. Натисніть «Передати у виробництво».`
                    : `Пропозицію v${approved!.revision} погоджено. Закрийте умови передачі — якщо є нанесення, додайте макет у «Документах».`}
              </p>
            </div>
            {handedOver ? (
              <StatusBadge tone="info">
                <IconLock size={13} />
                <span className="ml-1">Зафіксовано</span>
              </StatusBadge>
            ) : (
              <HandoverDialog
                orderId={orderId}
                orderNumber={orderNumber}
                productName={
                  itemCount > 1 ? `${itemCount} позиції замовлення` : activeItemName
                }
                totalQuantity={orderTotalQuantity}
                totalValue={approved?.totalSellingValue ?? orderTotalValue}
                checks={readiness}
                disabled={!canApprove}
              />
            )}
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title={`Погодити пропозицію v${approveTarget?.revision ?? ""}?`}
        description="Погоджена пропозиція стає основою для КП та специфікації по всіх позиціях"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveTarget(null)} disabled={pending}>
              Скасувати
            </Button>
            <Button
              onClick={() => approveTarget && approve(approveTarget)}
              disabled={pending || approveTarget?.revision == null}
            >
              {pending ? "Погодження…" : "Погодити пропозицію"}
            </Button>
          </>
        }
      >
        {approveTarget ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
              <table className="erp-table w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-table-section-border)]">
                    <th className="px-3 py-2 text-left">Виріб</th>
                    <th className="px-3 py-2 text-right">К-сть</th>
                    <th className="px-3 py-2 text-right">Ціна/од.</th>
                    <th className="px-3 py-2 text-right">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {approveTarget.lines.map((line) => (
                    <tr key={line.id} className="border-b border-[var(--color-divider)]">
                      <td className="px-3 py-2">{line.itemNameUk}</td>
                      <td className="px-3 py-2 text-right tabular">{line.totalQuantity} шт</td>
                      <td className="px-3 py-2 text-right tabular">
                        {formatMoneyUah(line.sellingPricePerUnit)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular">
                        {formatMoneyUah(line.totalSellingValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                      Разом замовлення
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular">
                      {formatMoneyUah(approveTarget.totalSellingValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {approved && approved.key !== approveTarget.key ? (
              <Banner tone="warning" title={`Пропозицію v${approved.revision} буде знято з погодження`}>
                Одночасно погодженою може бути лише одна пропозиція на замовлення.
              </Banner>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

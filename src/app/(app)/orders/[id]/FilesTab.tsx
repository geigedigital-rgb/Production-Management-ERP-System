import Link from "next/link";
import { StatusBadge } from "@/components/ui/Page";
import { Banner } from "@/components/ui/Banner";
import { TableCard, TableToolbar } from "@/components/ui/Table";
import { IconPrint, IconQuote, IconSpec } from "@/components/ui/Icons";
import { formatDateUk } from "@/lib/utils";
import { OrderAttachments, type OrderFileRow } from "@/components/orders/OrderAttachments";

function DocumentRow({
  icon,
  title,
  description,
  status,
  tone,
  href,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
  tone: "neutral" | "success" | "warning";
  href: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-divider)] px-4 py-3 last:border-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="type-body-secondary">{description}</p>
      </div>
      <StatusBadge tone={tone}>{status}</StatusBadge>
      {disabled ? (
        <span className="type-caption whitespace-nowrap">Недоступно</span>
      ) : (
        <Link
          href={href}
          target="_blank"
          className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          <IconPrint size={14} />
          Відкрити
        </Link>
      )}
    </div>
  );
}

export function FilesTab({
  orderId,
  itemId,
  hasApprovedVersion,
  specificationLockedAt,
  needsArtwork,
  files,
  locked,
}: {
  orderId: string;
  itemId?: string;
  hasApprovedVersion: boolean;
  specificationLockedAt: string | null;
  needsArtwork: boolean;
  files: OrderFileRow[];
  locked?: boolean;
}) {
  const itemQuery = itemId ? `?item=${itemId}` : "";
  const artworkReady = !needsArtwork || files.length > 0;

  return (
    <div className="space-y-4">
      {needsArtwork && files.length === 0 ? (
        <Banner tone="warning" title="Перед цехом потрібен макет">
          У замовленні є нанесення. Додайте файл макета кнопкою «Додати файл» нижче — це єдине, що
          треба зробити вручну на цьому кроці.
        </Banner>
      ) : null}

      <TableCard>
        <TableToolbar left={<span className="type-subsection">Документи замовлення</span>} />
        <DocumentRow
          icon={<IconQuote size={18} />}
          title="Комерційна пропозиція"
          description={
            hasApprovedVersion
              ? "Формується з погодженої пропозиції — окремо нічого не заповнюєте"
              : "Стане доступною після погодження пропозиції"
          }
          status={hasApprovedVersion ? "Готово" : "Очікує погодження"}
          tone={hasApprovedVersion ? "success" : "warning"}
          href={`/orders/${orderId}/quotation`}
          disabled={!hasApprovedVersion}
        />
        <DocumentRow
          icon={<IconSpec size={18} />}
          title="Специфікація для виробництва"
          description={
            specificationLockedAt
              ? `Зафіксована ${formatDateUk(specificationLockedAt)} — цех працює за цим знімком`
              : "Сама з’явиться, коли натиснете «Передати у виробництво». Заповнювати форму не треба."
          }
          status={specificationLockedAt ? "Зафіксовано" : "З’явиться після передачі"}
          tone={specificationLockedAt ? "success" : "neutral"}
          href={`/orders/${orderId}/specification${itemQuery}`}
          disabled={!specificationLockedAt}
        />
      </TableCard>

      <TableCard>
        <OrderAttachments orderId={orderId} files={files} locked={locked} />
      </TableCard>

      {hasApprovedVersion && artworkReady && !specificationLockedAt ? (
        <Banner tone="info" title="Специфікацію формувати не потрібно">
          Після «Передати у виробництво» система збереже склад, норми й ціну з погодженої пропозиції.
          Від вас — лише підтвердження передачі.
        </Banner>
      ) : null}
    </div>
  );
}

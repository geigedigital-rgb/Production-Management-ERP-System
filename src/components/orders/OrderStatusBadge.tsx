import { StatusBadge } from "@/components/ui/Page";
import {
  orderStatusHintFor,
  orderStatusLabel,
  orderStatusTone,
} from "@/lib/order-status";

/** Order status pill with hover explanation of meaning and next step. */
export function OrderStatusBadge({
  status,
  dot,
}: {
  status: string;
  dot?: boolean;
}) {
  return (
    <StatusBadge
      dot={dot}
      tone={orderStatusTone[status] ?? "neutral"}
      title={orderStatusHintFor(status)}
    >
      {orderStatusLabel[status] ?? status}
    </StatusBadge>
  );
}

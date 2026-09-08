import { OrderChevronPipeline } from "@/components/orders/OrderWorkspaceLayout";

/** @deprecated Use OrderChevronPipeline — kept as alias for existing imports. */
export function OrderPipeline({
  status,
  nextTitle,
}: {
  status: string;
  nextTitle?: string;
}) {
  return <OrderChevronPipeline status={status} nextTitle={nextTitle} />;
}

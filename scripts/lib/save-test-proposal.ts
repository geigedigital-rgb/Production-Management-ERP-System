import {
  approveProposal,
  saveProposal,
} from "../../src/server/domains/orders/service";

/** Save + approve a single-item or multi-item proposal in smoke/e2e scripts. */
export async function saveAndApproveProposal(input: {
  orderId: string;
  orderItemIds: string[];
  authorId: string;
  label: string;
  discountPercent?: number | null;
}) {
  const result = await saveProposal({
    orderId: input.orderId,
    authorId: input.authorId,
    label: input.label,
    lines: input.orderItemIds.map((orderItemId) => ({
      orderItemId,
      manualSellingPricePerUnit: null,
      discountPercent: input.discountPercent ?? null,
    })),
  });
  await approveProposal(input.orderId, result.proposalRevision, input.authorId);
  return result;
}

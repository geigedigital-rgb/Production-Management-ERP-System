/**
 * Prepare DB + fixture orders for browser E2E.
 * Writes e2e/.auth/test-data.json
 * Run: npx tsx scripts/qa-e2e-prepare.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/server/db/client";
import { TEST_MARKER } from "../prisma/catalog/test-marker";
import { createOrderWithProducts } from "../src/server/domains/orders/service";
import { getProduct } from "../src/server/domains/products/service";
import { saveAndApproveProposal } from "./lib/save-test-proposal";

async function purgeAllOrders(): Promise<number> {
  const orders = await prisma.order.findMany({ select: { id: true } });
  if (orders.length === 0) return 0;

  const orderIds = orders.map((o) => o.id);

  await prisma.$transaction(async (tx) => {
    await tx.quotation.deleteMany({
      where: { calculationVersion: { orderItem: { orderId: { in: orderIds } } } },
    });
    await tx.productionSpecification.deleteMany({
      where: { orderItem: { orderId: { in: orderIds } } },
    });
    await tx.fileAsset.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.activityEvent.deleteMany({
      where: { entityType: "order", entityId: { in: orderIds } },
    });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  return orders.length;
}

function defaultSizes(product: NonNullable<Awaited<ReturnType<typeof getProduct>>>, total: number) {
  const codes =
    product.sizes.length > 0
      ? product.sizes.map((s) => ({ code: s.size.code, nameUk: s.size.nameUk }))
      : [{ code: "ONE", nameUk: "Без розміру" }];

  const base = Math.floor(total / codes.length);
  let rem = total - base * codes.length;
  return codes.map((s) => {
    const q = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    return { sizeCode: s.code, sizeNameUk: s.nameUk, quantity: q };
  });
}

async function main() {
  const removed = await purgeAllOrders();

  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } });
  const client = await prisma.client.findFirst({
    where: { companyName: { contains: TEST_MARKER } },
    orderBy: { companyName: "asc" },
  });
  const product = await prisma.product.findFirst({
    where: { internalCode: "SEED-TS-BASIC", status: "ACTIVE" },
  });

  if (!admin || !client || !product) {
    throw new Error("QA seed data missing — run npm run db:seed");
  }

  const detail = await getProduct(product.id);
  if (!detail) throw new Error("SEED-TS-BASIC detail missing");

  const deadline = new Date(Date.now() + 30 * 86400000);
  const sizes = defaultSizes(detail, 150);

  const lifecycle = await createOrderWithProducts({
    clientId: client.id,
    managerId: admin.id,
    title: "[QA E2E] Lifecycle",
    deadline,
    items: [{ productId: product.id, sizeQuantities: sizes }],
  });

  await saveAndApproveProposal({
    orderId: lifecycle.order.id,
    orderItemIds: [lifecycle.items[0]!.id],
    authorId: admin.id,
    label: "QA E2E base",
  });

  const guardNoVersion = await createOrderWithProducts({
    clientId: client.id,
    managerId: admin.id,
    title: "[QA E2E] Guard no version",
    deadline,
    items: [{ productId: product.id, sizeQuantities: defaultSizes(detail, 80) }],
  });

  const guardApproved = await createOrderWithProducts({
    clientId: client.id,
    managerId: admin.id,
    title: "[QA E2E] Guard no artwork",
    deadline,
    items: [{ productId: product.id, sizeQuantities: defaultSizes(detail, 60) }],
  });

  await saveAndApproveProposal({
    orderId: guardApproved.order.id,
    orderItemIds: [guardApproved.items[0]!.id],
    authorId: admin.id,
    label: "QA guard approved",
  });

  const payload = {
    clientId: client.id,
    productId: product.id,
    lifecycleOrderId: lifecycle.order.id,
    lifecycleOrderNumber: lifecycle.order.number,
    guardNoVersionOrderId: guardNoVersion.order.id,
    guardApprovedOrderId: guardApproved.order.id,
  };

  const outDir = path.join(process.cwd(), "e2e/.auth");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "test-data.json"), JSON.stringify(payload, null, 2));

  console.log(`Purged ${removed} orders. E2E fixtures ready.`);
  console.log(payload);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

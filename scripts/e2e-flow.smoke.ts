/**
 * End-to-end smoke: product → order → version → approve → handover.
 * Run: npx tsx scripts/e2e-flow.smoke.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { createProductDraft } from "../src/server/domains/products/service";
import {
  createOrderWithProducts,
  handOverToProduction,
} from "../src/server/domains/orders/service";
import { buildCalcFromProduct, getPricingDefaults } from "../src/server/domains/calculation/from-entities";
import { getProduct } from "../src/server/domains/products/service";
import { saveAndApproveProposal } from "./lib/save-test-proposal";

type StepResult = { step: string; ok: boolean; detail: string };

const results: StepResult[] = [];
const stamp = Date.now();

function pass(step: string, detail: string) {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}: ${detail}`);
}

function fail(step: string, detail: string): never {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step}: ${detail}`);
  throw new Error(detail);
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } });
  if (!admin) fail("0. Seed", "admin@example.com not found — run npm run db:seed");

  const client = await prisma.client.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!client) fail("0. Seed", "No active client");

  const fabric = await prisma.material.findFirst({
    where: { type: "FABRIC", status: "ACTIVE" },
    include: { unitOfMeasure: true },
  });
  const opCut = await prisma.operation.findFirst({ where: { nameUk: "Розкрій" } });
  const opSew = await prisma.operation.findFirst({ where: { nameUk: "Пошив" } });
  const opPack = await prisma.operation.findFirst({ where: { nameUk: "Пакування" } });
  if (!fabric || !opCut || !opSew || !opPack) {
    fail("0. Seed", "Missing fabric or base operations");
  }

  const sizes = await prisma.size.findMany({
    where: { status: "ACTIVE", code: { in: ["S", "M", "L"] } },
  });
  pass("0. Seed", `client=${client.companyName}, fabric=${fabric.nameUk.slice(0, 30)}…`);

  // --- A. Happy path: full BOM product → order → approve → handover ---
  const product = await createProductDraft({
    nameUk: `[E2E] Футболка тест ${stamp}`,
    internalCode: `E2E-${stamp}`,
    description: "Автотест повного циклу",
    imageUrl: null,
    sizeIds: sizes.map((s) => s.id),
    materials: [{ materialId: fabric.id, consumptionPerUnit: 0.45, wastePercent: 3 }],
    operations: [
      { operationId: opCut.id },
      { operationId: opSew.id },
      { operationId: opPack.id },
    ],
    decorations: [],
  });
  pass("A1. Product create", `id=${product.id}, materials=${product.materials.length}, ops=${product.operations.length}`);

  const fullProduct = await getProduct(product.id);
  if (!fullProduct) fail("A2. Product load", "getProduct returned null");
  const pricing = await getPricingDefaults();
  const calc = buildCalcFromProduct(fullProduct, 100, pricing);
  if (Number(calc.costPerUnit) <= 0) fail("A2. Product calc", "costPerUnit is 0");
  pass("A2. Product calc", `cost/od=${calc.costPerUnit} ₴ @100шт, margin=${calc.marginPercent}%`);

  const { order, items } = await createOrderWithProducts({
    clientId: client.id,
    managerId: admin.id,
    title: `[E2E] Замовлення ${stamp}`,
    deadline: new Date(Date.now() + 14 * 86400000),
    items: [
      {
        productId: product.id,
        sizeQuantities: [
          { sizeCode: "S", sizeNameUk: "S", quantity: 30 },
          { sizeCode: "M", sizeNameUk: "M", quantity: 50 },
          { sizeCode: "L", sizeNameUk: "L", quantity: 20 },
        ],
      },
    ],
  });
  if (order.status !== "CALCULATION") fail("A3. Order create", `status=${order.status}`);
  if (items[0]!.totalQuantity !== 100) fail("A3. Order create", `qty=${items[0]!.totalQuantity}`);
  pass("A3. Order create", `№${order.number}, status=${order.status}, qty=100`);

  const item = items[0]!;
  await saveAndApproveProposal({
    orderId: order.id,
    orderItemIds: [item.id],
    authorId: admin.id,
    label: "E2E v1",
  });
  pass("A4. Save proposal", `order=${order.number}`);

  const approvedOrder = await prisma.order.findUnique({ where: { id: order.id } });
  if (approvedOrder?.status !== "APPROVED") {
    fail("A5. Approve", `status=${approvedOrder?.status}`);
  }
  pass("A5. Approve", `status=APPROVED`);

  await handOverToProduction(order.id, admin.id);
  const handed = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: { include: { specification: true } } },
  });
  if (handed?.status !== "HANDED_TO_PRODUCTION") fail("A6. Handover", `status=${handed?.status}`);
  if (!handed?.items[0]?.specification?.lockedAt) fail("A6. Handover", "spec not locked");
  pass("A6. Handover", `status=HANDED_TO_PRODUCTION, spec locked`);

  // --- B. Draft product (no BOM) still orderable but calc weak ---
  const draftProduct = await createProductDraft({
    nameUk: `[E2E] Чернетка ${stamp}`,
    internalCode: null,
    description: null,
    imageUrl: null,
    sizeIds: [],
    materials: [],
    operations: [{ operationId: opSew.id }],
    decorations: [],
  });
  pass("B1. Draft product", `id=${draftProduct.id}, no materials`);

  const { order: draftOrder } = await createOrderWithProducts({
    clientId: client.id,
    managerId: admin.id,
    items: [
      {
        productId: draftProduct.id,
        sizeQuantities: [{ sizeCode: "ONE", sizeNameUk: "Без розміру", quantity: 10 }],
      },
    ],
  });
  pass("B2. Order from draft product", `№${draftOrder.number}, status=${draftOrder.status}`);

  // --- C. Handover blocked without approved version ---
  try {
    await handOverToProduction(draftOrder.id, admin.id);
    fail("C1. Handover guard", "Should have thrown NO_APPROVED_VERSION");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NO_APPROVED_VERSION")) fail("C1. Handover guard", msg);
    pass("C1. Handover guard", "NO_APPROVED_VERSION ✓");
  }

  // --- D. Decoration requires artwork ---
  const decoration = await prisma.decorationMethod.findFirst({ where: { status: "ACTIVE" } });
  if (decoration) {
    const decoProduct = await createProductDraft({
      nameUk: `[E2E] З друком ${stamp}`,
      internalCode: null,
      description: null,
      imageUrl: null,
      sizeIds: [],
      materials: [{ materialId: fabric.id, consumptionPerUnit: 0.5, wastePercent: 0 }],
      operations: [{ operationId: opSew.id }],
      decorations: [{ decorationMethodId: decoration.id }],
    });

    const { order: decoOrder, items: decoItems } = await createOrderWithProducts({
      clientId: client.id,
      managerId: admin.id,
      items: [
        {
          productId: decoProduct.id,
          sizeQuantities: [{ sizeCode: "ONE", sizeNameUk: "Без розміру", quantity: 50 }],
        },
      ],
    });

    await saveAndApproveProposal({
      orderId: decoOrder.id,
      orderItemIds: [decoItems[0]!.id],
      authorId: admin.id,
      label: "E2E deco",
    });

    try {
      await handOverToProduction(decoOrder.id, admin.id);
      fail("D1. Artwork guard", "Should have thrown NO_ARTWORK");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("NO_ARTWORK")) fail("D1. Artwork guard", msg);
      pass("D1. Artwork guard", "NO_ARTWORK ✓");
    }
  } else {
    pass("D1. Artwork guard", "skipped — no decoration in catalog");
  }

  // --- E. Locked order state ---
  if (handed?.status !== "HANDED_TO_PRODUCTION") fail("E1. Lock state", handed?.status ?? "null");
  pass("E1. Lock state", "HANDED_TO_PRODUCTION confirmed");

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- SUMMARY ---");
  console.log(`Passed: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.error("Failed:", failed);
    process.exit(1);
  }
  console.log("E2E flow smoke test passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

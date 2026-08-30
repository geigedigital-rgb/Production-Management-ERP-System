/**
 * Purge all orders, then run order-flow scenarios on SEED etalon products.
 * Run: npx tsx scripts/order-scenarios.smoke.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db/client";
import {
  addOrderFile,
  createOrderWithProducts,
  handOverToProduction,
} from "../src/server/domains/orders/service";
import { buildCalcFromProduct, getPricingDefaults } from "../src/server/domains/calculation/from-entities";
import { getProduct } from "../src/server/domains/products/service";
import { saveAndApproveProposal } from "./lib/save-test-proposal";

const SEED_CODES = ["SEED-TS-BASIC", "SEED-POLO", "SEED-HOODIE"] as const;

type Row = { id: string; ok: boolean; scenario: string; detail: string };

const report: Row[] = [];

function log(ok: boolean, scenario: string, detail: string) {
  report.push({ id: `${report.length + 1}`, ok, scenario, detail });
  console.log(`${ok ? "✓" : "✗"} [${scenario}] ${detail}`);
}

async function purgeAllOrders(): Promise<number> {
  const orders = await prisma.order.findMany({ select: { id: true, number: true } });
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

async function loadSeedProduct(code: string) {
  const product = await prisma.product.findFirst({
    where: { internalCode: code, status: "ACTIVE" },
    select: { id: true, internalCode: true, nameUk: true },
  });
  if (!product) throw new Error(`Product ${code} not found`);
  const detail = await getProduct(product.id);
  if (!detail) throw new Error(`getProduct failed for ${code}`);
  return detail;
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

async function saveAndApprove(
  orderId: string,
  orderItemId: string,
  authorId: string,
  label: string,
) {
  await saveAndApproveProposal({
    orderId,
    orderItemIds: [orderItemId],
    authorId,
    label,
  });
}

async function attachMockArtwork(orderId: string) {
  await addOrderFile({
    orderId,
    fileName: "mock-artwork.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    storageKey: `test/${orderId}/mock-artwork.png`,
  });
}

async function expectError(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return msg.includes(code);
  }
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } });
  const client = await prisma.client.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!admin || !client) throw new Error("Run npm run db:seed first");

  const removed = await purgeAllOrders();
  log(true, "0. Очистка", `Видалено замовлень: ${removed}`);

  const remaining = await prisma.order.count();
  if (remaining !== 0) log(false, "0. Очистка", `Залишилось ${remaining} замовлень`);
  else log(true, "0. Очистка", "База замовлень порожня");

  const seeds: Record<string, NonNullable<Awaited<ReturnType<typeof getProduct>>>> = {};
  for (const code of SEED_CODES) {
    const p = await loadSeedProduct(code);
    seeds[code] = p;
    const mats = p.materials.length;
    const ops = p.operations.length;
    const dec = p.decorations.length;
    const ok = mats > 0 && ops > 0;
    log(
      ok,
      "V. SEED вироби",
      `${code}: матеріали=${mats}, операції=${ops}, нанесення=${dec}, optimalQty=${p.optimalQty ?? "—"}`,
    );
  }

  // S1 — SEED-TS-BASIC: повний цикл до цеху
  {
    const product = seeds["SEED-TS-BASIC"];
    const { order, items } = await createOrderWithProducts({
      clientId: client.id,
      managerId: admin.id,
      title: "[TEST] S1 Футболка базова",
      deadline: new Date(Date.now() + 10 * 86400000),
      items: [{ productId: product.id, sizeQuantities: defaultSizes(product, 100) }],
    });
    const qty = items[0]!.totalQuantity;
    const calc = buildCalcFromProduct(product, qty, await getPricingDefaults());
    await saveAndApprove(order.id, items[0]!.id, admin.id, "S1 v1");
    let st = (await prisma.order.findUnique({ where: { id: order.id } }))!.status;
    log(st === "APPROVED", "S1 Happy path", `№${order.number} → ${st}, ціна ${calc.sellingPricePerUnit} ₴/од`);

    const blocked = await expectError(() => handOverToProduction(order.id, admin.id), "NO_ARTWORK");
    log(blocked, "S1 Artwork guard", "Handover без макета заблоковано (є нанесення)");

    await attachMockArtwork(order.id);
    await handOverToProduction(order.id, admin.id);
    st = (await prisma.order.findUnique({ where: { id: order.id } }))!.status;
    const spec = await prisma.productionSpecification.findFirst({
      where: { orderItemId: items[0]!.id },
    });
    log(
      st === "HANDED_TO_PRODUCTION" && Boolean(spec?.lockedAt),
      "S1 Handover",
      `№${order.number} → ${st}, spec locked`,
    );
  }

  // S2 — SEED-POLO: великий тираж, cut tiers
  {
    const product = seeds["SEED-POLO"];
    const pricing = await getPricingDefaults();
    const calcSmall = buildCalcFromProduct(product, 30, pricing);
    const calcLarge = buildCalcFromProduct(product, 200, pricing);
    const cutDiff = Number(calcLarge.costPerUnit) < Number(calcSmall.costPerUnit);
    log(
      cutDiff,
      "S2 Cut tiers POLO",
      `30 шт: ${calcSmall.costPerUnit} ₴/од · 200 шт: ${calcLarge.costPerUnit} ₴/од (крій дешевше на великому тиражі)`,
    );

    const { order, items } = await createOrderWithProducts({
      clientId: client.id,
      managerId: admin.id,
      title: "[TEST] S2 Поло конференція",
      items: [{ productId: product.id, sizeQuantities: defaultSizes(product, 180) }],
    });
    await saveAndApprove(order.id, items[0]!.id, admin.id, "S2 v1");
    await attachMockArtwork(order.id);
    await handOverToProduction(order.id, admin.id);
    const st = (await prisma.order.findUnique({ where: { id: order.id } }))!.status;
    log(st === "HANDED_TO_PRODUCTION", "S2 POLO handover", `№${order.number} → ${st}`);
  }

  // S3 — Мультипозиція: одна пропозиція на TS + HOODIE
  {
    const ts = seeds["SEED-TS-BASIC"];
    const hoodie = seeds["SEED-HOODIE"];
    const { order, items } = await createOrderWithProducts({
      clientId: client.id,
      managerId: admin.id,
      title: "[TEST] S3 Мультипозиція",
      items: [
        { productId: ts.id, sizeQuantities: defaultSizes(ts, 80) },
        { productId: hoodie.id, sizeQuantities: defaultSizes(hoodie, 35) },
      ],
    });
    await saveAndApproveProposal({
      orderId: order.id,
      orderItemIds: items.map((row) => row.id),
      authorId: admin.id,
      label: "S3 proposal",
    });
    let st = (await prisma.order.findUnique({ where: { id: order.id } }))!.status;
    log(st === "APPROVED", "S3 Multi-item proposal", `2 позиції → ${st}`);

    await attachMockArtwork(order.id);
    await handOverToProduction(order.id, admin.id);
    st = (await prisma.order.findUnique({ where: { id: order.id } }))!.status;
    log(st === "HANDED_TO_PRODUCTION", "S3 Handover", `№${order.number} → ${st}, 2 позиції`);
  }

  // S4 — Guard: handover без версії
  {
    const product = seeds["SEED-HOODIE"];
    const { order } = await createOrderWithProducts({
      clientId: client.id,
      managerId: admin.id,
      title: "[TEST] S4 Guard no version",
      items: [{ productId: product.id, sizeQuantities: defaultSizes(product, 50) }],
    });
    const blocked = await expectError(() => handOverToProduction(order.id, admin.id), "NO_APPROVED_VERSION");
    log(blocked, "S4 Guard", `№${order.number}: handover без пропозиції заблоковано`);
  }

  // S5 — Guard: approve але без artwork
  {
    const product = seeds["SEED-TS-BASIC"];
    const { order, items } = await createOrderWithProducts({
      clientId: client.id,
      managerId: admin.id,
      title: "[TEST] S5 Guard no artwork",
      items: [{ productId: product.id, sizeQuantities: defaultSizes(product, 60) }],
    });
    await saveAndApprove(order.id, items[0]!.id, admin.id, "S5 v1");
    const blocked = await expectError(() => handOverToProduction(order.id, admin.id), "NO_ARTWORK");
    log(blocked, "S5 Guard", `№${order.number}: handover без макета заблоковано`);
  }

  // S6 — Економіка одиниці HOODIE: qty 1 vs optimal
  {
    const product = seeds["SEED-HOODIE"];
    const pricing = await getPricingDefaults();
    const unit1 = buildCalcFromProduct(product, 1, pricing);
    const atOpt = buildCalcFromProduct(product, product.optimalQty ?? 100, pricing);
    log(
      Number(unit1.costPerUnit) > 0 && Number(atOpt.costPerUnit) > 0,
      "S6 Unit economics",
      `HOODIE: 1 шт = ${unit1.costPerUnit} ₴/од · optimal ${product.optimalQty} = ${atOpt.costPerUnit} ₴/од`,
    );
  }

  const passed = report.filter((r) => r.ok).length;
  const failed = report.filter((r) => !r.ok);
  const testOrders = await prisma.order.count();

  console.log("\n========== ЗВІТ ==========");
  console.log(`Сценаріїв: ${report.length} | OK: ${passed} | FAIL: ${failed.length}`);
  console.log(`Замовлень у БД після тестів: ${testOrders}`);
  if (failed.length) {
    console.log("\nПомилки:");
    for (const row of failed) console.log(`  - ${row.scenario}: ${row.detail}`);
    process.exit(1);
  }
  console.log("\nУсі сценарії пройдено.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * One-shot: remove fake «Постійні витрати» operations and [ТЕСТ] demo ops
 * from catalog + product BOMs (real PV stays in fixed-costs directory).
 */
import "dotenv/config";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { testNameVariants } from "../prisma/catalog/test-marker";

config({ path: ".env.local" });
config({ path: ".env" });

const NAMES = [
  "Вшивання коміра / планки",
  "ВТО",
  "Контроль якості",
  "Контроль якості + пакування",
  "ВТО та пакування",
  "Пошиття основне",
  "Постійні витрати",
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const variants = [...new Set(NAMES.flatMap((n) => testNameVariants(n)))];
  const byName = await prisma.operation.findMany({
    where: { nameUk: { in: variants } },
    select: { id: true, nameUk: true },
  });
  const byPv = await prisma.operation.findMany({
    where: { nameUk: { contains: "остійні витрат", mode: "insensitive" } },
    select: { id: true, nameUk: true },
  });
  const map = new Map<string, string>();
  for (const row of [...byName, ...byPv]) map.set(row.id, row.nameUk);
  const ids = [...map.keys()];

  console.log(
    ids.length
      ? `Deleting ${ids.length} operation(s):\n${[...map.values()].map((n) => `  - ${n}`).join("\n")}`
      : "Nothing to delete.",
  );

  if (ids.length) {
    const productOps = await prisma.productOperation.findMany({
      where: { operationId: { in: ids } },
      select: { id: true },
    });
    const productOpIds = productOps.map((r) => r.id);
    if (productOpIds.length) {
      await prisma.productOperationSizeScope.deleteMany({
        where: { productOperationId: { in: productOpIds } },
      });
      await prisma.productOperationRateTier.deleteMany({
        where: { productOperationId: { in: productOpIds } },
      });
      await prisma.productOperation.deleteMany({ where: { id: { in: productOpIds } } });
      console.log(`Removed from ${productOpIds.length} product BOM line(s).`);
    }

    const orderDeleted = await prisma.orderItemOperation.deleteMany({
      where: {
        OR: [{ operationId: { in: ids } }, { nameSnapshot: { in: variants } }],
      },
    });
    if (orderDeleted.count) {
      console.log(`Removed ${orderDeleted.count} order BOM line(s).`);
    }

    await prisma.operationRateTier.deleteMany({ where: { operationId: { in: ids } } });
    await prisma.operation.deleteMany({ where: { id: { in: ids } } });
    console.log("Catalog rows deleted.");
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

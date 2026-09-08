/**
 * Upsert typical sewing-thread TRIM into the live catalog.
 *
 * Usage: npx tsx scripts/upsert-sewing-thread.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const THREAD_NAME = "Нитки · Швейні поліестер · 40/2 · ~3650 м";
const THREAD_COLORS = ["чорний", "білий", "сірий", "темно-синій", "бежевий"];

async function main() {
  const { prisma } = await import("../src/server/db/client");

  const unit =
    (await prisma.unitOfMeasure.findUnique({ where: { code: "cone" } })) ??
    (await prisma.unitOfMeasure.create({
      data: { code: "cone", nameUk: "бобіна", status: "ACTIVE" },
    }));

  let category = await prisma.category.findFirst({
    where: { kind: "TRIM", nameUk: { equals: "Нитки", mode: "insensitive" } },
  });
  if (!category) {
    category = await prisma.category.create({
      data: { kind: "TRIM", nameUk: "Нитки", status: "ACTIVE" },
    });
  }

  const legacyNames = [
    "Нитки · Швейні · 40/2",
    "Нитки · Швейні · 40/2 · 4000 yd/3650 мп",
    "Нитки поліестер 40/2",
  ];

  const existing =
    (await prisma.material.findFirst({
      where: { nameUk: THREAD_NAME, type: "TRIM" },
    })) ??
    (await prisma.material.findFirst({
      where: { nameUk: { in: legacyNames }, type: "TRIM" },
    }));

  const data = {
    nameUk: THREAD_NAME,
    type: "TRIM" as const,
    categoryId: category.id,
    unitOfMeasureId: unit.id,
    purchasePrice: 35,
    defaultWastePercent: 2,
    supplierCode: "Веллтекс",
    colorOrAttribute: "40/2 · ~3650 м",
    availableColors: THREAD_COLORS,
    note: "Швейні поліестер 40/2. Бобіна ≈ 4000 yd / 3650 м. Упаковка від 10 боб. Колір обирається в замовленні.",
    status: "ACTIVE" as const,
  };

  const material = existing
    ? await prisma.material.update({ where: { id: existing.id }, data })
    : await prisma.material.create({ data });

  // Archive other conflicting demo thread names if they differ by id
  for (const nameUk of legacyNames) {
    if (nameUk === material.nameUk) continue;
    await prisma.material.updateMany({
      where: { nameUk, type: "TRIM", id: { not: material.id }, status: "ACTIVE" },
      data: {
        status: "ARCHIVED",
        note: `Архів: замінено на «${THREAD_NAME}»`,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        id: material.id,
        nameUk: material.nameUk,
        type: material.type,
        unit: unit.code,
        unitName: unit.nameUk,
        purchasePrice: Number(material.purchasePrice),
        wastePercent: Number(material.defaultWastePercent),
        supplierCode: material.supplierCode,
        colorOrAttribute: material.colorOrAttribute,
        availableColors: material.availableColors,
        note: material.note,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

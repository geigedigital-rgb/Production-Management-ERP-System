import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../src/server/db/client";
import {
  INTL_WOMEN_VARIANT_DESCRIPTION,
  intlWomenDescriptionUk,
} from "../src/server/domains/size-charts/size-instructions";

const WOMEN_SIZES = [
  { code: "2XS", nameUk: "2XS · 36", sortOrder: 1 },
  { code: "XS", nameUk: "XS · 38", sortOrder: 2 },
  { code: "S", nameUk: "S · 40–42", sortOrder: 3 },
  { code: "M", nameUk: "M · 44–46", sortOrder: 4 },
  { code: "L", nameUk: "L · 48–50", sortOrder: 5 },
  { code: "XL", nameUk: "XL · 52–54", sortOrder: 6 },
  { code: "2XL", nameUk: "2XL · 56–58", sortOrder: 7 },
  { code: "3XL", nameUk: "3XL · 60–62", sortOrder: 8 },
  { code: "4XL", nameUk: "4XL · 64–66", sortOrder: 9 },
  { code: "5XL", nameUk: "5XL · 68–70", sortOrder: 10 },
] as const;

async function main() {
  const variant = await prisma.sizeChartVariant.upsert({
    where: { code: "INTL_WOMEN_UA" },
    create: {
      id: "scv_intl_women_ua",
      code: "INTL_WOMEN_UA",
      nameUk: "Міжнар / Жін. укр.",
      description: INTL_WOMEN_VARIANT_DESCRIPTION,
      sortOrder: 5,
      status: "ACTIVE",
    },
    update: {
      nameUk: "Міжнар / Жін. укр.",
      description: INTL_WOMEN_VARIANT_DESCRIPTION,
      status: "ACTIVE",
      sortOrder: 5,
    },
  });

  for (const size of WOMEN_SIZES) {
    await prisma.size.upsert({
      where: {
        variantId_code: { variantId: variant.id, code: size.code },
      },
      create: {
        variantId: variant.id,
        code: size.code,
        nameUk: size.nameUk,
        descriptionUk: intlWomenDescriptionUk(size.code),
        sortOrder: size.sortOrder,
        status: "ACTIVE",
      },
      update: {
        nameUk: size.nameUk,
        descriptionUk: intlWomenDescriptionUk(size.code),
        sortOrder: size.sortOrder,
        status: "ACTIVE",
      },
    });
  }

  const all = await prisma.sizeChartVariant.findMany({
    where: { status: "ACTIVE" },
    select: {
      code: true,
      nameUk: true,
      _count: { select: { sizes: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { sortOrder: "asc" },
  });
  console.log(
    all
      .map((row) => `${row.code}\t${row.nameUk}\t${row._count.sizes}`)
      .join("\n"),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

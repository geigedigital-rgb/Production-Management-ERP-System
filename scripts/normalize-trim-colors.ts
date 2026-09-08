/**
 * Normalize trim SKUs: peel color from name → availableColors, merge color-only duplicates.
 *
 * Usage: npx tsx scripts/normalize-trim-colors.ts
 */
import { config } from "dotenv";
import {
  mergeColorLists,
  peelColorsFromJoinedName,
  splitColorLabels,
} from "../src/lib/trim-colors";

config({ path: ".env.local" });
config();

async function main() {
  const { prisma } = await import("../src/server/db/client");

  const trims = await prisma.material.findMany({
    where: { type: "TRIM" },
    include: {
      productMaterials: { select: { id: true, productId: true } },
      orderItemMaterials: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  type Bucket = {
    keepId: string;
    baseName: string;
    colors: string[];
    attributes: string | null;
    duplicateIds: string[];
  };

  const buckets = new Map<string, Bucket>();

  for (const row of trims) {
    const peeled = peelColorsFromJoinedName(row.nameUk);
    const attrParts = (row.colorOrAttribute ?? "")
      .split("·")
      .map((p) => p.trim())
      .filter(Boolean);
    let attributes = row.colorOrAttribute;
    let attrColors: string[] = [];
    if (attrParts.length > 0) {
      const last = attrParts[attrParts.length - 1]!;
      const lastColors = splitColorLabels(last);
      if (lastColors.length > 0) {
        attrColors = lastColors;
        attributes = attrParts.slice(0, -1).join(" · ") || null;
      }
    }

    const colors = mergeColorLists(row.availableColors, peeled.colors, attrColors);
    const baseName = peeled.baseName;
    const key = baseName.toLowerCase();

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        keepId: row.id,
        baseName,
        colors,
        attributes,
        duplicateIds: [],
      });
      await prisma.material.update({
        where: { id: row.id },
        data: {
          nameUk: baseName,
          colorOrAttribute: attributes,
          availableColors: colors,
          status: "ACTIVE",
        },
      });
      continue;
    }

    existing.colors = mergeColorLists(existing.colors, colors);
    if (!existing.attributes && attributes) existing.attributes = attributes;
    existing.duplicateIds.push(row.id);

    for (const pm of row.productMaterials) {
      const clash = await prisma.productMaterial.findFirst({
        where: {
          productId: pm.productId,
          materialId: existing.keepId,
          NOT: { id: pm.id },
        },
      });
      if (clash) {
        await prisma.productMaterial.delete({ where: { id: pm.id } });
      } else {
        await prisma.productMaterial.update({
          where: { id: pm.id },
          data: { materialId: existing.keepId },
        });
      }
    }

    if (row.orderItemMaterials.length) {
      await prisma.orderItemMaterial.updateMany({
        where: { materialId: row.id },
        data: { materialId: existing.keepId },
      });
    }

    await prisma.material.update({
      where: { id: row.id },
      data: {
        status: "ARCHIVED",
        note: `Архів: злито з «${baseName}» (колір у availableColors)`,
        availableColors: [],
      },
    });
  }

  for (const bucket of buckets.values()) {
    await prisma.material.update({
      where: { id: bucket.keepId },
      data: {
        nameUk: bucket.baseName,
        colorOrAttribute: bucket.attributes,
        availableColors: bucket.colors,
        status: "ACTIVE",
      },
    });
  }

  const active = await prisma.material.count({ where: { type: "TRIM", status: "ACTIVE" } });
  const archived = await prisma.material.count({ where: { type: "TRIM", status: "ARCHIVED" } });
  const sample = await prisma.material.findMany({
    where: { type: "TRIM", status: "ACTIVE" },
    select: { nameUk: true, availableColors: true },
    take: 12,
    orderBy: { nameUk: "asc" },
  });

  console.log({
    buckets: buckets.size,
    activeTrims: active,
    archivedTrims: archived,
    mergedDuplicates: [...buckets.values()].reduce((n, b) => n + b.duplicateIds.length, 0),
    sample,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

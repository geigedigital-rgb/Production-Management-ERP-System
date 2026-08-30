import { prisma } from "@/server/db/client";

export type CatalogTip = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

/** Labels from CRM fabric sheet rows skipped for missing м.п. price. */
const EXPECTED_MISSING_FABRIC_FRAGMENTS = [
  "Рібана 40/1",
  "Саржа економ",
  "Саржа 100%",
  "Саржа хеві",
  "ЕЛІТ",
  "Оксфорд",
];

function matchesFragment(nameUk: string, fragment: string) {
  return nameUk.toLowerCase().includes(fragment.toLowerCase());
}

/**
 * Live catalog health for contextual banners.
 * Tips disappear once the underlying data issue is resolved.
 * Uses aggregate counts — safe to call on list pages.
 */
export async function getCatalogHealth(): Promise<{
  tips: CatalogTip[];
  stats: {
    productsActive: number;
    productsWithoutBom: number;
    productsWithoutOps: number;
    productsWithoutCutLadder: number;
    fabricsActive: number;
    missingFabricHints: string[];
  };
}> {
  const [
    productsActive,
    productsWithBom,
    productsWithOps,
    productsWithCut,
    productsWithCutAndLadder,
    fabrics,
  ] = await Promise.all([
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({
      where: { status: "ACTIVE", materials: { some: {} } },
    }),
    prisma.product.count({
      where: { status: "ACTIVE", operations: { some: {} } },
    }),
    prisma.product.count({
      where: {
        status: "ACTIVE",
        operations: { some: { operation: { nameUk: { equals: "Розкрій", mode: "insensitive" } } } },
      },
    }),
    prisma.product.count({
      where: {
        status: "ACTIVE",
        optimalQty: { not: null },
        cutRateTiers: { some: {} },
        operations: { some: { operation: { nameUk: { equals: "Розкрій", mode: "insensitive" } } } },
      },
    }),
    prisma.material.findMany({
      where: { status: "ACTIVE", type: "FABRIC" },
      select: { nameUk: true },
    }),
  ]);

  const productsWithoutBom = Math.max(0, productsActive - productsWithBom);
  const productsWithoutOps = Math.max(0, productsActive - productsWithOps);
  const productsWithoutCutLadder = Math.max(0, productsWithCut - productsWithCutAndLadder);

  const missingDisplay = EXPECTED_MISSING_FABRIC_FRAGMENTS.filter(
    (fragment) => !fabrics.some((fabric) => matchesFragment(fabric.nameUk, fragment)),
  ).slice(0, 6);

  const tips: CatalogTip[] = [];

  if (productsWithoutBom > 0) {
    tips.push({
      id: "products-without-bom",
      severity: "critical",
      title: "Немає норм витрати матеріалів",
      detail: `${productsWithoutBom} з ${productsActive} активних виробів без комплектації. Без тканини/фурнітури собівартість занижена — додайте норми в картці виробу.`,
      href: "/products?state=draft",
      hrefLabel: "Вироби без складу",
    });
  }

  if (productsWithoutOps > 0) {
    tips.push({
      id: "products-without-ops",
      severity: "warning",
      title: "Вироби без операцій",
      detail: `${productsWithoutOps} виробів без пошиву/крою/пакування. Додайте операції в картці виробу.`,
      href: "/products",
      hrefLabel: "До виробів",
    });
  }

  if (productsWithoutCutLadder > 0) {
    tips.push({
      id: "cut-ladder-missing",
      severity: "warning",
      title: "Немає сходинок крою",
      detail: `${productsWithoutCutLadder} виробів мають «Розкрій», але без оптимального тиражу або тарифної сітки. У картці виробу — блок «Крій за тиражем».`,
      href: "/products",
      hrefLabel: "До виробів",
    });
  }

  if (missingDisplay.length > 0) {
    tips.push({
      id: "fabrics-not-imported",
      severity: "warning",
      title: "Тканини без ціни в каталозі",
      detail: `Ще немає в базі (у CSV не було ціни за м.п.): ${missingDisplay.join(", ")}. Додайте вручну тут або заповніть ціну в таблиці й пересійте.`,
      href: "/settings/resources",
      hrefLabel: "Матеріали",
    });
  }

  if (fabrics.length === 0) {
    tips.push({
      id: "no-fabrics",
      severity: "critical",
      title: "Немає тканин",
      detail: "Каталог тканин порожній. Додайте матеріали типу «Тканина» з ціною закупівлі.",
      href: "/settings/resources",
      hrefLabel: "Додати матеріали",
    });
  }

  return {
    tips,
    stats: {
      productsActive,
      productsWithoutBom,
      productsWithoutOps,
      productsWithoutCutLadder,
      fabricsActive: fabrics.length,
      missingFabricHints: missingDisplay,
    },
  };
}

export function tipsForPage(
  tips: CatalogTip[],
  page: "materials" | "operations" | "products",
): CatalogTip[] {
  const allow: Record<typeof page, string[]> = {
    materials: ["fabrics-not-imported", "no-fabrics", "products-without-bom"],
    operations: ["cut-ladder-missing", "products-without-ops"],
    products: ["products-without-bom", "products-without-ops", "cut-ladder-missing"],
  };
  return tips.filter((tip) => allow[page].includes(tip.id));
}

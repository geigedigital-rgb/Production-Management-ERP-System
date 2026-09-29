import type { FabricUnitMode } from "@/lib/fabric-pricing";

/** Labels for pack content + purchase quote, driven by BOM consumption unit. */
export function materialPackLabels(unitMode: FabricUnitMode | string) {
  switch (unitMode) {
    case "m":
    case "m2":
      return {
        contentLabel: "Довжина",
        contentHint: "Метрів у пачці / на бобіні · необовʼязково",
        eachQuote: "м",
        packQuote: "уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} м → ціна за м автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть довжину на матеріалі",
        unitSuffixUah: "₴/м",
        unitSuffixUsd: "$/м",
        packSuffixUah: "₴",
        packSuffixUsd: "$",
        derivedHintPack: "ціна за м з упаковки",
        derivedHintKg: "₴/м = ($/кг × курс) / шт/кг",
        showUnitsPerKg: false,
      };
    case "cone":
      return {
        contentLabel: "Од. в упаковці",
        contentHint: "Скільки одиниць у пачці · необовʼязково",
        eachQuote: "од.",
        packQuote: "уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} од. → ціна за од. автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть вміст упаковки на матеріалі",
        unitSuffixUah: "₴/од.",
        unitSuffixUsd: "$/од.",
        packSuffixUah: "₴",
        packSuffixUsd: "$",
        derivedHintPack: "ціна за од. з упаковки",
        derivedHintKg: "₴/од. з $/кг",
        showUnitsPerKg: false,
      };
    case "kg":
      return {
        contentLabel: "Од. в упаковці",
        contentHint: "Скільки одиниць у пачці · необовʼязково",
        eachQuote: "кг",
        packQuote: "уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} од. → ціна за кг автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть вміст упаковки на матеріалі",
        unitSuffixUah: "₴/кг",
        unitSuffixUsd: "$/кг",
        packSuffixUah: "₴",
        packSuffixUsd: "$",
        derivedHintPack: "ціна за кг з упаковки",
        derivedHintKg: "₴/од. з $/кг",
        showUnitsPerKg: false,
      };
    default:
      return {
        contentLabel: "Шт в упаковці",
        contentHint: "Напр. гудзики — 1000 шт · необовʼязково",
        eachQuote: "шт",
        packQuote: "уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} шт → ціна за шт автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть «Шт в упаковці» на матеріалі",
        unitSuffixUah: "₴/шт",
        unitSuffixUsd: "$/шт",
        packSuffixUah: "₴",
        packSuffixUsd: "$",
        derivedHintPack: "ціна за шт з упаковки",
        derivedHintKg: "₴/шт = ($/кг × курс) / шт/кг",
        showUnitsPerKg: true,
      };
  }
}

/** Hide archived/demo units from pickers (бобіна → use м + довжина). */
export function isSelectableMaterialUnit(unit: { label: string; code?: string | null }) {
  const code = String(unit.code ?? "")
    .trim()
    .toLowerCase();
  const label = String(unit.label ?? "")
    .trim()
    .toLowerCase();
  if (code === "cone") return false;
  if (label.includes("бобін")) return false;
  return true;
}

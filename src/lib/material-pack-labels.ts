import type { FabricUnitMode } from "@/lib/fabric-pricing";

/** Labels for pack content + purchase quote, driven by BOM consumption unit. */
export function materialPackLabels(unitMode: FabricUnitMode | string) {
  switch (unitMode) {
    case "m":
    case "m2":
      return {
        contentLabel: "м в бобіні / рулоні",
        contentHint: "Напр. стрічка — 50 м · опційно, якщо купуєте бобіною",
        eachQuote: "₴/м",
        packQuote: "₴/уп.",
        packPriceLabel: "Ціна бобіни",
        packPriceHint: (n: number) => `На ${n} м → ₴/м автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть «м в бобіні» на матеріалі",
        unitSuffix: "₴/м",
        derivedHintPack: "₴/м з бобіни",
        derivedHintKg: "₴/м = ($/кг × курс) / шт/кг",
        showUnitsPerKg: false,
      };
    case "cone":
      return {
        contentLabel: "Од. в бобіні",
        contentHint: "Опційно · якщо купуєте пачкою бобін",
        eachQuote: "₴/боб",
        packQuote: "₴/уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} боб. → ₴/боб автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть вміст упаковки на матеріалі",
        unitSuffix: "₴/боб",
        derivedHintPack: "₴/боб з упаковки",
        derivedHintKg: "₴/од. з $/кг",
        showUnitsPerKg: false,
      };
    case "kg":
      return {
        contentLabel: "Од. в упаковці",
        contentHint: "Опційно · якщо купуєте пачкою",
        eachQuote: "₴/кг",
        packQuote: "₴/уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} од. → ₴/кг автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть вміст упаковки на матеріалі",
        unitSuffix: "₴/кг",
        derivedHintPack: "₴/кг з упаковки",
        derivedHintKg: "₴/од. з $/кг",
        showUnitsPerKg: false,
      };
    default:
      return {
        contentLabel: "Шт в упаковці",
        contentHint: "Напр. гудзики — 1000 шт · опційно",
        eachQuote: "₴/шт",
        packQuote: "₴/уп.",
        packPriceLabel: "Ціна упаковки",
        packPriceHint: (n: number) => `На ${n} шт → ₴/шт автоматично`,
        packPriceEmptyHint: "Спочатку вкажіть «Шт в упаковці» на матеріалі",
        unitSuffix: "₴/шт",
        derivedHintPack: "₴/шт з упаковки",
        derivedHintKg: "₴/шт = ($/кг × курс) / шт/кг",
        showUnitsPerKg: true,
      };
  }
}

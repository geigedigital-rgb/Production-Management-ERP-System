import { formatAmount } from "@/lib/utils";

/** Shared templates for Price&Cut hover tips — numbers filled per row at render time. */
export type TirageFormulaTipInput = {
  qty: number;
  cutRate: number;
  cutTotal: number;
  deliveryRate: number;
  deliveryTotal: number;
  /** Fabric CARGO/NP for the tirage (₴). */
  materialDeliveryTotal?: number;
  /** Editable «Доставка» operation total (₴). */
  opDeliveryTotal?: number;
  deliveryName?: string;
  materials: number;
  sewingTotal: number;
  sewingPerUnit: number;
  other: number;
  /** Concrete BOM op names in the packaging column (e.g. Пакування). */
  otherLineNames?: string[];
  otherHasExtraAdditional?: boolean;
  pv: number;
  cost: number;
  multiplier: number;
  pricePerUnit: number;
  selling: number;
  profit: number;
  marginPercent: number;
};

function money(value: number) {
  return `${formatAmount(value)} ₴`;
}

function perUnit(total: number, qty: number) {
  if (!(qty > 0)) return money(0);
  return money(Math.round((total / qty) * 100) / 100);
}

function otherContentsLine(names: string[] | undefined, hasExtra: boolean | undefined) {
  const parts: string[] = [];
  if (names?.length) parts.push(names.join(", "));
  if (hasExtra) parts.push("додаткові витрати виробу");
  if (parts.length === 0) return "Входить: нічого (сума 0)";
  return `Входить: ${parts.join("; ")}`;
}

/**
 * One tip object per tirage row. Templates live here once — not duplicated per product.
 */
export function buildTirageFormulaTips(input: TirageFormulaTipInput) {
  const {
    qty,
    cutRate,
    cutTotal,
    deliveryRate,
    deliveryTotal,
    materialDeliveryTotal = 0,
    opDeliveryTotal = 0,
    deliveryName = "Доставка",
    materials,
    sewingTotal,
    sewingPerUnit,
    other,
    pv,
    cost,
    multiplier,
    pricePerUnit,
    selling,
    profit,
    marginPercent,
  } = input;

  const costPerUnit = qty > 0 ? Math.round((cost / qty) * 100) / 100 : 0;
  const markupPerUnit = Math.round(sewingPerUnit * Math.max(0, multiplier) * 100) / 100;
  const suggestedPrice = Math.round((costPerUnit + markupPerUnit) * 100) / 100;

  const deliveryLines: string[] = [];
  if (materialDeliveryTotal > 0) {
    deliveryLines.push(
      `Тканини (CARGO/НП): ${perUnit(materialDeliveryTotal, qty)}/шт × ${qty} = ${money(materialDeliveryTotal)}`,
      "кг = метри ÷ м/кг · ₴ = кг × $/кг × курс (тип з комплектації).",
    );
  }
  if (opDeliveryTotal > 0 || deliveryRate > 0) {
    deliveryLines.push(
      `${deliveryName}: ${money(deliveryRate)}/шт × ${qty} шт = ${money(opDeliveryTotal)}`,
    );
  }
  if (materialDeliveryTotal > 0 && (opDeliveryTotal > 0 || deliveryRate > 0)) {
    deliveryLines.push(`Разом доставка: ${money(deliveryTotal)}`);
  }
  if (deliveryLines.length === 0) {
    deliveryLines.push("Доставка 0 ₴ на цей тираж.");
  }

  return {
    cut: [
      `${money(cutRate)}/шт × ${qty} шт = ${money(cutTotal)}`,
      "Поле — ставка за шт, під ним — сума на тираж.",
    ].join("\n"),

    delivery: deliveryLines.join("\n"),

    materials: [
      `${perUnit(materials, qty)}/шт × ${qty} шт = ${money(materials)}`,
      "Закупівля матеріалів з комплектації на тираж.",
      "Тканина — без CARGO/НП (вони в «Достав.»). Фурнітура — з доставкою упаковки в ₴/од.",
    ].join("\n"),

    sewing: [
      `${money(sewingPerUnit)}/шт × ${qty} шт = ${money(sewingTotal)}`,
      "Операція «Пошив». На цю ставку йде множник ×.",
    ].join("\n"),

    other: [
      `${perUnit(other, qty)}/шт × ${qty} шт = ${money(other)}`,
      "Операція «Пакування» з комплектації.",
    ].join("\n"),

    pv: [
      `${perUnit(pv, qty)}/шт × ${qty} шт = ${money(pv)}`,
      `ПВ/шт = пошив/шт ÷ коеф. довідника → ${money(sewingPerUnit)} ÷ коеф.`,
    ].join("\n"),

    cost: [
      [
        money(materials),
        money(cutTotal),
        money(sewingTotal),
        money(deliveryTotal),
        money(other),
        money(pv),
      ].join(" + "),
      `= ${money(cost)}  (${money(costPerUnit)}/шт)`,
    ].join("\n"),

    multiplier: [
      `Націнка/шт = ${money(sewingPerUnit)} × ${multiplier} = ${money(markupPerUnit)}`,
      `Ціна/шт = ${money(costPerUnit)} + ${money(markupPerUnit)} = ${money(suggestedPrice)}`,
    ].join("\n"),

    price: [
      `У прайсі: ${money(pricePerUnit)}/шт`,
      `З ×: ${money(costPerUnit)} + ${money(sewingPerUnit)} × ${multiplier} = ${money(suggestedPrice)}/шт`,
      pricePerUnit !== suggestedPrice ? "У полі зараз інша збережена ціна." : null,
    ]
      .filter(Boolean)
      .join("\n"),

    selling: `${money(pricePerUnit)}/шт × ${qty} шт = ${money(selling)}`,

    profit: `${money(selling)} − ${money(cost)} = ${money(profit)}`,

    margin:
      selling > 0
        ? `${money(profit)} ÷ ${money(selling)} × 100% = ${marginPercent.toFixed(0)}%`
        : "Немає продажу.",
  };
}

/** Header tips. Packaging column gets names from this product’s комплектація. */
export function buildTirageHeaderTips(args?: {
  otherLineNames?: string[];
  otherHasExtraAdditional?: boolean;
  hasMaterialDelivery?: boolean;
  hasDeliveryOp?: boolean;
}) {
  const deliveryBody: string[] = ["Доставка"];
  if (args?.hasMaterialDelivery) {
    deliveryBody.push(
      "Тканини з комплектації: CARGO / НП стандарт / НП обʼємні.",
      "₴/шт і сума на тираж рахуються з витрати (кг × $/кг × курс).",
    );
  }
  if (args?.hasDeliveryOp) {
    deliveryBody.push(
      "Плюс операція «Доставка»: ставка за 1 шт (поле).",
      "Під полем — сума на тираж (матеріали + операція).",
    );
  }
  if (!args?.hasMaterialDelivery && !args?.hasDeliveryOp) {
    deliveryBody.push("Ставка / сума на тираж, коли є доставка матеріалів або операція.");
  }

  return {
    card: ["Картка", "Показувати цей тираж у прайсі на картці виробу."].join("\n"),

    qty: [
      "Тираж",
      "Кількість штук у партії.",
      "У грошових колонках основне — ₴/шт, сіре під ним — сума на тираж.",
    ].join("\n"),

    cut: [
      "Крій",
      "Ставка розкрою за 1 шт.",
      "Під полем — сума на тираж (ставка × кількість).",
    ].join("\n"),

    delivery: deliveryBody.join("\n"),

    materials: [
      "Матеріали",
      "Основне — ₴/шт з комплектації.",
      "Сіре — сума на тираж.",
      "Тканина: опт або роздріб залежно від метрів (без CARGO/НП).",
      "Фурнітура: у ₴/од. вже є доставка упаковки.",
    ].join("\n"),

    sewing: [
      "Пошив",
      "Основне — ставка за 1 шт.",
      "Сіре — сума на тираж.",
      "На пошив/шт навішується множник ×.",
    ].join("\n"),

    other: [
      "Пакування",
      "Основне — ₴/шт, сіре — на тираж.",
      otherContentsLine(args?.otherLineNames, args?.otherHasExtraAdditional),
    ].join("\n"),

    pv: [
      "ПВ",
      "Основне — ПВ за 1 шт, сіре — на тираж.",
      "ПВ/шт = пошив/шт ÷ коефіцієнт з довідника «Постійні витрати».",
    ].join("\n"),

    cost: [
      "Собівартість",
      "Мат + Крій + Пошив + Достав + Пакування + ПВ",
      "Достав. = доставка тканин (CARGO/НП) + операція «Доставка» (якщо є).",
      "Основне — ₴/шт, сіре — сума на тираж.",
    ].join("\n"),

    multiplier: [
      "×",
      "Множник націнки на пошив.",
      "Ціна/шт = собівартість/шт + пошив/шт × коефіцієнт.",
      "Малий тираж — більший ×, великий — менший (×7 … ×4).",
    ].join("\n"),

    price: [
      "Ціна",
      "Поле — ціна клієнту за 1 шт (зберігається в прайсі).",
      "Сіре під ним — продаж на тираж (ціна × кількість).",
    ].join("\n"),

    selling: ["Продаж на тираж", "Ціна/шт × кількість."].join("\n"),

    profit: [
      "Прибуток",
      "Основне — ₴/шт, сіре — на тираж.",
      "Продаж − собівартість.",
    ].join("\n"),

    margin: ["Маржа", "Прибуток ÷ продаж × 100%."].join("\n"),
  } as const;
}

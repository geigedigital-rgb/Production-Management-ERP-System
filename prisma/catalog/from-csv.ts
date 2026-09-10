import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeFabricKind } from "../../src/lib/fabric-kinds";
import { mergeColorLists, splitColorLabels } from "../../src/lib/trim-colors";

export type ParsedFabric = {
  key: string;
  nameUk: string;
  /** Previous seed naming: name · density · supplier — used to rematch existing rows. */
  legacyNameUk: string;
  category: string;
  fabricKindUk: string | null;
  supplier: string | null;
  density: string | null;
  composition: string | null;
  widthCm: string | null;
  metersPerKg: number | null;
  priceKgUsd: number | null;
  priceKgUsdCargo: number | null;
  priceKgUsdVat: number | null;
  priceMeterUahNoVat: number | null;
  priceMeterUahVat: number | null;
  priceMeterUahCutVat: number | null;
  /** Active cost for calc (respects preferred mode later in seed). */
  pricePerMeter: number;
  wholesaleNote: string | null;
  rollWeightKg: number | null;
  metersPerRoll: number | null;
  skipReason?: string;
};

export type ParsedTrim = {
  key: string;
  nameUk: string;
  category: string;
  unitCode: "pcs" | "m" | "cone";
  purchasePrice: number;
  /** Type / size attributes without color. */
  colorOrAttribute: string | null;
  /** Colors for this base SKU (merged across CSV rows that differ only by color). */
  availableColors: string[];
  supplierCode: string | null;
  packNote: string | null;
};

export type ParsedModel = {
  key: string;
  internalCode: string;
  nameUk: string;
  category: string;
  sewRate: number;
  cutRateOptimal: number;
  packRate: number;
  shiftCost: number;
  outputPerShift: number;
  optimalQty: number;
  cutTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  sizeCodes: string[];
};

function catalogPath(file: string) {
  return join(process.cwd(), "prisma", "catalog", "data", file);
}

/** Minimal CSV parser: handles quotes, commas inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseUaNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value || value === "-" || value === "х" || value === "x" || value === "#DIV/0!") {
    return null;
  }
  value = value.replace(/\s/g, "").replace(",", ".");
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const UA_TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "yi",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "yu",
  я: "ya",
  "'": "",
  "’": "",
};

function slugify(input: string) {
  const lower = input.toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += UA_TRANSLIT[ch] ?? ch;
  }
  return out
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function joinParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Sheet globals for meter formulas:
 * - New export: header ends with «доллар…» / «карго…», values on row 1 (cols 17–18).
 * - Legacy: row1 «доллар,45» and row2 «карго,1.7» in cols 0–1.
 * App PricingSettings also stores these; CSV values seed/refresh that config.
 */
function readFabricSheetGlobals(rows: string[][]): {
  usdUah: number;
  cargoUsd: number;
  dataStart: number;
} {
  const header = rows[0] ?? [];
  const dollarCol = header.findIndex((cell) => /доллар/i.test(cell));
  const cargoCol = header.findIndex((cell) => /карго/i.test(cell));

  if (dollarCol >= 0 || cargoCol >= 0) {
    const usdUah =
      parseUaNumber(rows[1]?.[dollarCol]) ??
      parseUaNumber(rows[2]?.[dollarCol]) ??
      45;
    const cargoUsd =
      parseUaNumber(rows[1]?.[cargoCol]) ??
      parseUaNumber(rows[2]?.[cargoCol]) ??
      1.7;
    return { usdUah, cargoUsd, dataStart: 3 };
  }

  return {
    usdUah: parseUaNumber(rows[1]?.[1]) ?? 45,
    cargoUsd: parseUaNumber(rows[2]?.[1]) ?? 1.7,
    dataStart: 3,
  };
}

export function loadFabrics(options?: {
  materialCostVatMode?: "NET" | "GROSS";
}): { fabrics: ParsedFabric[]; skipped: Array<{ name: string; reason: string }>; usdUah: number; cargoUsd: number } {
  const rows = parseCsv(readFileSync(catalogPath("fabrics.csv"), "utf8"));
  const fabrics: ParsedFabric[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  const costMode = options?.materialCostVatMode ?? "NET";

  const { usdUah, cargoUsd, dataStart } = readFabricSheetGlobals(rows);

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]!;
    const fabricKindUk = normalizeFabricKind(row[0]);
    const type = fabricKindUk || row[0] || "Тканина";
    const supplier = row[1] || null;
    const name = row[2];
    if (!name) continue;

    const density = row[3] || null;
    const composition = row[4] || null;
    const metersPerKg = parseUaNumber(row[5]);
    const priceKgUsd = parseUaNumber(row[6]);
    let priceKgUsdCargo = parseUaNumber(row[7]);
    let priceMeterUahNoVat = parseUaNumber(row[8]);
    const priceKgUsdVat = parseUaNumber(row[9]);
    let priceMeterUahVat = parseUaNumber(row[10]);
    const priceMeterUahCutVat = parseUaNumber(row[11]);
    // Column 12 historically «Основний/запасний» — ignored (removed from product model).
    const widthCm = row[13] || null;
    const wholesaleNote = row[14] && row[14] !== "х" && row[14] !== "x" ? row[14] : null;
    const rollWeightKg = parseUaNumber(row[15]);
    let metersPerRoll = parseUaNumber(row[16]);

    // Cargo is additive $/kg from sheet meta (not multiply)
    if (priceKgUsdCargo == null && priceKgUsd != null) {
      priceKgUsdCargo = Math.round((priceKgUsd + cargoUsd) * 10000) / 10000;
    }

    if (
      (priceMeterUahNoVat == null || priceMeterUahNoVat <= 0) &&
      priceKgUsdCargo != null &&
      metersPerKg != null &&
      metersPerKg > 0
    ) {
      priceMeterUahNoVat = Math.round(((priceKgUsdCargo * usdUah) / metersPerKg) * 10) / 10;
    }

    if (
      (priceMeterUahVat == null || priceMeterUahVat <= 0) &&
      priceKgUsdVat != null &&
      metersPerKg != null &&
      metersPerKg > 0
    ) {
      const vatWithCargo = Math.round((priceKgUsdVat + cargoUsd) * 10000) / 10000;
      priceMeterUahVat = Math.round(((vatWithCargo * usdUah) / metersPerKg) * 10) / 10;
    }

    if (
      (metersPerRoll == null || metersPerRoll <= 0) &&
      rollWeightKg != null &&
      metersPerKg != null
    ) {
      metersPerRoll = Math.round(rollWeightKg * metersPerKg * 10) / 10;
    }

    const wholesalePerMeter =
      costMode === "NET"
        ? priceMeterUahNoVat && priceMeterUahNoVat > 0
          ? priceMeterUahNoVat
          : priceMeterUahVat && priceMeterUahVat > 0
            ? priceMeterUahVat
            : null
        : priceMeterUahVat && priceMeterUahVat > 0
          ? priceMeterUahVat
          : priceMeterUahNoVat && priceMeterUahNoVat > 0
            ? priceMeterUahNoVat
            : null;

    // Catalog / base model: conservative cut price when present.
    const pricePerMeter =
      priceMeterUahCutVat && priceMeterUahCutVat > 0
        ? priceMeterUahCutVat
        : wholesalePerMeter;

    if (pricePerMeter == null || pricePerMeter <= 0) {
      skipped.push({ name, reason: "немає ціни за м.п." });
      continue;
    }

    // Name = CSV «Назва тканини» only; density/supplier live in their own fields.
    const nameUk = name.replace(/\s+/g, " ").trim();
    const identityKey = [nameUk, supplier ?? "", density ?? ""]
      .map((part) => part.toLowerCase())
      .join("|");
    if (seen.has(identityKey)) {
      skipped.push({ name: nameUk, reason: "дубль (назва+постачальник+щільність)" });
      continue;
    }
    seen.add(identityKey);

    // Legacy display name used in earlier seeds (for remapping on re-seed)
    const legacyNameUk = joinParts(nameUk, density ? `${density} г/м²` : null, supplier);

    fabrics.push({
      key: identityKey,
      nameUk,
      legacyNameUk,
      category: type.trim() || "Тканина",
      fabricKindUk,
      supplier,
      density,
      composition,
      widthCm,
      metersPerKg,
      priceKgUsd,
      priceKgUsdCargo,
      priceKgUsdVat,
      priceMeterUahNoVat,
      priceMeterUahVat,
      priceMeterUahCutVat,
      pricePerMeter,
      wholesaleNote,
      rollWeightKg,
      metersPerRoll,
    });
  }

  return { fabrics, skipped, usdUah, cargoUsd };
}

export function loadTrims(): { trims: ParsedTrim[]; skipped: Array<{ name: string; reason: string }> } {
  const rows = parseCsv(readFileSync(catalogPath("trims.csv"), "utf8"));
  const byKey = new Map<string, ParsedTrim>();
  const skipped: Array<{ name: string; reason: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const category = row[0] || "Фурнітура";
    const name = row[1];
    if (!name) continue;
    const type = row[2] || null;
    const size = row[3] || null;
    const colorRaw = row[4] || null;
    const unitRaw = (row[5] || "шт").toLowerCase();
    const price = parseUaNumber(row[6]);
    const pack = row[7] || null;
    const supplier = row[8] || null;

    if (price == null || price < 0) {
      skipped.push({ name, reason: "немає ціни" });
      continue;
    }

    let unitCode: ParsedTrim["unitCode"] = "pcs";
    if (unitRaw.startsWith("м")) unitCode = "m";
    else if (unitRaw.includes("боб")) unitCode = "cone";

    const sizePart = size && size !== "-" ? size : null;
    // Base SKU name — without color (colors live in availableColors).
    const nameUk = joinParts(category, name, type, sizePart);
    const key = nameUk.toLowerCase();
    const colors = splitColorLabels(colorRaw);
    const attributes = joinParts(type, sizePart) || null;

    const existing = byKey.get(key);
    if (existing) {
      existing.availableColors = mergeColorLists(existing.availableColors, colors);
      // Keep the first non-null supplier / pack; price stays from first row (same SKU).
      if (!existing.supplierCode && supplier && !supplier.startsWith("http")) {
        existing.supplierCode = supplier;
      }
      if (!existing.packNote && pack) existing.packNote = pack;
      continue;
    }

    byKey.set(key, {
      key,
      nameUk,
      category: category.trim(),
      unitCode,
      purchasePrice: price,
      colorOrAttribute: attributes,
      availableColors: colors,
      supplierCode: supplier && !supplier.startsWith("http") ? supplier : null,
      packNote: pack,
    });
  }

  return { trims: [...byKey.values()], skipped };
}

const CUT_TIER_COLUMNS: Array<{ col: number; qty: number }> = [
  { col: 11, qty: 10 },
  { col: 12, qty: 20 },
  { col: 13, qty: 30 },
  { col: 14, qty: 50 },
  { col: 15, qty: 60 },
  { col: 16, qty: 70 },
  { col: 17, qty: 100 },
  { col: 18, qty: 200 },
  { col: 19, qty: 250 },
];

function buildCutTiers(
  row: string[],
  optimalQty: number,
  cutRateOptimal: number,
): Array<{ minQuantity: number; ratePerUnit: number }> {
  const byQty = new Map<number, number>();

  for (const { col, qty } of CUT_TIER_COLUMNS) {
    const rate = parseUaNumber(row[col]);
    if (rate == null || rate <= 0) continue;
    // Owner rule: ignore sheet cells above optimal — freeze at optimal rate.
    if (qty > optimalQty) continue;
    byQty.set(qty, rate);
  }

  // Always pin optimal run to the declared optimal cut rate (not a lower sheet cell).
  if (optimalQty > 0 && cutRateOptimal > 0) {
    byQty.set(optimalQty, cutRateOptimal);
  }

  return [...byQty.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minQuantity, ratePerUnit]) => ({ minQuantity, ratePerUnit }));
}

export function loadModels(): { models: ParsedModel[]; skipped: Array<{ name: string; reason: string }> } {
  const rows = parseCsv(readFileSync(catalogPath("models.csv"), "utf8"));
  const models: ParsedModel[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();

  // Header spans ~3 lines in the export; first data row starts with "футболка"
  for (const row of rows) {
    const category = (row[0] || "").trim();
    const name = (row[1] || "").trim();
    if (!name) continue;
    // Skip header-ish rows
    if (name.toLowerCase().includes("назва виробу")) continue;
    if (category.toLowerCase().includes("категор")) continue;

    const sewRate = parseUaNumber(row[2]);
    const shiftCost = parseUaNumber(row[3]) ?? 1500;
    const outputPerShift = parseUaNumber(row[4]);
    const optimalQty = Math.round(parseUaNumber(row[8]) ?? 100);
    const cutRateOptimal = parseUaNumber(row[10]) ?? parseUaNumber(row[9]);
    const packRate = parseUaNumber(row[26]) ?? 4;

    if (sewRate == null || sewRate <= 0) {
      skipped.push({ name, reason: "немає вартості пошиву" });
      continue;
    }

    const nameUk = name.replace(/\s+/g, " ").trim();
    const key = nameUk.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ name: nameUk, reason: "дубль" });
      continue;
    }
    seen.add(key);

    const cat = category || "Інше";
    const sizeCodes =
      /дит/i.test(nameUk) ? ["XS", "S", "M", "L"] : ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];
    const cutOptimal =
      cutRateOptimal && cutRateOptimal > 0 ? cutRateOptimal : Math.max(2, Math.round(sewRate * 0.15));

    models.push({
      key,
      internalCode: `CRM-${slugify(cat).slice(0, 12)}-${slugify(nameUk)}`.slice(0, 60),
      nameUk,
      category: cat,
      sewRate,
      cutRateOptimal: cutOptimal,
      packRate: packRate > 0 ? packRate : 4,
      shiftCost,
      outputPerShift: outputPerShift && outputPerShift > 0 ? outputPerShift : 50,
      optimalQty,
      cutTiers: buildCutTiers(row, optimalQty, cutOptimal),
      sizeCodes,
    });
  }

  return { models, skipped };
}

export function findFabric(
  fabrics: ParsedFabric[],
  predicate: (row: ParsedFabric) => boolean,
) {
  return fabrics.find(predicate) ?? null;
}

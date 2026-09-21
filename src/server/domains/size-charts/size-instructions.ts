/**
 * Measurement / sizing instructions for catalog size charts.
 * Source: factory size tables (UA body measures + intl↔UA correspondence).
 */

export const UA_CHEST_VARIANT_DESCRIPTION =
  "Таблиці розмірних ознак (обхвати, см) + визначення зросту за ДСТУ. Жін. базовий зріст 164 см; чол. — 176 см.";

export const UA_HEIGHT_GUIDE = [
  "Зріст (жін.): ДСТУ 146–152 → марк. 1–2 (інтервал 143–154); 158–164 стандарт → 3–4 (155–166); 170–176 → 5–6 (167–178); 182–188 → 7–8 (179–191).",
  "Зріст (чол.): ДСТУ 158–164 → марк. 1–2 (інтервал 155–166); 170–176 стандарт → 3–4 (167–178); 182–188 → 5–6 (179–191); 194–200 → 7–8 (192–203).",
].join(" ");

/** UA numeric size → body measures (cm). Missing gender omitted. */
export const UA_CHEST_SIZE_INSTRUCTIONS: Record<
  string,
  { women?: [number, number, number]; men?: [number, number, number] }
> = {
  "36": { women: [72, 54, 74] },
  "38": { women: [76, 58, 80], men: [76, 64, 78] },
  "40": { women: [80, 62, 86], men: [80, 68, 82] },
  "42": { women: [84, 66, 92], men: [84, 72, 86] },
  "44": { women: [88, 70, 96], men: [88, 78, 90] },
  "46": { women: [92, 74, 100], men: [92, 82, 94] },
  "48": { women: [96, 78, 104], men: [96, 86, 98] },
  "50": { women: [100, 82, 108], men: [100, 90, 102] },
  "52": { women: [104, 86, 112], men: [104, 94, 106] },
  "54": { women: [108, 90, 116], men: [108, 98, 110] },
  "56": { women: [112, 94, 120], men: [112, 104, 114] },
  "58": { women: [116, 98, 124], men: [116, 108, 118] },
  "60": { women: [120, 102, 128], men: [120, 112, 122] },
  "62": { women: [124, 106, 132], men: [124, 116, 126] },
  "64": { women: [128, 110, 136], men: [128, 120, 130] },
  "66": { women: [132, 114, 140], men: [132, 124, 134] },
  "68": { women: [136, 118, 144], men: [136, 128, 138] },
  "70": { women: [140, 122, 148], men: [140, 132, 142] },
};

function formatTriple(label: string, t: [number, number, number]): string {
  return `${label}: груди ${t[0]} · талія ${t[1]} · стегна ${t[2]}`;
}

export function uaChestDescriptionUk(code: string): string | null {
  const row = UA_CHEST_SIZE_INSTRUCTIONS[code];
  if (!row) return null;
  const parts: string[] = [];
  if (row.women) parts.push(formatTriple("Жін. (зріст 164)", row.women));
  if (row.men) parts.push(formatTriple("Чол. (зріст 176)", row.men));
  return parts.join(" · ");
}

export const INTL_MEN_VARIANT_DESCRIPTION =
  "Відповідність міжнар. ↔ укр. (орієнтовна). Базовий зріст — 176 см. Обхвати в см.";

export const INTL_WOMEN_VARIANT_DESCRIPTION =
  "Відповідність міжнар. ↔ укр. (орієнтовна). Базовий зріст — 164 см. Обхвати в см.";

export const INTL_UNISEX_VARIANT_DESCRIPTION =
  "Міжнародні літерні розміри. Орієнтовна відповідність укр. сітці — у описі розміру (чол. / жін.).";

type IntlRow = {
  ua: string;
  chest: string;
  waist: string;
  hips: string;
};

/** International letter → UA range + body measures (cm), men's chart. */
export const INTL_MEN_SIZE_INSTRUCTIONS: Record<string, IntlRow> = {
  "2XS": { ua: "38", chest: "76", waist: "64", hips: "78" },
  XS: { ua: "40", chest: "80", waist: "68", hips: "82" },
  S: { ua: "42–44", chest: "84–88", waist: "72–78", hips: "86–90" },
  M: { ua: "46–48", chest: "92–96", waist: "82–86", hips: "94–98" },
  L: { ua: "50–52", chest: "100–104", waist: "90–94", hips: "102–106" },
  XL: { ua: "54–56", chest: "108–112", waist: "98–104", hips: "110–114" },
  "2XL": { ua: "58–60", chest: "116–120", waist: "108–112", hips: "118–122" },
  "3XL": { ua: "62–64", chest: "124–128", waist: "116–120", hips: "126–130" },
  "4XL": { ua: "66–68", chest: "132–136", waist: "124–128", hips: "134–138" },
  "5XL": { ua: "70–72", chest: "140–144", waist: "132–136", hips: "142–146" },
};

/** Women's chart. */
export const INTL_WOMEN_SIZE_INSTRUCTIONS: Record<string, IntlRow> = {
  "2XS": { ua: "36", chest: "72", waist: "54", hips: "74" },
  XS: { ua: "38", chest: "76", waist: "58", hips: "80" },
  S: { ua: "40–42", chest: "80–84", waist: "62–66", hips: "86–92" },
  M: { ua: "44–46", chest: "88–92", waist: "70–74", hips: "96–100" },
  L: { ua: "48–50", chest: "96–100", waist: "78–82", hips: "104–108" },
  XL: { ua: "52–54", chest: "104–108", waist: "86–90", hips: "112–116" },
  "2XL": { ua: "56–58", chest: "112–116", waist: "94–98", hips: "120–124" },
  "3XL": { ua: "60–62", chest: "120–124", waist: "102–106", hips: "128–132" },
  "4XL": { ua: "64–66", chest: "128–132", waist: "110–114", hips: "136–140" },
  "5XL": { ua: "68–70", chest: "136–140", waist: "118–122", hips: "144–148" },
};

function formatIntl(row: IntlRow, gender: "Чол." | "Жін."): string {
  return `${gender} укр. ${row.ua} · груди ${row.chest} · талія ${row.waist} · стегна ${row.hips}`;
}

export function intlMenDescriptionUk(code: string): string | null {
  const row = INTL_MEN_SIZE_INSTRUCTIONS[code];
  return row ? formatIntl(row, "Чол.") : null;
}

export function intlWomenDescriptionUk(code: string): string | null {
  const row = INTL_WOMEN_SIZE_INSTRUCTIONS[code];
  return row ? formatIntl(row, "Жін.") : null;
}

/** Unisex letter sizes: both gender mappings (no XXL/6XL in correspondence tables). */
export function intlUnisexDescriptionUk(code: string): string | null {
  const normalized = code === "XXL" ? "2XL" : code;
  const men = INTL_MEN_SIZE_INSTRUCTIONS[normalized];
  const women = INTL_WOMEN_SIZE_INSTRUCTIONS[normalized];
  if (!men && !women) return null;
  const parts: string[] = [];
  if (men) parts.push(`Чол. укр. ${men.ua}`);
  if (women) parts.push(`Жін. укр. ${women.ua}`);
  if (men) {
    parts.push(
      `чол. обхвати: груди ${men.chest} · талія ${men.waist} · стегна ${men.hips}`,
    );
  }
  if (women) {
    parts.push(
      `жін. обхвати: груди ${women.chest} · талія ${women.waist} · стегна ${women.hips}`,
    );
  }
  return parts.join(" · ");
}

export const KIDS_HEIGHT_VARIANT_DESCRIPTION =
  "Дитячі розміри за зростом (см), зріст 110–164. Обхвати дівчат / хлопців у описі розміру.";

/** Height size → girls & boys body measures [chest, waist, hips] cm. */
export const KIDS_HEIGHT_SIZE_INSTRUCTIONS: Record<
  string,
  { girls: [number, number, number]; boys: [number, number, number] }
> = {
  "110": { girls: [60, 56, 64], boys: [60, 56, 64] },
  "116": { girls: [62, 57, 66], boys: [62, 57, 66] },
  "122": { girls: [64, 58, 68], boys: [64, 58, 68] },
  "128": { girls: [66, 59, 70], boys: [66, 59, 70] },
  "134": { girls: [68, 61, 72], boys: [68, 61, 72] },
  "140": { girls: [71, 63, 75], boys: [71, 63, 75] },
  "146": { girls: [73, 64, 79], boys: [75, 66, 78] },
  "152": { girls: [76, 66, 82], boys: [78, 68, 81] },
  "158": { girls: [79, 68, 85], boys: [81, 70, 84] },
  "164": { girls: [82, 70, 88], boys: [84, 72, 87] },
};

export function kidsHeightDescriptionUk(code: string): string | null {
  const row = KIDS_HEIGHT_SIZE_INSTRUCTIONS[code];
  if (!row) return null;
  const same =
    row.girls[0] === row.boys[0] &&
    row.girls[1] === row.boys[1] &&
    row.girls[2] === row.boys[2];
  if (same) {
    return `Дівч./хлопч.: груди ${row.girls[0]} · талія ${row.girls[1]} · стегна ${row.girls[2]}`;
  }
  return [
    formatTriple("Дівч.", row.girls),
    formatTriple("Хлопч.", row.boys),
  ].join(" · ");
}

/** Structured size-guide tables for ecommerce-style help UI. */
export type SizeGuideColumn = { key: string; label: string };
export type SizeGuideRow = { size: string; cells: Record<string, string> };
export type SizeGuideTable = {
  id: string;
  title: string;
  note?: string;
  columns: SizeGuideColumn[];
  rows: SizeGuideRow[];
};

export type SizeGuidePayload = {
  variantCode: string;
  headline: string;
  intro: string;
  tables: SizeGuideTable[];
};

const MEASURE_COLS: SizeGuideColumn[] = [
  { key: "chest", label: "Груди, см" },
  { key: "waist", label: "Талія, см" },
  { key: "hips", label: "Стегна, см" },
];

const UA_HEIGHT_WOMEN_ROWS: SizeGuideRow[] = [
  { size: "146–152", cells: { mark: "1–2", interval: "143–154" } },
  { size: "158–164", cells: { mark: "3–4 ★", interval: "155–166" } },
  { size: "170–176", cells: { mark: "5–6", interval: "167–178" } },
  { size: "182–188", cells: { mark: "7–8", interval: "179–191" } },
];

const UA_HEIGHT_MEN_ROWS: SizeGuideRow[] = [
  { size: "158–164", cells: { mark: "1–2", interval: "155–166" } },
  { size: "170–176", cells: { mark: "3–4 ★", interval: "167–178" } },
  { size: "182–188", cells: { mark: "5–6", interval: "179–191" } },
  { size: "194–200", cells: { mark: "7–8", interval: "192–203" } },
];

const HEIGHT_COLS: SizeGuideColumn[] = [
  { key: "mark", label: "Маркування" },
  { key: "interval", label: "Інтервал зросту, см" },
];

function tripleCells(t: [number, number, number]): Record<string, string> {
  return { chest: String(t[0]), waist: String(t[1]), hips: String(t[2]) };
}

/** Build ecommerce-style guide for a known variant code. */
export function getSizeGuideForVariant(variantCode: string | null | undefined): SizeGuidePayload | null {
  const code = (variantCode ?? "").trim().toUpperCase();
  if (!code) return null;

  if (code === "UA_CHEST_HALF") {
    const sizeCodes = Object.keys(UA_CHEST_SIZE_INSTRUCTIONS).sort(
      (a, b) => Number(a) - Number(b),
    );
    return {
      variantCode: code,
      headline: "Українська сітка · обхвати",
      intro:
        "Обхвати тіла в см. Жіночий базовий зріст — 164 см, чоловічий — 176 см. ★ — стандартний зріст.",
      tables: [
        {
          id: "ua-women",
          title: "Жінки (зріст 164 см)",
          columns: [{ key: "size", label: "Розмір" }, ...MEASURE_COLS],
          rows: sizeCodes
            .filter((s) => UA_CHEST_SIZE_INSTRUCTIONS[s]?.women)
            .map((s) => ({
              size: s,
              cells: {
                size: s,
                ...tripleCells(UA_CHEST_SIZE_INSTRUCTIONS[s]!.women!),
              },
            })),
        },
        {
          id: "ua-men",
          title: "Чоловіки (зріст 176 см)",
          columns: [{ key: "size", label: "Розмір" }, ...MEASURE_COLS],
          rows: sizeCodes
            .filter((s) => UA_CHEST_SIZE_INSTRUCTIONS[s]?.men)
            .map((s) => ({
              size: s,
              cells: {
                size: s,
                ...tripleCells(UA_CHEST_SIZE_INSTRUCTIONS[s]!.men!),
              },
            })),
        },
        {
          id: "ua-h-women",
          title: "Визначення зросту · жінки",
          note: "ДСТУ → маркування виробу",
          columns: [{ key: "size", label: "Зріст (ДСТУ)" }, ...HEIGHT_COLS],
          rows: UA_HEIGHT_WOMEN_ROWS.map((r) => ({
            size: r.size,
            cells: { size: r.size, ...r.cells },
          })),
        },
        {
          id: "ua-h-men",
          title: "Визначення зросту · чоловіки",
          note: "ДСТУ → маркування виробу",
          columns: [{ key: "size", label: "Зріст (ДСТУ)" }, ...HEIGHT_COLS],
          rows: UA_HEIGHT_MEN_ROWS.map((r) => ({
            size: r.size,
            cells: { size: r.size, ...r.cells },
          })),
        },
      ],
    };
  }

  if (code === "INTL_MEN_UA") {
    return {
      variantCode: code,
      headline: "Чоловіча · міжнар. ↔ укр.",
      intro: "Орієнтовна відповідність для підбору. Базовий зріст — 176 см. Обхвати в см.",
      tables: [
        {
          id: "intl-men",
          title: "Чоловіча розмірна сітка",
          columns: [
            { key: "size", label: "Міжнар." },
            { key: "ua", label: "Укр." },
            ...MEASURE_COLS,
          ],
          rows: Object.entries(INTL_MEN_SIZE_INSTRUCTIONS).map(([size, row]) => ({
            size,
            cells: { size, ua: row.ua, chest: row.chest, waist: row.waist, hips: row.hips },
          })),
        },
      ],
    };
  }

  if (code === "INTL_WOMEN_UA") {
    return {
      variantCode: code,
      headline: "Жіноча · міжнар. ↔ укр.",
      intro: "Орієнтовна відповідність для підбору. Базовий зріст — 164 см. Обхвати в см.",
      tables: [
        {
          id: "intl-women",
          title: "Жіноча розмірна сітка",
          columns: [
            { key: "size", label: "Міжнар." },
            { key: "ua", label: "Укр." },
            ...MEASURE_COLS,
          ],
          rows: Object.entries(INTL_WOMEN_SIZE_INSTRUCTIONS).map(([size, row]) => ({
            size,
            cells: { size, ua: row.ua, chest: row.chest, waist: row.waist, hips: row.hips },
          })),
        },
      ],
    };
  }

  if (code === "INTL_UNISEX") {
    return {
      variantCode: code,
      headline: "Міжнародна унісекс",
      intro:
        "Літерний розмір і орієнтовна відповідність українській сітці (чол. / жін.). Обхвати — для підбору.",
      tables: [
        {
          id: "intl-map",
          title: "Відповідність укр. розмірам",
          columns: [
            { key: "size", label: "Міжнар." },
            { key: "men", label: "Чол. укр." },
            { key: "women", label: "Жін. укр." },
          ],
          rows: Object.keys(INTL_MEN_SIZE_INSTRUCTIONS).map((size) => ({
            size,
            cells: {
              size,
              men: INTL_MEN_SIZE_INSTRUCTIONS[size]!.ua,
              women: INTL_WOMEN_SIZE_INSTRUCTIONS[size]!.ua,
            },
          })),
        },
        {
          id: "intl-men-body",
          title: "Чоловіки · обхвати (базовий зріст 176 см)",
          columns: [
            { key: "size", label: "Міжнар." },
            { key: "ua", label: "Укр." },
            ...MEASURE_COLS,
          ],
          rows: Object.entries(INTL_MEN_SIZE_INSTRUCTIONS).map(([size, row]) => ({
            size,
            cells: { size, ua: row.ua, chest: row.chest, waist: row.waist, hips: row.hips },
          })),
        },
        {
          id: "intl-women-body",
          title: "Жінки · обхвати (базовий зріст 164 см)",
          columns: [
            { key: "size", label: "Міжнар." },
            { key: "ua", label: "Укр." },
            ...MEASURE_COLS,
          ],
          rows: Object.entries(INTL_WOMEN_SIZE_INSTRUCTIONS).map(([size, row]) => ({
            size,
            cells: { size, ua: row.ua, chest: row.chest, waist: row.waist, hips: row.hips },
          })),
        },
      ],
    };
  }

  if (code === "KIDS_HEIGHT") {
    return {
      variantCode: code,
      headline: "Дитяча · зріст",
      intro: "Розмір = зріст у см (110–164). Обхвати дівчат і хлопців; до 140 см збігаються.",
      tables: [
        {
          id: "kids-girls",
          title: "Дівчата",
          columns: [{ key: "size", label: "Зріст" }, ...MEASURE_COLS],
          rows: Object.entries(KIDS_HEIGHT_SIZE_INSTRUCTIONS).map(([size, row]) => ({
            size,
            cells: { size, ...tripleCells(row.girls) },
          })),
        },
        {
          id: "kids-boys",
          title: "Хлопці",
          columns: [{ key: "size", label: "Зріст" }, ...MEASURE_COLS],
          rows: Object.entries(KIDS_HEIGHT_SIZE_INSTRUCTIONS).map(([size, row]) => ({
            size,
            cells: { size, ...tripleCells(row.boys) },
          })),
        },
      ],
    };
  }

  return null;
}


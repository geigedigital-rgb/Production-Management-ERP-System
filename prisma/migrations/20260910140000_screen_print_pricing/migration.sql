-- Screen-print price grid (тираж × кольори) + coefficients for order-stage branding.

CREATE TABLE IF NOT EXISTS "screen_print_price_cells" (
    "id" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "colorCount" INTEGER NOT NULL,
    "unitRate" DECIMAL(14,4) NOT NULL,
    CONSTRAINT "screen_print_price_cells_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "screen_print_price_cells_minQuantity_colorCount_key"
  ON "screen_print_price_cells"("minQuantity", "colorCount");

CREATE INDEX IF NOT EXISTS "screen_print_price_cells_minQuantity_idx"
  ON "screen_print_price_cells"("minQuantity");

CREATE TABLE IF NOT EXISTS "screen_print_coefficients" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "factor" DECIMAL(8,4) NOT NULL,
    "noteUk" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "screen_print_coefficients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "screen_print_coefficients_code_key"
  ON "screen_print_coefficients"("code");

-- Seed owner CRM grid (₴/шт, base ≤ A4).
INSERT INTO "screen_print_price_cells" ("id", "minQuantity", "colorCount", "unitRate") VALUES
  ('sp_20_1', 20, 1, 70), ('sp_20_2', 20, 2, 80), ('sp_20_3', 20, 3, 90), ('sp_20_4', 20, 4, 100),
  ('sp_50_1', 50, 1, 50), ('sp_50_2', 50, 2, 60), ('sp_50_3', 50, 3, 70), ('sp_50_4', 50, 4, 85),
  ('sp_100_1', 100, 1, 40), ('sp_100_2', 100, 2, 50), ('sp_100_3', 100, 3, 60), ('sp_100_4', 100, 4, 75),
  ('sp_300_1', 300, 1, 30), ('sp_300_2', 300, 2, 40), ('sp_300_3', 300, 3, 50), ('sp_300_4', 300, 4, 65),
  ('sp_500_1', 500, 1, 25), ('sp_500_2', 500, 2, 35), ('sp_500_3', 500, 3, 45), ('sp_500_4', 500, 4, 55),
  ('sp_1000_1', 1000, 1, 22), ('sp_1000_2', 1000, 2, 28), ('sp_1000_3', 1000, 3, 33), ('sp_1000_4', 1000, 4, 39)
ON CONFLICT ("minQuantity", "colorCount") DO UPDATE SET "unitRate" = EXCLUDED."unitRate";

INSERT INTO "screen_print_coefficients" ("id", "code", "nameUk", "factor", "noteUk", "sortOrder") VALUES
  ('sp_coef_large', 'LARGE_AREA', 'Площа більше А4 (до 38×38 см)', 1.7,
   'Базовий прайс — до А4. Більше А4, але не більше 38×38 см → ×1,7.', 1),
  ('sp_coef_chem', 'CHEMICAL_FABRIC', 'Хімічні тканини', 1.5,
   'Коефіцієнт до прайсу для хімічних тканин.', 2),
  ('sp_coef_cust', 'CUSTOMER_GARMENT', 'Одяг замовника', 1.3,
   'Коефіцієнт, якщо друкуємо на одязі клієнта (не наш виріб).', 3)
ON CONFLICT ("code") DO UPDATE SET
  "nameUk" = EXCLUDED."nameUk",
  "factor" = EXCLUDED."factor",
  "noteUk" = EXCLUDED."noteUk",
  "sortOrder" = EXCLUDED."sortOrder";

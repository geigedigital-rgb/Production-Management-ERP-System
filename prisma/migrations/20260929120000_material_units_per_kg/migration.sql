-- Trim: шт/кг when purchase is quoted in $/kg but BOM consumes pieces.
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "units_per_kg" DECIMAL(14,4);

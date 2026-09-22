-- Website on contact cards (clients + suppliers).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "website" TEXT;

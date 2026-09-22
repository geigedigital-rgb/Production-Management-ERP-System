-- Contact fields on suppliers (parity with clients directory).

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "email" TEXT;

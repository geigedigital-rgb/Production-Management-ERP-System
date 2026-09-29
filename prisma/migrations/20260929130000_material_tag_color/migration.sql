-- Optional color tag for materials catalog (quick visual mark).
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "tag_color" TEXT;

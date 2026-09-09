import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaClientVersion?: string;
};

/**
 * Bump when Prisma schema changes so dev HMR does not keep a stale client.
 * Also bump after `prisma generate` if a previous bump raced ahead of generation.
 */
const PRISMA_CLIENT_VERSION = "20260908140000_fixed_costs_v3";

function clientHasFixedCosts(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  return "fixedCostSettings" in client && "fixedCostArticle" in client;
}

function shouldRecreateClient(): boolean {
  if (globalForPrisma.prismaClientVersion !== PRISMA_CLIENT_VERSION) return true;
  if (!clientHasFixedCosts(globalForPrisma.prisma)) return true;
  return false;
}

if (shouldRecreateClient()) {
  const stale = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  // Drop cached instance from a previous schema; ignore disconnect errors in HMR.
  void stale?.$disconnect().catch(() => undefined);
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: 10,
      ssl: connectionString.includes("supabase.com")
        ? { rejectUnauthorized: false }
        : undefined,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

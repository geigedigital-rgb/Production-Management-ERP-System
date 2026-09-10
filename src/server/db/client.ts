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
const PRISMA_CLIENT_VERSION = "20260910140000_screen_print_v1";

function clientHasCurrentDelegates(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  return (
    "fixedCostSettings" in client &&
    "fixedCostArticle" in client &&
    "screenPrintPriceCell" in client &&
    "screenPrintCoefficient" in client
  );
}

function shouldRecreateClient(): boolean {
  if (globalForPrisma.prismaClientVersion !== PRISMA_CLIENT_VERSION) return true;
  if (!clientHasCurrentDelegates(globalForPrisma.prisma)) return true;
  return false;
}

if (shouldRecreateClient()) {
  const stale = globalForPrisma.prisma;
  const stalePool = globalForPrisma.pgPool;
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  // Drop cached instance from a previous schema; ignore disconnect errors in HMR.
  void stale?.$disconnect().catch(() => undefined);
  void stalePool?.end().catch(() => undefined);
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
      // Fail fast instead of hanging the whole Next request forever.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
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

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy proxy so importing calc helpers / scripts does not require DATABASE_URL
 * until the first real DB call.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

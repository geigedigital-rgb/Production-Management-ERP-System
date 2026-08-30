import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { prisma } = await import("../src/server/db/client");

  const [clients, products, orders, materials, operations, decorations] = await Promise.all([
    prisma.client.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.material.count(),
    prisma.operation.count(),
    prisma.decorationMethod.count(),
  ]);

  console.log({ clients, products, orders, materials, operations, decorations });
}

main().then(() => process.exit(0));

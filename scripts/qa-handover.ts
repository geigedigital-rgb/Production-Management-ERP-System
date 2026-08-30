import "dotenv/config";
import { handOverToProduction } from "../src/server/domains/orders/service";
import { prisma } from "../src/server/db/client";

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error("Usage: npx tsx scripts/qa-handover.ts <orderId>");
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } });
  if (!admin) throw new Error("admin not found");

  await handOverToProduction(orderId, admin.id);
  console.log(`handed over ${orderId}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

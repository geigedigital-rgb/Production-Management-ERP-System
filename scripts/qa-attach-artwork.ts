import "dotenv/config";
import { addOrderFile } from "../src/server/domains/orders/service";

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error("Usage: npx tsx scripts/qa-attach-artwork.ts <orderId>");
    process.exit(1);
  }

  await addOrderFile({
    orderId,
    fileName: "qa-artwork.png",
    mimeType: "image/png",
    sizeBytes: 128,
    storageKey: `test/${orderId}/qa-artwork.png`,
  });

  console.log(`attached artwork to ${orderId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

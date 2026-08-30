import { execSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  execSync("npx tsx scripts/qa-e2e-prepare.ts", { cwd: root, stdio: "inherit" });
}

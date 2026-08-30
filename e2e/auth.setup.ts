import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authFile = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  const csrfRes = await page.request.get("/api/auth/csrf");
  expect(csrfRes.ok()).toBeTruthy();
  const { csrfToken } = await csrfRes.json();

  const loginRes = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: "admin@example.com",
      password: "ChangeMe123!",
      redirect: "false",
      json: "true",
    },
  });
  expect(loginRes.ok()).toBeTruthy();

  await page.goto("/overview");
  await expect(page).toHaveURL(/\/overview/);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});

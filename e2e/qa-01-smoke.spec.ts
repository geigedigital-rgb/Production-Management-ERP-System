import { test, expect } from "@playwright/test";
import testData from "./.auth/test-data.json";

test.describe("QA-01 Авторизація та навігація", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("логін admin і основні розділи", async ({ page }) => {
    const csrfRes = await page.request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    await page.request.post("/api/auth/callback/credentials", {
      form: {
        csrfToken,
        email: "admin@example.com",
        password: "ChangeMe123!",
        redirect: "false",
        json: "true",
      },
    });
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/overview/);

    for (const path of ["/orders", "/products", "/clients", "/settings/pricing"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});

test.describe("QA-02 SEED еталон у каталозі", () => {
  test("SEED-TS-BASIC має повну комплектацію", async ({ page }) => {
    await page.goto(`/products/${testData.productId}`);
    await expect(page.getByText("SEED-TS-BASIC")).toBeVisible();
    await expect(page.getByText("Готовий до замовлення")).toBeVisible();
    await expect(page.getByRole("link", { name: "Створити замовлення" }).first()).toBeVisible();
  });
});

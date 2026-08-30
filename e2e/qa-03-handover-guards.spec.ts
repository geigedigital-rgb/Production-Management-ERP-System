import { test, expect } from "@playwright/test";
import testData from "./.auth/test-data.json";

test.describe("QA-04 Негативні перевірки передачі", () => {
  test("4.1 Без погодженої версії — кнопки передачі немає", async ({ page }) => {
    await page.goto(`/orders/${testData.guardNoVersionOrderId}?tab=versions`);
    await expect(page.getByRole("button", { name: "Передати у виробництво" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Зберегти пропозицію" })).toBeVisible();
  });

  test("4.2 Без макета — передача заблокована після погодження", async ({ page }) => {
    await page.goto(`/orders/${testData.guardApprovedOrderId}?tab=versions`);
    await expect(page.getByRole("button", { name: "Передати у виробництво" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/додайте макет/i).first()).toBeVisible();
  });
});

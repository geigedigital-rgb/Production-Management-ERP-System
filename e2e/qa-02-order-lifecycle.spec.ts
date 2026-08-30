import { test, expect } from "@playwright/test";
import testData from "./.auth/test-data.json";
import {
  attachArtworkFixture,
  goToOrderTab,
  handoverOrderFixture,
  openPrefilledOrderCreate,
} from "./helpers";

test.describe.serial("QA-03 Повний цикл замовлення (UI)", () => {
  const orderPath = `/orders/${testData.lifecycleOrderId}`;

  test("3.1 Форма нового замовлення: SEED + комплектація", async ({ page }) => {
    await openPrefilledOrderCreate(page);
    await expect(page.getByText("SEED-TS-BASIC")).toBeVisible();
    await expect(page.getByText(/матеріал/i).first()).toBeVisible();
    await expect(page.getByText(/операц/i).first()).toBeVisible();
  });

  test("3.2 Відкриття підготовленого замовлення", async ({ page }) => {
    await page.goto(orderPath);
    await expect(page.getByText(testData.lifecycleOrderNumber).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Калькуляція" })).toBeVisible();
  });

  test("3.3 Вкладка калькуляції показує собівартість", async ({ page }) => {
    await page.goto(orderPath);
    await goToOrderTab(page, "calculation");
    await expect(page.getByText(/₴|грн/i).first()).toBeVisible();
  });

  test("3.4 Погоджена версія відображається", async ({ page }) => {
    await page.goto(`${orderPath}?tab=versions`);
    await expect(page.getByText("Погоджено").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Передати у виробництво" })).toBeVisible();
  });

  test("3.5 Макет нанесення у вкладці документів", async ({ page }) => {
    await attachArtworkFixture(testData.lifecycleOrderId);
    await page.goto(`${orderPath}?tab=files`);
    await expect(page.getByText("qa-artwork.png")).toBeVisible();
  });

  test("3.6 Передача у виробництво", async ({ page }) => {
    await handoverOrderFixture(testData.lifecycleOrderId);
    await page.goto(`${orderPath}?tab=versions`);
    await expect(page.getByText("У виробництві").first()).toBeVisible();
  });

  test("3.7 Документи та блокування після передачі", async ({ page }) => {
    await page.goto(`${orderPath}?tab=versions`);
    await expect(page.getByText("Зафіксовано").first()).toBeVisible();
    await goToOrderTab(page, "files");
    await expect(page.getByText("qa-artwork.png")).toBeVisible();
    await expect(page.getByRole("button", { name: "Додати файл" })).toHaveCount(0);
  });
});

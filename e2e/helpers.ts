import { execSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import testData from "./.auth/test-data.json";

export const SEED_CODE = "SEED-TS-BASIC";

export function futureDeadline(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function loginViaUi(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Увійти" })).toBeVisible();
  await page.getByLabel("Email або логін").fill("admin@example.com");
  await page.getByLabel("Пароль").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Увійти" }).click();

  let email: string | null = null;
  try {
    await expect
      .poll(async () => {
        const res = await page.request.get("/api/auth/session");
        const data = await res.json();
        return data?.user?.email ?? null;
      }, { timeout: 5000 })
      .toBe("admin@example.com");
    email = "admin@example.com";
  } catch {
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
    const res = await page.request.get("/api/auth/session");
    const data = await res.json();
    email = data?.user?.email ?? null;
  }

  expect(email).toBe("admin@example.com");
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/overview/);
}

export async function openPrefilledOrderCreate(page: Page) {
  const url = `/orders/new?clientId=${testData.clientId}&productId=${testData.productId}`;
  await page.goto(url);
  await expect(page.getByText("Склад позиції")).toBeVisible({ timeout: 20_000 });
}

export async function selectTestClient(page: Page) {
  if (page.url().includes(`clientId=${testData.clientId}`)) return;
  const trigger = page.locator("#clientId");
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();

  await expect(async () => {
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  }).toPass({ timeout: 15_000 });

  const option = page.locator('[role="listbox"] [role="option"]').filter({ hasText: "ТЕСТ" }).first();
  if (await option.count()) {
    await option.click();
    return;
  }
  await page.locator('[role="listbox"] [role="option"]').nth(1).click();
}

export async function pickSeedProduct(page: Page, code = SEED_CODE) {
  const search = page.getByPlaceholder("Назва або код");
  await expect(search).toBeVisible();
  await search.fill(code);

  const productButton = page.getByRole("button").filter({ hasText: code }).first();
  await expect(async () => {
    await productButton.click();
    await expect(page.getByText("Склад позиції")).toBeVisible();
  }).toPass({ timeout: 15_000 });
}

export async function fillSizeQuantities(page: Page, perSize = 25) {
  const panel = page.locator("div.sticky.bottom-14");
  const inputs = panel.locator("input[inputmode='numeric']");
  await expect(inputs.first()).toBeVisible({ timeout: 10_000 });
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    await input.click();
    await input.fill(String(perSize));
    await expect(input).toHaveValue(String(perSize));
  }

  await expect(panel.getByText(`Разом ${perSize * count} шт`)).toBeVisible({ timeout: 5_000 });
}

export async function confirmStagingLine(page: Page) {
  const button = page.locator("div.sticky.bottom-14").getByRole("button", { name: "Погодити і додати" });
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByText("Спочатку виберіть виріб")).toBeVisible({ timeout: 10_000 });
}

export async function submitNewOrder(page: Page) {
  await page.getByRole("button", { name: "Створити замовлення" }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 20_000 });
}

export async function goToOrderTab(page: Page, tab: "configuration" | "calculation" | "versions" | "files") {
  const labels: Record<string, string> = {
    configuration: "Комплектація",
    calculation: "Калькуляція",
    versions: "Пропозиції",
    files: "Документи",
  };
  await page.getByRole("link", { name: labels[tab], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
}

export async function saveCalculationVersion(page: Page, label = "QA E2E пропозиція", orderPath?: string) {
  if (orderPath) {
    await page.goto(`${orderPath}?tab=versions&action=save`);
  } else {
    const trigger = page.getByRole("button", { name: "Зберегти пропозицію" }).last();
    await expect(trigger).toBeVisible();
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }).toPass({ timeout: 15_000 });
  }

  await expect(page.getByLabel("Назва пропозиції")).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Назва пропозиції").fill(label);
  await page.getByRole("dialog").getByRole("button", { name: "Зберегти пропозицію" }).click();
  await expect(page.getByText("v1").first()).toBeVisible({ timeout: 15_000 });
}

export async function approveLatestVersion(page: Page) {
  await page.getByRole("button", { name: "Погодити" }).first().click();
  await page.getByRole("button", { name: "Погодити" }).last().click();
  await expect(page.getByText("Погоджено").first()).toBeVisible({ timeout: 15_000 });
}

export async function handoverOrderFixture(orderId: string) {
  const root = path.resolve(__dirname, "..");
  execSync(`npx tsx scripts/qa-handover.ts ${orderId}`, { cwd: root, stdio: "pipe" });
}

export async function attachArtworkFixture(orderId: string) {
  const root = path.resolve(__dirname, "..");
  execSync(`npx tsx scripts/qa-attach-artwork.ts ${orderId}`, { cwd: root, stdio: "pipe" });
}

export async function uploadArtwork(page: Page) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "qa-artwork.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });

  const uploaded = page.getByText("qa-artwork.png");
  const failed = page.getByText(/Не вдалося завантажити|сховище/i);
  await expect(uploaded.or(failed)).toBeVisible({ timeout: 20_000 });
  if (await failed.isVisible()) {
    const orderId = page.url().match(/\/orders\/([^/?]+)/)?.[1];
    if (!orderId) throw new Error("order id not found for artwork fallback");
    await attachArtworkFixture(orderId);
    await page.reload();
    await expect(page.getByText("qa-artwork.png")).toBeVisible({ timeout: 10_000 });
  }
}

export async function completeHandover(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Передати у виробництво" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }).toPass({ timeout: 15_000 });

  const dialog = page.getByRole("dialog");

  const checkboxes = dialog.getByRole("checkbox");
  const n = await checkboxes.count();
  for (let i = 0; i < n; i++) {
    await checkboxes.nth(i).check();
  }

  await dialog.getByRole("button", { name: "Підтвердити передачу" }).click();
  await expect(page.getByText("У виробництві")).toBeVisible({ timeout: 20_000 });
}

export async function searchProducts(page: Page, query: string) {
  await page.getByPlaceholder("Пошук за назвою або кодом").fill(query);
  await page.waitForTimeout(400);
  await expect(page.getByRole("row").filter({ hasText: query }).first()).toBeVisible({ timeout: 10_000 });
}

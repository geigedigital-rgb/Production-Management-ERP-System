"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { assertSessionPermission } from "@/server/auth/access";
import {
  archiveSize,
  archiveSizeChartVariant,
  listSizeChartCatalog,
  replaceVariantSizes,
  upsertSizeChartVariant,
  upsertSizeInVariant,
} from "@/server/domains/size-charts/service";

export async function getSizeChartCatalogAction() {
  await assertSessionPermission("manageCatalogs");
  const variants = await listSizeChartCatalog();
  return { ok: true as const, variants };
}

export async function saveSizeChartVariantAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("manageCatalogs");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const nameUk = String(formData.get("nameUk") ?? "");
  const code = String(formData.get("code") ?? "").trim() || undefined;
  const description = String(formData.get("description") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  try {
    await upsertSizeChartVariant({ id, nameUk, code, description, sortOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message.includes("Unique") || message.includes("unique")) {
      return { ok: false as const, error: "DUPLICATE_CODE" as const };
    }
    if (message === "NAME_REQUIRED") return { ok: false as const, error: "NAME_REQUIRED" as const };
    return { ok: false as const, error: "ERROR" as const };
  }

  revalidatePath("/settings/size-charts");
  revalidatePath("/products");
  return { ok: true as const };
}

export async function archiveSizeChartVariantAction(formData: FormData) {
  await assertSessionPermission("manageCatalogs");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "INVALID" as const };
  try {
    await archiveSizeChartVariant(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message === "VARIANT_IN_USE") return { ok: false as const, error: "VARIANT_IN_USE" as const };
    return { ok: false as const, error: "ERROR" as const };
  }
  revalidatePath("/settings/size-charts");
  revalidatePath("/products");
  return { ok: true as const };
}

export async function saveVariantSizesAction(formData: FormData) {
  await assertSessionPermission("manageCatalogs");
  const variantId = String(formData.get("variantId") ?? "");
  const sizesJson = String(formData.get("sizesJson") ?? "[]");
  if (!variantId) return { ok: false as const, error: "INVALID" as const };

  let sizes: Array<{
    code: string;
    nameUk: string;
    descriptionUk?: string | null;
    sortOrder?: number;
  }>;
  try {
    sizes = JSON.parse(sizesJson) as typeof sizes;
    if (!Array.isArray(sizes)) throw new Error("BAD");
  } catch {
    return { ok: false as const, error: "INVALID" as const };
  }

  try {
    await replaceVariantSizes(variantId, sizes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message === "DUPLICATE_CODE") return { ok: false as const, error: "DUPLICATE_CODE" as const };
    return { ok: false as const, error: "ERROR" as const };
  }

  revalidatePath("/settings/size-charts");
  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true as const };
}

export async function saveSizeAction(formData: FormData) {
  await assertSessionPermission("manageCatalogs");
  const variantId = String(formData.get("variantId") ?? "");
  const id = String(formData.get("id") ?? "").trim() || undefined;
  const code = String(formData.get("code") ?? "");
  const nameUk = String(formData.get("nameUk") ?? "");
  const descriptionUk = String(formData.get("descriptionUk") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  if (!variantId) return { ok: false as const, error: "INVALID" as const };

  try {
    await upsertSizeInVariant(variantId, { id, code, nameUk, descriptionUk, sortOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message === "CODE_REQUIRED") return { ok: false as const, error: "CODE_REQUIRED" as const };
    if (message.includes("Unique") || message.includes("unique")) {
      return { ok: false as const, error: "DUPLICATE_CODE" as const };
    }
    return { ok: false as const, error: "ERROR" as const };
  }

  revalidatePath("/settings/size-charts");
  revalidatePath("/products");
  return { ok: true as const };
}

export async function archiveSizeAction(formData: FormData) {
  await assertSessionPermission("manageCatalogs");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "INVALID" as const };
  try {
    await archiveSize(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message === "SIZE_IN_USE") return { ok: false as const, error: "SIZE_IN_USE" as const };
    return { ok: false as const, error: "ERROR" as const };
  }
  revalidatePath("/settings/size-charts");
  revalidatePath("/products");
  return { ok: true as const };
}

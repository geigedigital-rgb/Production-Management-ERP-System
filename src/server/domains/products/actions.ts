"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { assertSessionPermission } from "@/server/auth/access";
import { hasUserPermission } from "@/lib/permissions";
import {
  addProductDecoration,
  addProductMaterial,
  addProductOperation,
  archiveProducts,
  copyProductSizeSpec,
  createProductDraft,
  getProduct,
  parseCutRateTiersInput,
  productFormSchema,
  removeProductMaterialFromSize,
  removeProductOperationFromSize,
  removeProductDecoration,
  setProductMaterialConsumption,
  setProductMaterialWaste,
  setProductMaterialSizeNorm,
  setProductCutRates,
  setProductCommercialPrices,
  parseCommercialPriceTiersInput,
  toCompositionTemplate,
} from "@/server/domains/products/service";

export async function createProductAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const sizeIds = formData.getAll("sizeIds").map(String).filter(Boolean);
  let composition: {
    materials: Array<{ materialId: string; consumptionPerUnit: number; wastePercent?: number | null }>;
    operations: Array<{ operationId: string }>;
    decorations: Array<{ decorationMethodId: string }>;
  } = { materials: [], operations: [], decorations: [] };

  const compositionRaw = formData.get("compositionJson");
  if (typeof compositionRaw === "string" && compositionRaw.trim()) {
    try {
      composition = JSON.parse(compositionRaw) as typeof composition;
    } catch {
      return { ok: false as const, error: "VALIDATION" as const };
    }
  }

  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();

  const parsed = productFormSchema.safeParse({
    nameUk: formData.get("nameUk"),
    internalCode: formData.get("internalCode") || null,
    description: formData.get("description") || null,
    imageUrl: imageUrlRaw || null,
    sizeIds,
    materials: Array.isArray(composition.materials) ? composition.materials : [],
    operations: Array.isArray(composition.operations) ? composition.operations : [],
    decorations: Array.isArray(composition.decorations) ? composition.decorations : [],
  });

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  let cutRates: { optimalQty: number | null; tiers: Array<{ minQuantity: number; ratePerUnit: number }> } | null =
    null;
  const cutRatesRaw = formData.get("cutRatesJson");
  if (typeof cutRatesRaw === "string" && cutRatesRaw.trim()) {
    try {
      const parsedCutRates = parseCutRateTiersInput(JSON.parse(cutRatesRaw) as {
        optimalQty?: unknown;
        tiers?: unknown;
      });
      if (!parsedCutRates.ok) {
        return { ok: false as const, error: "VALIDATION" as const };
      }
      cutRates = parsedCutRates;
    } catch {
      return { ok: false as const, error: "VALIDATION" as const };
    }
  }

  const product = await createProductDraft(parsed.data);
  if (cutRates && (cutRates.optimalQty != null || cutRates.tiers.length > 0)) {
    await setProductCutRates({
      productId: product.id,
      optimalQty: cutRates.optimalQty,
      tiers: cutRates.tiers,
    });
  }

  let priceList: { isBaseModel: boolean; tiers: Array<{ minQuantity: number; pricePerUnit: number }> } | null =
    null;
  const priceListRaw = formData.get("priceListJson");
  if (typeof priceListRaw === "string" && priceListRaw.trim()) {
    try {
      const parsedPriceList = parseCommercialPriceTiersInput(JSON.parse(priceListRaw) as {
        isBaseModel?: unknown;
        tiers?: unknown;
      });
      if (!parsedPriceList.ok) {
        return { ok: false as const, error: "VALIDATION" as const };
      }
      priceList = parsedPriceList;
    } catch {
      return { ok: false as const, error: "VALIDATION" as const };
    }
  }

  if (priceList && (priceList.isBaseModel || priceList.tiers.length > 0)) {
    await setProductCommercialPrices({
      productId: product.id,
      isBaseModel: priceList.isBaseModel,
      tiers: priceList.tiers,
    });
  }

  const savedProduct =
    cutRates || priceList ? await getProduct(product.id) : product;
  if (!savedProduct) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  revalidatePath("/products");
  revalidatePath("/orders/new");

  const compositionPayload = toCompositionTemplate(savedProduct);

  return {
    ok: true as const,
    productId: savedProduct.id,
    nameUk: savedProduct.nameUk,
    internalCode: savedProduct.internalCode,
    imageUrl: savedProduct.imageUrl,
    label: savedProduct.internalCode
      ? `${savedProduct.nameUk} (${savedProduct.internalCode})`
      : savedProduct.nameUk,
    sizes: savedProduct.sizes.map((row) => ({
      code: row.size.code,
      nameUk: row.size.nameUk,
    })),
    materialsCount: savedProduct.materials.length,
    operationsCount: savedProduct.operations.length,
    decorationsCount: savedProduct.decorations.length,
    composition: compositionPayload,
  };
}

export async function uploadProductImageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "EMPTY" as const };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false as const, error: "TOO_LARGE" as const };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false as const, error: "TYPE" as const };
  }

  try {
    const { getSupabaseAdmin, UPLOADS_BUCKET } = await import("@/lib/supabase/client");
    const supabase = getSupabaseAdmin();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      return { ok: false as const, error: "UPLOAD" as const, message: error.message };
    }
    const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
    return { ok: true as const, url: data.publicUrl };
  } catch {
    return { ok: false as const, error: "UPLOAD" as const };
  }
}

export async function addProductMaterialAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const materialId = String(formData.get("materialId") ?? "");
  const consumptionPerUnit = Number(formData.get("consumptionPerUnit"));
  const wasteRaw = formData.get("wastePercent");
  const wastePercent = wasteRaw === "" || wasteRaw == null ? null : Number(wasteRaw);
  const sizeIds = formData.getAll("sizeIds").map(String).filter(Boolean);

  if (!productId || !materialId || Number.isNaN(consumptionPerUnit)) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await addProductMaterial({
    productId,
    materialId,
    consumptionPerUnit,
    wastePercent,
    sizeIds: sizeIds.length > 0 ? sizeIds : undefined,
  });
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function addProductOperationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const operationId = String(formData.get("operationId") ?? "");
  const sizeIds = formData.getAll("sizeIds").map(String).filter(Boolean);
  if (!productId || !operationId) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await addProductOperation({
    productId,
    operationId,
    sizeIds: sizeIds.length > 0 ? sizeIds : undefined,
  });
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function addProductDecorationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const decorationMethodId = String(formData.get("decorationMethodId") ?? "");
  if (!productId || !decorationMethodId) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await addProductDecoration({ productId, decorationMethodId });
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function updateProductMaterialConsumptionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  const consumptionPerUnit = Number(formData.get("consumptionPerUnit"));
  const sizeId = String(formData.get("sizeId") ?? "").trim() || null;

  if (!id || Number.isNaN(consumptionPerUnit) || consumptionPerUnit < 0) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  if (sizeId) {
    await setProductMaterialSizeNorm({
      productMaterialId: id,
      sizeId,
      consumptionPerUnit,
    });
  } else {
    await setProductMaterialConsumption(id, consumptionPerUnit);
  }
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function updateProductMaterialWasteAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  const wastePercent = Number(formData.get("wastePercent"));

  if (!id || Number.isNaN(wastePercent) || wastePercent < 0) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await setProductMaterialWaste(id, wastePercent);
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function removeProductMaterialAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  const sizeId = String(formData.get("sizeId") ?? "").trim() || null;
  await removeProductMaterialFromSize({ productMaterialId: id, sizeId });
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function removeProductOperationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  const sizeId = String(formData.get("sizeId") ?? "").trim() || null;
  await removeProductOperationFromSize({ productOperationId: id, sizeId });
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function removeProductDecorationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };

  await removeProductDecoration(id);
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function copyProductSizeSpecAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const fromSizeId = String(formData.get("fromSizeId") ?? "");
  const toSizeIds = formData.getAll("toSizeId").map(String).filter(Boolean);
  if (!productId || !fromSizeId || toSizeIds.length === 0) {
    return { ok: false as const, error: "VALIDATION" as const };
  }
  await copyProductSizeSpec({ productId, fromSizeId, toSizeIds });
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function updateProductCutRatesAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { ok: false as const, error: "VALIDATION" as const };

  const optimalRaw = String(formData.get("optimalQty") ?? "").trim();
  const optimalQty = optimalRaw ? Number(optimalRaw) : null;

  const minQuantities = formData.getAll("tierMinQuantity").map(String);
  const rates = formData.getAll("tierRate").map(String);
  const tiers: Array<{ minQuantity: number; ratePerUnit: number }> = [];
  for (let i = 0; i < minQuantities.length; i++) {
    const minQuantity = Number(minQuantities[i]);
    const ratePerUnit = Number(rates[i]);
    if (!Number.isFinite(minQuantity) || !Number.isFinite(ratePerUnit)) continue;
    if (minQuantity <= 0 || ratePerUnit < 0) continue;
    tiers.push({ minQuantity, ratePerUnit });
  }

  const parsed = parseCutRateTiersInput({ optimalQty, tiers });
  if (!parsed.ok) return { ok: false as const, error: "VALIDATION" as const };

  await setProductCutRates({ productId, optimalQty: parsed.optimalQty, tiers: parsed.tiers });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return { ok: true as const };
}

export async function updateProductCommercialPricesAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { ok: false as const, error: "VALIDATION" as const };

  const isBaseModel = formData.get("isBaseModel") === "1";
  const minQuantities = formData.getAll("tierMinQuantity").map(String);
  const prices = formData.getAll("tierPrice").map(String);
  const tiers: Array<{ minQuantity: number; pricePerUnit: number }> = [];
  for (let i = 0; i < minQuantities.length; i++) {
    const minQuantity = Number(minQuantities[i]);
    const pricePerUnit = Number(prices[i]);
    if (!Number.isFinite(minQuantity) || !Number.isFinite(pricePerUnit)) continue;
    if (minQuantity <= 0 || pricePerUnit < 0) continue;
    tiers.push({ minQuantity, pricePerUnit });
  }

  const parsed = parseCommercialPriceTiersInput({ isBaseModel, tiers });
  if (!parsed.ok) return { ok: false as const, error: "VALIDATION" as const };

  await setProductCommercialPrices({
    productId,
    isBaseModel: parsed.isBaseModel,
    tiers: parsed.tiers,
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true as const };
}

export async function bulkArchiveProductsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { ok: false as const, error: "EMPTY" as const };

  const result = await archiveProducts(ids);
  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true as const, count: result.count };
}

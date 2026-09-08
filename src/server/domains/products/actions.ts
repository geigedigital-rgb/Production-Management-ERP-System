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
  setProductDecorationSetupCost,
  setProductMaterialConsumption,
  setProductMaterialWaste,
  setProductMaterialSizeNorm,
  setProductMaterialSizeWaste,
  setProductMaterialSupplierColor,
  setProductCutRates,
  setProductCommercialPrices,
  setProductImageUrl,
  setProductOperationRateTiers,
  parseCommercialPriceTiersInput,
  toCompositionTemplate,
  duplicateProduct,
  setProductSizes,
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

  const { isImageUpload, storeProductImage } = await import("@/lib/uploads");
  if (!isImageUpload(file)) {
    return { ok: false as const, error: "TYPE" as const };
  }

  const stored = await storeProductImage(file);
  if (!stored.ok) {
    return { ok: false as const, error: "UPLOAD" as const, message: stored.message };
  }
  return { ok: true as const, url: stored.url };
}

export async function updateProductImageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();
  if (!productId) return { ok: false as const, error: "VALIDATION" as const };

  try {
    await setProductImageUrl(productId, imageUrlRaw || null);
  } catch {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true as const, imageUrl: imageUrlRaw || null };
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

export async function updateProductDecorationSetupCostAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  const setupCost = Number(formData.get("setupCost"));

  if (!id || Number.isNaN(setupCost) || setupCost < 0) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await setProductDecorationSetupCost(id, setupCost);
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
  const sizeId = String(formData.get("sizeId") ?? "").trim() || null;

  if (!id || Number.isNaN(wastePercent) || wastePercent < 0) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  if (sizeId) {
    await setProductMaterialSizeWaste({
      productMaterialId: id,
      sizeId,
      wastePercent,
    });
  } else {
    await setProductMaterialWaste(id, wastePercent);
  }
  revalidatePath(`/products/${productId}`);
  return { ok: true as const };
}

export async function updateProductMaterialSupplierColorAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };

  const hasSupplier = formData.has("supplierId");
  const hasColor = formData.has("colorSnapshot");
  const supplierId = hasSupplier
    ? String(formData.get("supplierId") ?? "").trim() || null
    : undefined;
  const colorSnapshot = hasColor
    ? String(formData.get("colorSnapshot") ?? "").trim() || null
    : undefined;

  await setProductMaterialSupplierColor({ id, supplierId, colorSnapshot });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/orders");
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

export async function updateProductOperationRateTiersAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const productOperationId = String(formData.get("productOperationId") ?? "");
  if (!productId || !productOperationId) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  let tiers: Array<{ minQuantity: number; ratePerUnit: number }> = [];
  const raw = formData.get("rateTiersJson");
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        tiers = parsed
          .map((row) => ({
            minQuantity: Number((row as { minQuantity?: unknown }).minQuantity),
            ratePerUnit: Number((row as { ratePerUnit?: unknown }).ratePerUnit),
          }))
          .filter(
            (row) =>
              Number.isFinite(row.minQuantity) &&
              row.minQuantity > 0 &&
              Number.isFinite(row.ratePerUnit) &&
              row.ratePerUnit >= 0,
          );
      }
    } catch {
      return { ok: false as const, error: "VALIDATION" as const };
    }
  }

  if (tiers.length === 0) return { ok: false as const, error: "VALIDATION" as const };

  await setProductOperationRateTiers({ productOperationId, tiers });
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

export async function previewProductEconomicsAction(productId: string, quantity: number) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("viewProductCosts");

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const product = await getProduct(productId);
  if (!product) return { ok: false as const, error: "NOT_FOUND" as const };

  const { buildCalcFromProduct, getPricingDefaults } = await import(
    "@/server/domains/calculation/from-entities"
  );
  const pricing = await getPricingDefaults();
  const calc = buildCalcFromProduct(product, qty, pricing);

  return { ok: true as const, calc, quantity: qty };
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

export async function duplicateProductAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("saveAsStandardProduct");

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { ok: false as const, error: "INVALID" as const };

  try {
    const copy = await duplicateProduct(productId);
    revalidatePath("/products");
    revalidatePath("/orders/new");
    revalidatePath(`/products/${copy.id}`);
    return { ok: true as const, productId: copy.id, nameUk: copy.nameUk };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message === "PRODUCT_NOT_FOUND") {
      return { ok: false as const, error: "NOT_FOUND" as const };
    }
    return { ok: false as const, error: "ERROR" as const };
  }
}

export async function updateProductSizesAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const productId = String(formData.get("productId") ?? "");
  const sizeIds = formData.getAll("sizeIds").map(String).filter(Boolean);
  if (!productId) return { ok: false as const, error: "INVALID" as const };

  try {
    await setProductSizes({ productId, sizeIds });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/orders/new");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    if (message === "PRODUCT_NOT_FOUND" || message === "PRODUCT_ARCHIVED") {
      return { ok: false as const, error: message as "PRODUCT_NOT_FOUND" | "PRODUCT_ARCHIVED" };
    }
    if (message === "SIZE_NOT_FOUND") {
      return { ok: false as const, error: "SIZE_NOT_FOUND" as const };
    }
    return { ok: false as const, error: "ERROR" as const };
  }
}

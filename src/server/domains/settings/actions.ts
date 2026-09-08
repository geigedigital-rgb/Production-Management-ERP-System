"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { assertSessionPermission } from "@/server/auth/access";
import { hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/server/db/client";
import { resyncFabricPurchasePrices } from "@/server/domains/catalog/materials";

const pricingSchema = z.object({
  pricingMethod: z.enum(["MARGIN", "MARKUP"]),
  targetMarginPercent: z.coerce.number().min(0).max(99),
  minimumMarginPercent: z.coerce.number().min(0).max(99),
  managerMaxDiscountPercent: z.coerce.number().min(0).max(100),
  roundingRule: z.string().min(1),
  usdUahRate: z.coerce.number().positive(),
  fabricCargoUsdPerKg: z.coerce.number().min(0),
  inputVatRatePercent: z.coerce.number().min(0).max(100),
  materialCostVatMode: z.enum(["NET", "GROSS"]),
});

export async function updatePricingSettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("managePricingRules");

  const parsed = pricingSchema.safeParse({
    pricingMethod: formData.get("pricingMethod"),
    targetMarginPercent: formData.get("targetMarginPercent"),
    minimumMarginPercent: formData.get("minimumMarginPercent"),
    managerMaxDiscountPercent: formData.get("managerMaxDiscountPercent") || 0,
    roundingRule: formData.get("roundingRule") || "ROUND_2",
    usdUahRate: formData.get("usdUahRate") || 45,
    fabricCargoUsdPerKg: formData.get("fabricCargoUsdPerKg") || 1.7,
    inputVatRatePercent: formData.get("inputVatRatePercent") || 20,
    materialCostVatMode: formData.get("materialCostVatMode") || "NET",
  });

  if (!parsed.success) return { ok: false as const, error: "VALIDATION" as const };
  if (parsed.data.minimumMarginPercent > parsed.data.targetMarginPercent) {
    return { ok: false as const, error: "MIN_ABOVE_TARGET" as const };
  }

  const existing = await prisma.pricingSettings.findFirst();
  if (existing) {
    await prisma.pricingSettings.update({ where: { id: existing.id }, data: parsed.data });
  } else {
    await prisma.pricingSettings.create({ data: parsed.data });
  }

  await resyncFabricPurchasePrices();

  revalidatePath("/settings/pricing");
  revalidatePath("/settings/resources");
  revalidatePath("/products");
  return { ok: true as const };
}

const companySchema = z.object({
  legalName: z.string().trim().min(1),
  address: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  taxId: z.string().trim().optional().nullable(),
  quotationFooter: z.string().trim().optional().nullable(),
});

export async function updateCompanySettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("managePricingRules");

  const parsed = companySchema.safeParse({
    legalName: formData.get("legalName"),
    address: formData.get("address") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    taxId: formData.get("taxId") || null,
    quotationFooter: formData.get("quotationFooter") || null,
  });

  if (!parsed.success) return { ok: false as const, error: "VALIDATION" as const };

  const existing = await prisma.companySettings.findFirst();
  if (existing) {
    await prisma.companySettings.update({ where: { id: existing.id }, data: parsed.data });
  } else {
    await prisma.companySettings.create({ data: parsed.data });
  }

  revalidatePath("/settings/company");
  return { ok: true as const };
}

/** Company-wide XXL / 3XL / 4XL uplift vs base norms (+% materials / +% operations). */
export async function updateOversizeCoeffsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const materialPct = Number(formData.get("materialPct"));
  const operationPct = Number(formData.get("operationPct"));
  if (
    Number.isNaN(materialPct) ||
    Number.isNaN(operationPct) ||
    materialPct < 0 ||
    operationPct < 0 ||
    materialPct > 200 ||
    operationPct > 200
  ) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  const { OVERSIZE_CODES, pctToCoeff } = await import("@/lib/size-coeffs");
  const materialCoeff = pctToCoeff(materialPct);
  const operationCoeff = pctToCoeff(operationPct);

  for (const sizeCode of OVERSIZE_CODES) {
    const existing = await prisma.sizeRule.findFirst({
      where: { sizeCode, status: "ACTIVE" },
    });
    if (existing) {
      await prisma.sizeRule.update({
        where: { id: existing.id },
        data: { materialCoeff, operationCoeff },
      });
    } else {
      await prisma.sizeRule.create({
        data: {
          sizeCode,
          materialCoeff,
          operationCoeff,
          surchargePercent: 0,
          appliesTo: "SELECTED",
          status: "ACTIVE",
        },
      });
    }
  }

  revalidatePath("/products");
  revalidatePath("/orders");
  revalidatePath("/settings/pricing");
  return { ok: true as const };
}

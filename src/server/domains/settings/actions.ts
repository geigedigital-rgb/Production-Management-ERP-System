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

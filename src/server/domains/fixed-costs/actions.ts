"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getCurrentUserAccess } from "@/server/auth/access";
import {
  deleteFixedCostArticle,
  setFixedCostArticleActive,
  updateFixedCostSettings,
  upsertFixedCostArticle,
} from "@/server/domains/fixed-costs/service";
import { validateFixedCostParams } from "@/lib/fixed-costs";

async function assertAdministrator() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const access = await getCurrentUserAccess();
  if (!access || access.role !== "ADMINISTRATOR") throw new Error("FORBIDDEN");
  return access;
}

const settingsSchema = z.object({
  workingDaysPerMonth: z.coerce.number().int().positive(),
  sewerCount: z.coerce.number().int().positive(),
  dailySewerPay: z.coerce.number().positive(),
});

export async function updateFixedCostSettingsAction(formData: FormData) {
  await assertAdministrator();
  const parsed = settingsSchema.safeParse({
    workingDaysPerMonth: formData.get("workingDaysPerMonth"),
    sewerCount: formData.get("sewerCount"),
    dailySewerPay: formData.get("dailySewerPay"),
  });
  if (!parsed.success) return { ok: false as const, error: "VALIDATION" as const };

  const invalid = validateFixedCostParams(parsed.data);
  if (invalid) return { ok: false as const, error: invalid };

  await updateFixedCostSettings(parsed.data);
  revalidatePath("/settings/fixed-costs");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const };
}

const articleSchema = z.object({
  id: z.string().optional(),
  nameUk: z.string().trim().min(1),
  monthlyAmount: z.coerce.number().min(0),
  isActive: z.coerce.boolean().optional(),
});

export async function upsertFixedCostArticleAction(formData: FormData) {
  await assertAdministrator();
  const idRaw = String(formData.get("id") ?? "").trim();
  const parsed = articleSchema.safeParse({
    id: idRaw || undefined,
    nameUk: formData.get("nameUk"),
    monthlyAmount: formData.get("monthlyAmount"),
    isActive: formData.get("isActive") === "0" ? false : true,
  });
  if (!parsed.success) return { ok: false as const, error: "VALIDATION" as const };

  await upsertFixedCostArticle(parsed.data);
  revalidatePath("/settings/fixed-costs");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const };
}

export async function setFixedCostArticleActiveAction(formData: FormData) {
  await assertAdministrator();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "1";
  if (!id) return { ok: false as const, error: "VALIDATION" as const };
  await setFixedCostArticleActive(id, isActive);
  revalidatePath("/settings/fixed-costs");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const };
}

export async function deleteFixedCostArticleAction(formData: FormData) {
  await assertAdministrator();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };
  await deleteFixedCostArticle(id);
  revalidatePath("/settings/fixed-costs");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const };
}

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { assertSessionPermission } from "@/server/auth/access";
import { hasUserPermission } from "@/lib/permissions";
import { clientFormSchema, createClient, archiveClients } from "@/server/domains/clients/service";

export async function createClientAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("manageClients");

  const parsed = clientFormSchema.safeParse({
    companyName: formData.get("companyName"),
    contactPerson: formData.get("contactPerson") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    legalDetails: formData.get("legalDetails") || null,
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  const client = await createClient(parsed.data);
  revalidatePath("/clients");
  revalidatePath("/orders/new");
  return { ok: true as const, clientId: client.id, companyName: client.companyName };
}

export async function bulkArchiveClientsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("manageClients");

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { ok: false as const, error: "EMPTY" as const };

  const result = await archiveClients(ids);
  revalidatePath("/clients");
  revalidatePath("/orders/new");
  return { ok: true as const, count: result.count };
}

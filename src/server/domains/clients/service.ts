import { prisma } from "@/server/db/client";
import { z } from "zod";

export const clientFormSchema = z.object({
  companyName: z.string().trim().min(1),
  contactPerson: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .pipe(z.union([z.string().email(), z.null()])),
  legalDetails: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export async function listClients(search?: string) {
  const q = search?.trim();
  return prisma.client.findMany({
    where: {
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { contactPerson: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { orders: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, number: true, status: true },
      },
    },
    orderBy: { companyName: "asc" },
  });
}

export async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { name: true } },
          items: {
            take: 1,
            include: {
              versions: {
                orderBy: [{ isApproved: "desc" }, { versionNumber: "desc" }],
                take: 1,
                select: { totalSellingValue: true, isApproved: true, versionNumber: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function createClient(raw: ClientFormValues) {
  const data = clientFormSchema.parse(raw);
  return prisma.client.create({
    data: {
      companyName: data.companyName,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      legalDetails: data.legalDetails || null,
      note: data.note || null,
    },
  });
}

export async function archiveClients(ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.client.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}

"use server";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";

export type SearchGroup = {
  key: "orders" | "clients" | "products";
  label: string;
  items: { id: string; href: string; title: string; subtitle?: string }[];
};

/** Global search across the entities a manager navigates between most often. */
export async function globalSearchAction(query: string): Promise<SearchGroup[]> {
  const session = await auth();
  if (!session?.user) return [];

  const term = query.trim();
  if (term.length < 2) return [];

  const contains = { contains: term, mode: "insensitive" as const };

  const [orders, clients, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [{ number: contains }, { title: contains }, { client: { companyName: contains } }],
      },
      select: { id: true, number: true, title: true, status: true, client: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { OR: [{ companyName: contains }, { contactPerson: contains }, { phone: contains }] },
      select: { id: true, companyName: true, contactPerson: true },
      orderBy: { companyName: "asc" },
      take: 5,
    }),
    prisma.product.findMany({
      where: { OR: [{ nameUk: contains }, { internalCode: contains }] },
      select: { id: true, nameUk: true, internalCode: true },
      orderBy: { nameUk: "asc" },
      take: 5,
    }),
  ]);

  const groups: SearchGroup[] = [];

  if (orders.length) {
    groups.push({
      key: "orders",
      label: "Замовлення",
      items: orders.map((order) => ({
        id: order.id,
        href: `/orders/${order.id}`,
        title: `${order.number}${order.title ? ` · ${order.title}` : ""}`,
        subtitle: order.client.companyName,
      })),
    });
  }

  if (clients.length) {
    groups.push({
      key: "clients",
      label: "Клієнти",
      items: clients.map((client) => ({
        id: client.id,
        href: `/clients/${client.id}`,
        title: client.companyName,
        subtitle: client.contactPerson ?? undefined,
      })),
    });
  }

  if (products.length) {
    groups.push({
      key: "products",
      label: "Вироби",
      items: products.map((product) => ({
        id: product.id,
        href: `/products/${product.id}`,
        title: product.nameUk,
        subtitle: product.internalCode ?? undefined,
      })),
    });
  }

  return groups;
}

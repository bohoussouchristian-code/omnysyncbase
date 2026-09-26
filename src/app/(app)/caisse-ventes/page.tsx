import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CaisseValidationClient } from "@/components/sales/CaisseValidationClient";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function CaisseVentesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const { from: fromParam, to: toParam } = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const fromStr = fromParam || toISODate(defaultFrom);
  const toStr = toParam || toISODate(now);
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const itemsInclude = { include: { product: { include: { unit: true, packUnit: true } }, service: true } } as const;

  const [pending, validated, warehouses, openSessions, company] = await Promise.all([
    // Une vente en attente reste visible quelle que soit la période : c'est
    // une file d'action, pas un historique à filtrer par date.
    prisma.sale.findMany({
      where: { companyId, status: "EN_ATTENTE" },
      orderBy: { date: "asc" },
      include: {
        customer: true,
        warehouse: true,
        user: true,
        validatedBy: true,
        items: itemsInclude,
        payments: { select: { amount: true, cashReceived: true, changeGiven: true } },
      },
    }),
    prisma.sale.findMany({
      where: { companyId, validatedAt: { gte: from, lte: to } },
      orderBy: { validatedAt: "desc" },
      take: 500,
      include: {
        customer: true,
        warehouse: true,
        user: true,
        validatedBy: true,
        items: itemsInclude,
        payments: { select: { amount: true, cashReceived: true, changeGiven: true } },
      },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.cashSession.findMany({
      where: { companyId, userId: user.id, closedAt: null },
      include: { warehouse: true },
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);

  return (
    <CaisseValidationClient
      pending={pending}
      validated={validated}
      from={fromStr}
      to={toStr}
      warehouses={warehouses}
      openSessions={openSessions}
      companyName={company?.name ?? ""}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersClient } from "@/components/users/UsersClient";

export default async function UtilisateursPage() {
  const current = await getCurrentUser();
  if (!current?.companyId || current.role !== "ADMIN") redirect("/dashboard");

  const [users, warehouses] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: current.companyId },
      orderBy: { createdAt: "asc" },
      include: { warehouse: { select: { id: true, name: true } } },
    }),
    prisma.warehouse.findMany({ where: { companyId: current.companyId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return <UsersClient users={users} warehouses={warehouses} currentUserId={current.id} />;
}

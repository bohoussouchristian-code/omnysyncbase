import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersClient } from "@/components/users/UsersClient";

export default async function UtilisateursPage() {
  const current = await getCurrentUser();
  if (!current?.companyId || current.role !== "ADMIN") redirect("/dashboard");

  const [users, warehouses, permissionRows] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: current.companyId },
      orderBy: { createdAt: "desc" },
      include: { warehouse: { select: { id: true, name: true } } },
    }),
    prisma.warehouse.findMany({ where: { companyId: current.companyId, active: true }, orderBy: { id: "desc" } }),
    prisma.userPermission.findMany({ where: { companyId: current.companyId } }),
  ]);

  // Regroupées par utilisateur pour que le client n'ait aucun aller-retour
  // serveur à faire pour afficher l'éditeur de permissions (voir
  // src/lib/permissions.ts pour le calcul "défaut du rôle + dérogation").
  const overridesByUser: Record<string, Record<string, boolean>> = {};
  for (const row of permissionRows) {
    (overridesByUser[row.userId] ??= {})[row.key] = row.granted;
  }

  return (
    <UsersClient
      users={users}
      warehouses={warehouses}
      currentUserId={current.id}
      overridesByUser={overridesByUser}
    />
  );
}

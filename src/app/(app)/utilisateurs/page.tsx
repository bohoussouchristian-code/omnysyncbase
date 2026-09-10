import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersClient } from "@/components/users/UsersClient";

export default async function UtilisateursPage() {
  const current = await getCurrentUser();
  if (!current?.companyId || current.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    where: { companyId: current.companyId },
    orderBy: { createdAt: "asc" },
  });

  return <UsersClient users={users} currentUserId={current.id} />;
}

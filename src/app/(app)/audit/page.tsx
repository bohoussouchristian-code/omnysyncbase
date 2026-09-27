import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
import { redirect } from "next/navigation";
import { AuditLogClient } from "@/components/audit/AuditLogClient";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (!(await userHasPermission(user, "audit.voir"))) redirect("/dashboard");
  const companyId = user.companyId;

  const logs = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { name: true } } },
  });

  return <AuditLogClient logs={logs} />;
}

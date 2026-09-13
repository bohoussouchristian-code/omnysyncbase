import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginLogsClient } from "@/components/console/LoginLogsClient";

export default async function ConsoleConnexionsPage() {
  const user = await getCurrentUser();
  // Le layout /console filtre déjà les non-propriétaires, revérifié ici par
  // défense en profondeur (même règle que le reste de la console).
  if (!user?.isPlatformOwner) redirect("/login");

  const logs = await prisma.loginLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: true, company: true },
  });

  return <LoginLogsClient logs={logs} />;
}

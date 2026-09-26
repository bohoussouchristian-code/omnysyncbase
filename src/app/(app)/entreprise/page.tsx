import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EntrepriseClient } from "@/components/company/EntrepriseClient";

export default async function EntreprisePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const company = await prisma.company.findUnique({ where: { id: user.companyId } });
  if (!company) redirect("/dashboard");

  // La clé API FNE ne quitte jamais le serveur une fois enregistrée — seul
  // un indicateur de présence est envoyé au navigateur (même principe que les
  // mots de passe générés : jamais de secret renvoyé en clair côté client).
  const { fneApiKey, ...companyRest } = company;
  const clientCompany = { ...companyRest, hasFneApiKey: !!fneApiKey };

  return <EntrepriseClient company={clientCompany} />;
}

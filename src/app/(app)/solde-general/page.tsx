import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
import { redirect } from "next/navigation";
import { getGeneralBalanceData } from "@/lib/actions/generalBalance";
import { SoldeGeneralClient } from "@/components/finance/SoldeGeneralClient";

export default async function SoldeGeneralPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (!(await userHasPermission(user, "rapports.voir"))) redirect("/dashboard");

  const data = await getGeneralBalanceData();
  if ("error" in data) redirect("/dashboard");

  return <SoldeGeneralClient data={data} canEdit={user.role === "ADMIN"} />;
}

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AccountMenu } from "@/components/AccountMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = user.companyId
    ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } })
    : null;

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar userName={user.name} userEmail={user.email} userRole={user.role} companyName={company?.name ?? null} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="hidden lg:flex items-center justify-end h-16 px-6 border-b border-slate-200 bg-white shrink-0">
          <AccountMenu userName={user.name} userEmail={user.email} userRole={user.role} theme="light" />
        </header>
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

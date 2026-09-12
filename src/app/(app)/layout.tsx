import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AccountMenu } from "@/components/AccountMenu";
import { SettingsMenu } from "@/components/SettingsMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = user.companyId
    ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } })
    : null;

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar userName={user.name} userEmail={user.email} userRole={user.role} companyName={company?.name ?? null} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-x-hidden overflow-y-visible">
        <div className="max-w-7xl mx-auto p-4 lg:p-8 relative">
          <div className="no-print hidden lg:flex items-center gap-1 absolute top-6 right-8 z-30 bg-white border border-slate-200 rounded-xl shadow-sm px-2 py-1.5">
            {user.role === "ADMIN" && (
              <>
                <SettingsMenu theme="light" />
                <div className="h-6 w-px bg-slate-200" />
              </>
            )}
            <AccountMenu userName={user.name} userEmail={user.email} userRole={user.role} theme="light" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

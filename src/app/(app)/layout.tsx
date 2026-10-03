import { prisma } from "@/lib/prisma";
import { getCurrentUser, getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/actions/permissions";
import { exitCompany } from "@/lib/actions/console";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AccountMenu } from "@/components/AccountMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = user.companyId
    ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true, logoUrl: true } })
    : null;

  const session = await getSession();
  const isActingAsOwner = user.isPlatformOwner && !!session?.actingCompanyId;
  const permissions = Array.from(await getEffectivePermissions(user));

  return (
    <div className="flex flex-1 min-h-screen flex-col">
      {isActingAsOwner && (
        <form
          action={async () => {
            "use server";
            await exitCompany();
          }}
          className="no-print flex items-center justify-center gap-3 bg-amber-500 text-amber-950 text-sm font-medium px-4 py-2"
        >
          <span>
            Vous agissez en tant qu&apos;administrateur de <strong>{company?.name}</strong> (accès propriétaire).
          </span>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-amber-950/10 hover:bg-amber-950/20 px-2.5 py-1 transition-colors"
          >
            <LogOut size={13} /> Quitter
          </button>
        </form>
      )}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          userName={user.name}
          userEmail={user.email}
          userRole={user.role}
          companyName={company?.name ?? null}
          permissions={permissions}
        />
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-x-hidden overflow-y-visible flex flex-col">
          {company?.logoUrl && (
            <div
              className="no-print pointer-events-none fixed inset-y-0 left-0 right-0 lg:left-64 z-0 flex items-center justify-center overflow-hidden"
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.logoUrl}
                alt=""
                className="w-[44rem] h-[44rem] max-w-[85vw] max-h-[85vw] object-contain opacity-[0.03] grayscale"
              />
            </div>
          )}
          <div className="relative z-10 no-print hidden lg:flex justify-end px-8 pt-6">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl shadow-sm px-2 py-1.5">
              <GlobalSearch theme="light" />
              <NotificationBell theme="light" />
              <AccountMenu userName={user.name} userEmail={user.email} userRole={user.role} theme="light" />
            </div>
          </div>
          <div className="relative z-10 max-w-7xl mx-auto p-4 lg:p-8 w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

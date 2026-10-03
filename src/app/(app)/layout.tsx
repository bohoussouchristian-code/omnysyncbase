import { prisma } from "@/lib/prisma";
import { getCurrentUser, getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/actions/permissions";
import { exitCompany } from "@/lib/actions/console";
import { logout } from "@/lib/actions/auth";
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
    ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true, logoUrl: true, active: true } })
    : null;

  const session = await getSession();
  const isActingAsOwner = user.isPlatformOwner && !!session?.actingCompanyId;

  // Entreprise suspendue (voir toggleCompanyActive dans console.ts) : une
  // session déjà ouverte avant la suspension ne doit pas continuer à
  // fonctionner — on coupe l'accès dès le prochain chargement de page.
  // Le propriétaire de la plateforme qui agit dans l'entreprise (bandeau
  // ci-dessous) garde l'accès, pour pouvoir la gérer/la réactiver.
  if (company && !company.active && !isActingAsOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full text-center bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Accès impossible</h1>
          <p className="text-sm text-slate-600 mb-6">Contactez le développeur.</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          <div className="relative z-10 p-4 lg:p-8 w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

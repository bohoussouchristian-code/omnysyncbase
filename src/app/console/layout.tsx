import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.isPlatformOwner) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 bg-slate-900 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-[10px] font-bold tracking-wide">
            OSB
          </div>
          <span className="font-semibold text-white">Console propriétaire</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300 hidden sm:inline">{user.name}</span>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 lg:p-8">{children}</main>
    </div>
  );
}

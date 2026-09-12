import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { Info, Building2, UserCog, type LucideIcon } from "lucide-react";

type SettingLink = { href: string; label: string; icon: LucideIcon };

const SETTINGS_LINKS: SettingLink[] = [
  { href: "/entreprise", label: "Informations de l'entreprise", icon: Info },
  { href: "/entrepots", label: "Dépôts / Boutiques", icon: Building2 },
  { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
];

export default async function AdministrationPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  // Réservé aux administrateurs (même règle déjà appliquée côté sidebar).
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div>
      <PageHeader title="Administration" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-gradient-to-b from-blue-50/60 to-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col items-center text-center hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-3">
              <item.icon size={22} />
            </div>
            <h2 className="font-bold text-slate-900 text-sm">{item.label}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}

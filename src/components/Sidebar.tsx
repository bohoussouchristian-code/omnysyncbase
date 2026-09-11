"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  ClipboardList,
  ArrowLeftRight,
  Receipt,
  Store,
  Users,
  Building2,
  Wallet,
  Landmark,
  BarChart3,
  UserCog,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: null },
  { href: "/ventes", label: "Ventes / Caisse", icon: ShoppingCart, roles: null },
  { href: "/produits", label: "Configuration des produits", icon: Package, roles: null },
  { href: "/prestations", label: "Prestations", icon: Sparkles, roles: null },
  { href: "/stock", label: "Stock Général", icon: Boxes, roles: null },
  { href: "/depots-annexes", label: "Dépôts annexes", icon: Store, roles: null },
  { href: "/transferts", label: "Transferts de stock", icon: ArrowLeftRight, roles: null },
  { href: "/achats", label: "Bons de commande", icon: ClipboardList, roles: null },
  { href: "/livraisons", label: "Bons de livraison", icon: Truck, roles: null },
  { href: "/clients", label: "Clients", icon: Users, roles: null },
  { href: "/achats-clients", label: "Achats clients", icon: Receipt, roles: null },
  { href: "/fournisseurs", label: "Fournisseurs", icon: Building2, roles: null },
  { href: "/depenses", label: "Dépenses", icon: Wallet, roles: null },
  { href: "/caisse", label: "Sessions de caisse", icon: Landmark, roles: null },
  { href: "/rapports", label: "Rapports", icon: BarChart3, roles: ["ADMIN", "GERANT"] },
  { href: "/entrepots", label: "Dépôts / Boutiques", icon: Building2, roles: ["ADMIN"] },
  { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog, roles: ["ADMIN"] },
] as const;

export function Sidebar({ userName, userRole }: { userName: string; userRole: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.roles || (item.roles as readonly string[]).includes(userRole));

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-[10px] font-bold tracking-wide">
          OSB
        </div>
        <span className="font-semibold text-white">OSB</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="px-2 mb-2">
          <p className="text-sm font-medium text-white truncate">{userName}</p>
          <p className="text-xs text-slate-400">{ROLE_LABELS[userRole]}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 flex items-center px-3 z-40">
        <button onClick={() => setOpen(true)} className="text-white p-2">
          <Menu size={22} />
        </button>
        <span className="text-white font-semibold ml-2">OSB</span>
      </div>

      <aside className="hidden lg:block w-64 bg-slate-900 shrink-0">{content}</aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-slate-900 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-white p-1"
            >
              <X size={20} />
            </button>
            {content}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Logo } from "@/components/Logo";
import type { Role } from "@prisma/client";
import type { PermissionKey } from "@/lib/permissions";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  ClipboardList,
  ArrowLeftRight,
  Store,
  Users,
  Building2,
  Wallet,
  Landmark,
  BarChart3,
  Menu,
  X,
  CupSoda,
  Banknote,
  Scale,
  Vault,
  FileText,
  Ban,
  ChevronDown,
  PackageCheck,
  UserCog,
  Receipt,
  PiggyBank,
  Send,
  ShieldCheck,
  Scissors,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Visibilité par rôle codée en dur (legacy) — laissé null quand `permission`
  // est renseigné, qui prend alors le dessus (voir itemVisible plus bas).
  roles: readonly Role[] | null;
  // Une ou plusieurs permissions déléguables (voir src/lib/permissions.ts) :
  // l'entrée est visible si l'utilisateur a AU MOINS une de ces permissions,
  // indépendamment de son rôle.
  permission?: PermissionKey | readonly PermissionKey[];
};
type NavGroup = { label: string; icon: LucideIcon; items: readonly NavItem[] };
type NavEntry = ({ kind: "link" } & NavItem) | ({ kind: "group" } & NavGroup);

function itemVisible(item: NavItem, userRole: Role, permissions: ReadonlySet<PermissionKey>): boolean {
  if (item.permission) {
    const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
    return perms.some((p) => permissions.has(p as PermissionKey));
  }
  return !item.roles || item.roles.includes(userRole);
}

// Structure reprise du prompt de restructuration : Tiers, Catalogue &
// référentiel, Ventes & facturation, Achats & approvisionnement, Stock &
// logistique, Livraisons, Finances, FNE & fiscalité, Rapports & analytics,
// RH, Annulations & contrôle — chaque domaine métier a son propre groupe,
// au lieu d'être mélangé dans "Gestion des ventes"/"Gestion financière"
// comme avant. Corrige au passage deux modules orphelins qui existaient en
// code mais n'apparaissaient nulle part dans le menu : Prestations et
// Catégories & unités.
const NAV: readonly NavEntry[] = [
  { kind: "link", href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: null },
  {
    kind: "group",
    label: "Tiers",
    icon: Users,
    items: [
      { href: "/clients", label: "Clients", icon: Users, roles: null },
      { href: "/fournisseurs", label: "Fournisseurs", icon: Building2, roles: null },
    ],
  },
  {
    kind: "group",
    label: "Catalogue & référentiel",
    icon: Package,
    items: [
      { href: "/produits", label: "Configuration des produits", icon: Package, roles: null },
      {
        href: "/categories",
        label: "Catégories & unités",
        icon: Boxes,
        roles: null,
        permission: "produits.gerer",
      },
      { href: "/prestations", label: "Prestations", icon: Scissors, roles: null },
    ],
  },
  {
    kind: "group",
    label: "Ventes & facturation",
    icon: ShoppingCart,
    items: [
      { href: "/ventes", label: "Vente du jour", icon: ShoppingCart, roles: null },
      { href: "/caisse-ventes", label: "Caisse", icon: Banknote, roles: null },
      { href: "/proformas", label: "Proformas", icon: FileText, roles: null },
    ],
  },
  {
    kind: "group",
    label: "Achats & approvisionnement",
    icon: ClipboardList,
    items: [
      { href: "/achats", label: "Bons de commande", icon: ClipboardList, roles: null },
      { href: "/livraisons", label: "Bons de livraison", icon: Truck, roles: null },
      { href: "/approvisionnement", label: "Approvisionnement", icon: PackageCheck, roles: null },
    ],
  },
  {
    kind: "group",
    label: "Stock & logistique",
    icon: Boxes,
    items: [
      { href: "/stock", label: "Stock Général", icon: Boxes, roles: null },
      { href: "/depots-annexes", label: "Dépôts annexes", icon: Store, roles: null },
      { href: "/transferts", label: "Transferts de stock", icon: ArrowLeftRight, roles: null },
    ],
  },
  {
    kind: "link",
    href: "/livraison-clients",
    label: "Livraisons",
    icon: Send,
    roles: null,
  },
  {
    kind: "group",
    label: "Finances",
    icon: Wallet,
    items: [
      { href: "/caisse", label: "État de mes caisses", icon: Landmark, roles: null },
      {
        href: "/gestion-caisses-depots",
        label: "Gestion des caisses et dépôts",
        icon: Vault,
        roles: null,
        permission: "caisses.gerer",
      },
      { href: "/depenses", label: "Dépenses", icon: Wallet, roles: null },
      {
        href: "/tresorerie",
        label: "Comptes bancaires",
        icon: PiggyBank,
        roles: null,
        permission: "rapports.voir",
      },
    ],
  },
  {
    kind: "link",
    href: "/entreprise?tab=fne",
    label: "FNE & fiscalité",
    icon: ShieldCheck,
    roles: ["ADMIN"],
  },
  {
    kind: "group",
    label: "Rapports & analytics",
    icon: Scale,
    items: [
      { href: "/bilan", label: "Voir le bilan complet", icon: Scale, roles: null },
      { href: "/rapports", label: "Rapports", icon: BarChart3, roles: null, permission: "rapports.voir" },
    ],
  },
  {
    kind: "group",
    label: "Ressources humaines",
    icon: UserCog,
    items: [
      { href: "/employes", label: "Employés", icon: Users, roles: null, permission: "employes.gerer" },
      { href: "/paie", label: "Bulletins de salaire", icon: Receipt, roles: null, permission: "paie.gerer" },
    ],
  },
  {
    kind: "link",
    href: "/annulations",
    label: "Annulations & contrôle",
    icon: Ban,
    roles: null,
    permission: ["ventes.annuler", "depenses.annuler", "livraisons.annuler"],
  },
  {
    kind: "link",
    href: "/audit",
    label: "Sécurité & audit",
    icon: Lock,
    roles: null,
    permission: "audit.voir",
  },
] as const;

export function Sidebar({
  userName,
  userEmail,
  userRole,
  companyName,
  permissions,
}: {
  userName: string;
  userEmail: string;
  userRole: Role;
  companyName?: string | null;
  permissions: readonly PermissionKey[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const permissionSet = new Set(permissions);
  const visibleEntries = NAV.map((entry) =>
    entry.kind === "group"
      ? { ...entry, items: entry.items.filter((item) => itemVisible(item, userRole, permissionSet)) }
      : entry
  ).filter((entry) => (entry.kind === "link" ? itemVisible(entry, userRole, permissionSet) : entry.items.length > 0));

  const allItems = visibleEntries.flatMap((entry) => (entry.kind === "link" ? [entry] : entry.items));

  // Le lien actif est celui dont le href correspond le plus précisément au
  // chemin courant (le plus long préfixe), pour qu'un sous-chemin ayant sa
  // propre entrée (ex. /ventes/historique) n'allume pas aussi son parent (/ventes).
  const activeHref = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Dès le clic, la couleur de sélection bascule instantanément sur l'élément
  // choisi, sans attendre que la page suivante ait fini de charger (le vrai
  // pathname met parfois un instant à suivre). Nettoyé dès que le pathname
  // bouge (navigation aboutie ou changement d'avis) — ajustement pendant le
  // rendu plutôt qu'un effet, même idiome que trackedActiveGroup plus bas.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [trackedPathname, setTrackedPathname] = useState(pathname);
  if (pathname !== trackedPathname) {
    setTrackedPathname(pathname);
    setPendingHref(null);
  }
  const effectiveActiveHref = pendingHref ?? activeHref;

  const activeGroupLabel = visibleEntries.find(
    (entry) => entry.kind === "group" && entry.items.some((i) => i.href === effectiveActiveHref)
  )?.label;

  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupLabel ?? null);
  // Quand la navigation change de groupe actif, on ré-ouvre ce groupe (ajustement
  // d'état pendant le rendu, pas d'effet, pour suivre le pathname sans double-render).
  const [trackedActiveGroup, setTrackedActiveGroup] = useState(activeGroupLabel);
  if (activeGroupLabel !== trackedActiveGroup) {
    setTrackedActiveGroup(activeGroupLabel);
    if (activeGroupLabel) setOpenGroup(activeGroupLabel);
  }

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-800">
        <Logo size={32} className="shrink-0" />
        {companyName ? (
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-white">
              <CupSoda size={14} className="shrink-0 text-blue-400" />
              <span className="font-semibold truncate">{companyName}</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none">Gestion de dépôt de boissons</p>
          </div>
        ) : (
          <span className="font-semibold text-white">OSB</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleEntries.map((entry) => {
          if (entry.kind === "link") {
            const Icon = entry.icon;
            const active = entry.href === effectiveActiveHref;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => {
                  setPendingHref(entry.href);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {entry.label}
              </Link>
            );
          }

          const GroupIcon = entry.icon;
          const isOpen = openGroup === entry.label;
          const groupHasActive = entry.items.some((i) => i.href === effectiveActiveHref);
          return (
            <div key={entry.label} className="pt-1">
              <button
                onClick={() => setOpenGroup(isOpen ? null : entry.label)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupHasActive && !isOpen
                    ? "text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <GroupIcon size={18} />
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-slate-800 space-y-0.5">
                  {entry.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === effectiveActiveHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          setPendingHref(item.href);
                          setOpen(false);
                        }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-blue-500 text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Icon size={16} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {userRole === "ADMIN" && (
        <div className="border-t border-slate-800 p-3 flex justify-end">
          <SettingsMenu theme="dark" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="no-print lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 flex items-center px-3 z-40">
        <button onClick={() => setOpen(true)} className="text-white p-2">
          <Menu size={22} />
        </button>
        <span className="text-white font-semibold ml-2 truncate flex-1">{companyName || "OSB"}</span>
        <GlobalSearch theme="dark" />
        <NotificationBell theme="dark" />
        <AccountMenu userName={userName} userEmail={userEmail} userRole={userRole} theme="dark" />
      </div>

      <aside className="no-print hidden lg:block w-64 bg-slate-900 shrink-0">{content}</aside>

      {open && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex">
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

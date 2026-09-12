"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, changeOwnPassword } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { Modal, Input, Label, FormError, SubmitButton } from "@/components/ui";
import type { Role } from "@prisma/client";
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
  UserCog,
  LogOut,
  Menu,
  X,
  CupSoda,
  Banknote,
  History,
  Scale,
  ChevronDown,
  ChevronUp,
  User,
  KeyRound,
  Bell,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useActionState, useState } from "react";

type NavItem = { href: string; label: string; icon: LucideIcon; roles: readonly Role[] | null };
type NavGroup = { label: string; icon: LucideIcon; items: readonly NavItem[] };
type NavEntry = ({ kind: "link" } & NavItem) | ({ kind: "group" } & NavGroup);

// Ordre d'affichage du menu : liens seuls et groupes dépliables mélangés,
// dans l'ordre exact souhaité (Bilan & état financier juste avant Administration).
const NAV: readonly NavEntry[] = [
  { kind: "link", href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: null },
  {
    kind: "group",
    label: "Gestion des ventes",
    icon: ShoppingCart,
    items: [
      { href: "/ventes", label: "Vente du jour", icon: ShoppingCart, roles: null },
      { href: "/ventes/historique", label: "Historique des ventes", icon: History, roles: null },
      { href: "/clients", label: "Clients", icon: Users, roles: null },
    ],
  },
  {
    kind: "group",
    label: "Gestion financière",
    icon: Wallet,
    items: [
      { href: "/caisse-ventes", label: "Caisse", icon: Banknote, roles: null },
      { href: "/caisse", label: "Sessions de caisse", icon: Landmark, roles: null },
      { href: "/depenses", label: "Dépenses", icon: Wallet, roles: null },
      { href: "/rapports", label: "Rapports", icon: BarChart3, roles: ["ADMIN", "GERANT"] },
    ],
  },
  {
    kind: "group",
    label: "Gestion appro & fournisseurs",
    icon: ClipboardList,
    items: [
      { href: "/achats", label: "Bons de commande", icon: ClipboardList, roles: null },
      { href: "/livraisons", label: "Bons de livraison", icon: Truck, roles: null },
      { href: "/fournisseurs", label: "Fournisseurs", icon: Building2, roles: null },
    ],
  },
  {
    kind: "group",
    label: "Gestion du stock",
    icon: Boxes,
    items: [
      { href: "/produits", label: "Configuration des produits", icon: Package, roles: null },
      { href: "/stock", label: "Stock Général", icon: Boxes, roles: null },
      { href: "/depots-annexes", label: "Dépôts annexes", icon: Store, roles: null },
      { href: "/transferts", label: "Transferts de stock", icon: ArrowLeftRight, roles: null },
    ],
  },
  { kind: "link", href: "/bilan", label: "Bilan & état financier", icon: Scale, roles: null },
  {
    kind: "group",
    label: "Administration",
    icon: UserCog,
    items: [
      { href: "/entrepots", label: "Dépôts / Boutiques", icon: Building2, roles: ["ADMIN"] },
      { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog, roles: ["ADMIN"] },
    ],
  },
] as const;

export function Sidebar({
  userName,
  userEmail,
  userRole,
  companyName,
}: {
  userName: string;
  userEmail: string;
  userRole: Role;
  companyName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visibleEntries = NAV.map((entry) =>
    entry.kind === "group"
      ? { ...entry, items: entry.items.filter((item) => !item.roles || item.roles.includes(userRole)) }
      : entry
  ).filter((entry) => entry.kind === "link" || entry.items.length > 0);

  const allItems = visibleEntries.flatMap((entry) => (entry.kind === "link" ? [entry] : entry.items));

  // Le lien actif est celui dont le href correspond le plus précisément au
  // chemin courant (le plus long préfixe), pour qu'un sous-chemin ayant sa
  // propre entrée (ex. /ventes/historique) n'allume pas aussi son parent (/ventes).
  const activeHref = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const activeGroupLabel = visibleEntries.find(
    (entry) => entry.kind === "group" && entry.items.some((i) => i.href === activeHref)
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-[10px] font-bold tracking-wide">
          OSB
        </div>
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
            const active = entry.href === activeHref;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {entry.label}
              </Link>
            );
          }

          const GroupIcon = entry.icon;
          const isOpen = openGroup === entry.label;
          const groupHasActive = entry.items.some((i) => i.href === activeHref);
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
                    const active = item.href === activeHref;
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

      <AccountMenu userName={userName} userEmail={userEmail} userRole={userRole} />
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 flex items-center px-3 z-40">
        <button onClick={() => setOpen(true)} className="text-white p-2">
          <Menu size={22} />
        </button>
        <span className="text-white font-semibold ml-2 truncate">{companyName || "OSB"}</span>
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

function AccountMenu({ userName, userEmail, userRole }: { userName: string; userEmail: string; userRole: Role }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  // Lecture paresseuse (pas d'effet) : sans risque d'hydratation puisque ce
  // menu est fermé par défaut, donc absent du HTML rendu au premier affichage.
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const initials = userName.trim().charAt(0).toUpperCase() || "?";

  async function handleEnableNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifStatus(result);
  }

  return (
    <div className="relative border-t border-slate-800 p-3">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{userName}</p>
          <p className="text-xs text-slate-400">{ROLE_LABELS[userRole]}</p>
        </div>
        {menuOpen ? (
          <ChevronUp size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
            <button
              onClick={() => {
                setShowAccount(true);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <User size={16} /> Mon compte
            </button>
            <button
              onClick={() => {
                setShowChangePassword(true);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <KeyRound size={16} /> Changer le mot de passe
            </button>
            <button
              onClick={handleEnableNotifications}
              disabled={notifStatus === "granted" || notifStatus === "unsupported"}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Bell size={16} />
              {notifStatus === "granted" ? "Notifications activées" : "Activer les notifications"}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Actualiser la page
            </button>
            <div className="my-1 border-t border-slate-100" />
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} /> Se déconnecter
              </button>
            </form>
          </div>
        </>
      )}

      <Modal open={showAccount} onClose={() => setShowAccount(false)} title="Mon compte">
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-lg font-semibold">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{userName}</p>
              <p className="text-sm text-slate-500">{ROLE_LABELS[userRole]}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Email</p>
            <p className="text-sm text-slate-700">{userEmail}</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        title="Changer le mot de passe"
      >
        <ChangePasswordForm onDone={() => setShowChangePassword(false)} />
      </Modal>
    </div>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(changeOwnPassword, undefined as
    | { error?: string; success?: boolean }
    | undefined);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Mot de passe modifié avec succès.
        </div>
        <div className="flex justify-end">
          <button
            onClick={onDone}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div>
        <Label>Mot de passe actuel</Label>
        <Input type="password" name="currentPassword" required autoFocus />
      </div>
      <div>
        <Label>Nouveau mot de passe</Label>
        <Input type="password" name="newPassword" required minLength={8} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Changer le mot de passe</SubmitButton>
      </div>
    </form>
  );
}

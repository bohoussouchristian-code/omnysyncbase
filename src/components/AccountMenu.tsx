"use client";

import { useActionState, useState } from "react";
import { logout, changeOwnPassword } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { Modal, Input, Label, FormError, SubmitButton } from "@/components/ui";
import type { Role } from "@prisma/client";
import { ChevronDown, User, KeyRound, Bell, RefreshCw, LogOut } from "lucide-react";

export function AccountMenu({
  userName,
  userEmail,
  userRole,
  theme = "light",
}: {
  userName: string;
  userEmail: string;
  userRole: Role;
  theme?: "light" | "dark";
}) {
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
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
          theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100"
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
          {initials}
        </div>
        <div className="min-w-0 text-left hidden sm:block">
          <p className={`text-sm font-medium truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
            {userName}
          </p>
          <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            {ROLE_LABELS[userRole]}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${theme === "dark" ? "text-slate-400" : "text-slate-400"} ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
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

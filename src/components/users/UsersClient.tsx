"use client";

import { useActionState, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  createUser,
  toggleUserActive,
  resetUserPassword,
  updateUserRole,
  updateUser,
  updateUserWarehouse,
} from "@/lib/actions/users";
import { setUserPermissionOverride } from "@/lib/actions/permissions";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import { PERMISSION_GROUPS, PERMISSION_LABELS, roleHasPermission, type PermissionKey } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { Plus, Power, MoreVertical, KeyRound, ShieldCheck, Pencil, Warehouse as WarehouseIcon } from "lucide-react";

type Warehouse = { id: string; name: string };
// Ces deux rôles doivent être rattachés à un dépôt pour pouvoir valider une
// vente (voir createSale dans src/lib/actions/sales.ts) ; Admin et Gérant
// restent libres de choisir le dépôt à chaque vente.
const WAREHOUSE_BOUND_ROLES: readonly Role[] = ["CAISSIER", "MAGASINIER", "VENDEUR"];

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  warehouseId: string | null;
  warehouse: Warehouse | null;
};

export function UsersClient({
  users,
  warehouses,
  currentUserId,
  overridesByUser,
}: {
  users: User[];
  warehouses: Warehouse[];
  currentUserId: string;
  overridesByUser: Record<string, Record<string, boolean>>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [activeModal, setActiveModal] = useState<{ type: "password" | "role" | "edit" | "warehouse"; user: User } | null>(
    null
  );

  function openAction(type: "password" | "role" | "edit" | "warehouse", user: User) {
    setActiveModal({ type, user });
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle={`${users.length} compte(s)`}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvel utilisateur
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Dépôt rattaché</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const needsWarehouse = WAREHOUSE_BOUND_ROLES.includes(u.role);
                return (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-3">
                      {needsWarehouse ? (
                        u.warehouse ? (
                          <span className="text-slate-600">{u.warehouse.name}</span>
                        ) : (
                          <Badge tone="warning">Aucun</Badge>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.active ? "success" : "default"}>{u.active ? "Actif" : "Inactif"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        {u.id !== currentUserId && (
                          <button
                            onClick={() => toggleUserActive(u.id)}
                            className="text-slate-400 hover:text-red-600"
                            title={u.active ? "Désactiver" : "Activer"}
                          >
                            <Power size={16} />
                          </button>
                        )}
                        <UserActionsMenu
                          onResetPassword={() => openAction("password", u)}
                          onEditRole={() => openAction("role", u)}
                          onEdit={() => openAction("edit", u)}
                          onEditWarehouse={needsWarehouse ? () => openAction("warehouse", u) : undefined}
                          canEditRole={u.id !== currentUserId}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel utilisateur">
        <UserForm warehouses={warehouses} onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal
        open={activeModal?.type === "password"}
        onClose={() => setActiveModal(null)}
        title={`Réinitialiser le mot de passe — ${activeModal?.user.name ?? ""}`}
      >
        {activeModal && <ResetPasswordForm user={activeModal.user} onDone={() => setActiveModal(null)} />}
      </Modal>

      <Modal
        open={activeModal?.type === "role"}
        onClose={() => setActiveModal(null)}
        title={`Permissions & rôles — ${activeModal?.user.name ?? ""}`}
      >
        {activeModal && (
          <RoleForm
            user={activeModal.user}
            overrides={overridesByUser[activeModal.user.id] ?? {}}
            onDone={() => setActiveModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={activeModal?.type === "edit"}
        onClose={() => setActiveModal(null)}
        title={`Modifier — ${activeModal?.user.name ?? ""}`}
      >
        {activeModal && <EditUserForm user={activeModal.user} onDone={() => setActiveModal(null)} />}
      </Modal>

      <Modal
        open={activeModal?.type === "warehouse"}
        onClose={() => setActiveModal(null)}
        title={`Dépôt rattaché — ${activeModal?.user.name ?? ""}`}
      >
        {activeModal && (
          <WarehouseForm user={activeModal.user} warehouses={warehouses} onDone={() => setActiveModal(null)} />
        )}
      </Modal>
    </div>
  );
}

function UserActionsMenu({
  onResetPassword,
  onEditRole,
  onEdit,
  onEditWarehouse,
  canEditRole,
}: {
  onResetPassword: () => void;
  onEditRole: () => void;
  onEdit: () => void;
  onEditWarehouse?: () => void;
  canEditRole: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 224 });
    setOpen((v) => !v);
  }

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="inline-block">
      <button
        onClick={toggle}
        className="text-slate-400 hover:text-slate-700 p-1"
        title="Plus d'actions"
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1"
              style={{ top: pos.top, left: pos.left }}
            >
              <button
                onClick={() => pick(onResetPassword)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <KeyRound size={15} /> Réinitialiser le mot de passe
              </button>
              <button
                onClick={() => canEditRole && pick(onEditRole)}
                disabled={!canEditRole}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title={!canEditRole ? "Vous ne pouvez pas modifier votre propre rôle" : undefined}
              >
                <ShieldCheck size={15} /> Permissions & rôles
              </button>
              {onEditWarehouse && (
                <button
                  onClick={() => pick(onEditWarehouse)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <WarehouseIcon size={15} /> Dépôt rattaché
                </button>
              )}
              <button
                onClick={() => pick(onEdit)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={15} /> Modification
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function UserForm({ warehouses, onDone }: { warehouses: Warehouse[]; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createUser(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);
  const [role, setRole] = useState<Role>("CAISSIER");
  const needsWarehouse = WAREHOUSE_BOUND_ROLES.includes(role);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div>
        <Label>Nom complet</Label>
        <Input name="name" required />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" name="email" required />
      </div>
      <div>
        <Label>Mot de passe</Label>
        <Input type="password" name="password" required minLength={8} />
        <p className="mt-1 text-xs text-slate-500">Min. 8 caractères, avec au moins un symbole (ex: ! @ # $ %).</p>
      </div>
      <div>
        <Label>Rôle</Label>
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {needsWarehouse && (
        <div>
          <Label>Dépôt rattaché</Label>
          <Select name="warehouseId" defaultValue="">
            <option value="">— Aucun (ne pourra pas vendre) —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            Un caissier, magasinier ou vendeur ne peut valider une vente que depuis son dépôt rattaché.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Créer</SubmitButton>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      const res = await resetUserPassword(user.id);
      if (res && "error" in res) {
        setError(res.error ?? "Erreur inconnue.");
        return;
      }
      setStatus(res.emailSent ? "sent" : "failed");
    });
  }

  if (status === "sent") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          Nouveau mot de passe envoyé par email à {user.email}.
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Terminé
          </button>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Le mot de passe a été réinitialisé, mais l&apos;envoi de l&apos;email à {user.email} a échoué. Le nouveau
          mot de passe ne s&apos;affiche nulle part — réessayez l&apos;envoi.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? "Envoi..." : "Réessayer l'envoi"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Terminé
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormError error={error ?? undefined} />
      <p className="text-sm text-slate-600">
        Un nouveau mot de passe sera généré et envoyé directement par email à <strong>{user.email}</strong> — il ne
        s&apos;affichera nulle part, pour plus de sécurité.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Envoi..." : "Réinitialiser"}
        </button>
      </div>
    </div>
  );
}

function RoleForm({
  user,
  overrides,
  onDone,
}: {
  user: User;
  overrides: Record<string, boolean>;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await updateUserRole(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);
  const [role, setRole] = useState(user.role);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <FormError error={state?.error} />
        <input type="hidden" name="id" value={user.id} />
        <div>
          <Label>Rôle</Label>
          <Select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <SubmitButton>Enregistrer le rôle</SubmitButton>
        </div>
      </form>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-800 mb-0.5">Permissions individuelles</p>
        <p className="text-xs text-slate-500 mb-3">
          Écarts par rapport au comportement par défaut du rôle « {ROLE_LABELS[role]} ». Chaque changement s&apos;applique
          immédiatement.
        </p>
        <PermissionsEditor userId={user.id} role={role} overrides={overrides} />
      </div>

      <div className="flex justify-end pt-1">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Fermer
        </button>
      </div>
    </div>
  );
}

function PermissionsEditor({
  userId,
  role,
  overrides,
}: {
  userId: string;
  role: Role;
  overrides: Record<string, boolean>;
}) {
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean | null>>(overrides);
  const [, startTransition] = useTransition();

  function setOverride(key: PermissionKey, granted: boolean | null) {
    setLocalOverrides((prev) => ({ ...prev, [key]: granted }));
    startTransition(async () => {
      await setUserPermissionOverride(userId, key, granted);
    });
  }

  return (
    <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{group.label}</p>
          <div className="space-y-1.5">
            {group.keys.map((key) => {
              const roleDefault = roleHasPermission(role, key);
              const override = localOverrides[key] ?? null;
              return (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">{PERMISSION_LABELS[key]}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOverride(key, null)}
                      title={`Défaut du rôle (${roleDefault ? "autorisé" : "refusé"})`}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                        override === null
                          ? "bg-slate-700 text-white border-slate-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      Défaut
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverride(key, true)}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                        override === true
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-slate-200 text-slate-500 hover:bg-emerald-50"
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverride(key, false)}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                        override === false
                          ? "bg-red-600 text-white border-red-600"
                          : "border-slate-200 text-slate-500 hover:bg-red-50"
                      }`}
                    >
                      Non
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditUserForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await updateUser(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="id" value={user.id} />
      <div>
        <Label>Nom complet</Label>
        <Input name="name" defaultValue={user.name} required autoFocus />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" name="email" defaultValue={user.email} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

function WarehouseForm({
  user,
  warehouses,
  onDone,
}: {
  user: User;
  warehouses: Warehouse[];
  onDone: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(user.warehouseId || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateUserWarehouse(user.id, warehouseId || null);
      if (res && "error" in res) {
        setError(res.error ?? "Erreur inconnue.");
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <FormError error={error ?? undefined} />
      <p className="text-sm text-slate-600">
        {ROLE_LABELS[user.role]} ne peut valider une vente que depuis ce dépôt.
      </p>
      <div>
        <Label>Dépôt rattaché</Label>
        <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">— Aucun (ne pourra pas vendre) —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

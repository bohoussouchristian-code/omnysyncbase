"use client";

import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import {
  createUser,
  toggleUserActive,
  resetUserPassword,
  updateUserRole,
  updateUser,
} from "@/lib/actions/users";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";
import { Plus, Power, MoreVertical, KeyRound, ShieldCheck, Pencil } from "lucide-react";

type User = { id: string; name: string; email: string; role: Role; active: boolean };

export function UsersClient({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [activeModal, setActiveModal] = useState<{ type: "password" | "role" | "edit"; user: User } | null>(null);

  function openAction(type: "password" | "role" | "edit", user: User) {
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
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[u.role]}</td>
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
                        canEditRole={u.id !== currentUserId}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel utilisateur">
        <UserForm onDone={() => setShowCreate(false)} />
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
        {activeModal && <RoleForm user={activeModal.user} onDone={() => setActiveModal(null)} />}
      </Modal>

      <Modal
        open={activeModal?.type === "edit"}
        onClose={() => setActiveModal(null)}
        title={`Modifier — ${activeModal?.user.name ?? ""}`}
      >
        {activeModal && <EditUserForm user={activeModal.user} onDone={() => setActiveModal(null)} />}
      </Modal>
    </div>
  );
}

function UserActionsMenu({
  onResetPassword,
  onEditRole,
  onEdit,
  canEditRole,
}: {
  onResetPassword: () => void;
  onEditRole: () => void;
  onEdit: () => void;
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

function UserForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createUser(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

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
        <Input type="password" name="password" required minLength={4} />
      </div>
      <div>
        <Label>Rôle</Label>
        <Select name="role" defaultValue="CAISSIER">
          <option value="ADMIN">Administrateur</option>
          <option value="GERANT">Gérant</option>
          <option value="CAISSIER">Caissier</option>
          <option value="MAGASINIER">Magasinier</option>
        </Select>
      </div>
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
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await resetUserPassword(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="id" value={user.id} />
      <div>
        <Label>Nouveau mot de passe</Label>
        <Input type="password" name="password" required minLength={4} autoFocus />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Réinitialiser</SubmitButton>
      </div>
    </form>
  );
}

function RoleForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await updateUserRole(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="id" value={user.id} />
      <div>
        <Label>Rôle</Label>
        <Select name="role" defaultValue={user.role}>
          <option value="ADMIN">Administrateur</option>
          <option value="GERANT">Gérant</option>
          <option value="CAISSIER">Caissier</option>
          <option value="MAGASINIER">Magasinier</option>
        </Select>
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

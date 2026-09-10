"use client";

import { useActionState, useState } from "react";
import { createUser, toggleUserActive } from "@/lib/actions/users";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";
import { Plus, Power } from "lucide-react";

type User = { id: string; name: string; email: string; role: Role; active: boolean };

export function UsersClient({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [showCreate, setShowCreate] = useState(false);

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
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => toggleUserActive(u.id)}
                        className="text-slate-400 hover:text-red-600 float-right"
                        title={u.active ? "Désactiver" : "Activer"}
                      >
                        <Power size={16} />
                      </button>
                    )}
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

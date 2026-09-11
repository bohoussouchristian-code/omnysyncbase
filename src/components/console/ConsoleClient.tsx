"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany, toggleCompanyActive } from "@/lib/actions/console";
import { Card, Modal, Input, Label, SubmitButton, FormError, Badge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus, Power, Building2 } from "lucide-react";

type Company = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  _count: { users: number; products: number; sales: number };
};

export function ConsoleClient({ companies }: { companies: Company[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  function handleToggle(id: string) {
    if (!confirm("Changer le statut de cette entreprise ?")) return;
    toggleCompanyActive(id).then(() => router.refresh());
  }

  return (
    <div>
      <PageHeader
        title="Entreprises"
        subtitle={`${companies.length} entreprise(s) sur la plateforme`}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvelle entreprise
          </button>
        }
      />

      {companies.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">
          <Building2 className="mx-auto mb-2" size={28} />
          Aucune entreprise pour le moment.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {companies.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-400">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={c.active ? "success" : "default"}>{c.active ? "Active" : "Inactive"}</Badge>
                  <button
                    onClick={() => handleToggle(c.id)}
                    className="text-slate-400 hover:text-red-600"
                    title={c.active ? "Désactiver" : "Activer"}
                  >
                    <Power size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm text-slate-500 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-slate-400 text-xs">Utilisateurs</p>
                  <p className="font-medium text-slate-800">{c._count.users}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Produits</p>
                  <p className="font-medium text-slate-800">{c._count.products}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Ventes</p>
                  <p className="font-medium text-slate-800">{c._count.sales}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">Créée le {formatDate(c.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle entreprise">
        <CompanyForm onDone={() => { setShowCreate(false); router.refresh(); }} />
      </Modal>
    </div>
  );
}

function CompanyForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createCompany(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />

      <div>
        <Label>Nom de l&apos;entreprise</Label>
        <Input name="companyName" required placeholder="Ex: Quincaillerie du Port" />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700 mb-3">Premier compte administrateur</p>
        <div className="space-y-3">
          <div>
            <Label>Nom</Label>
            <Input name="adminName" required placeholder="Ex: Amina Traoré" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" name="adminEmail" required placeholder="admin@entreprise.com" />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <Input type="text" name="adminPassword" required minLength={8} placeholder="Min. 8 caractères" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Créer l&apos;entreprise</SubmitButton>
      </div>
    </form>
  );
}

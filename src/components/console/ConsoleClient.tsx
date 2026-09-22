"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompany, toggleCompanyActive, enterCompany } from "@/lib/actions/console";
import { Card, Modal, Input, Label, Select, SubmitButton, FormError, Badge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus, Power, Building2, LogIn, Copy, Check } from "lucide-react";

type BusinessType = "GENERIQUE" | "QUINCAILLERIE" | "BOISSON" | "LIBRAIRIE";

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  GENERIQUE: "Générique",
  QUINCAILLERIE: "Quincaillerie",
  BOISSON: "Dépôt de boissons",
  LIBRAIRIE: "Librairie",
};

type Company = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  businessType: BusinessType;
  createdAt: Date;
  _count: { users: number; products: number; sales: number };
};

export function ConsoleClient({ companies }: { companies: Company[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [entering, startEntering] = useTransition();
  const router = useRouter();

  function handleToggle(id: string) {
    if (!confirm("Changer le statut de cette entreprise ?")) return;
    toggleCompanyActive(id).then(() => router.refresh());
  }

  function handleEnter(id: string) {
    startEntering(async () => {
      await enterCompany(id);
    });
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
                  <p className="text-xs text-blue-600 font-medium mt-0.5">{BUSINESS_TYPE_LABELS[c.businessType]}</p>
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
              <button
                onClick={() => handleEnter(c.id)}
                disabled={entering}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-sm font-medium hover:bg-blue-100 disabled:opacity-60 transition-colors"
              >
                <LogIn size={15} /> Entrer dans l&apos;entreprise
              </button>
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
  const [created, setCreated] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createCompany(prev, formData);
    if (res && "success" in res && res.success)
      setCreated({ email: res.adminEmail, password: res.adminPassword, emailSent: res.emailSent });
    return res;
  }, undefined as { error?: string } | undefined);

  if (created) {
    return (
      <CreatedCredentials
        email={created.email}
        password={created.password}
        emailSent={created.emailSent}
        onDone={onDone}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />

      <div>
        <Label>Nom de l&apos;entreprise</Label>
        <Input name="companyName" required placeholder="Ex: Quincaillerie du Port" />
      </div>

      <div>
        <Label>Type de métier</Label>
        <Select name="businessType" defaultValue="GENERIQUE">
          <option value="GENERIQUE">Générique</option>
          <option value="QUINCAILLERIE">Quincaillerie</option>
          <option value="BOISSON">Dépôt de boissons</option>
          <option value="LIBRAIRIE">Librairie</option>
        </Select>
        <p className="text-xs text-slate-400 mt-1">
          Adapte automatiquement les champs du formulaire produit (marque, consigne, éditeur...).
        </p>
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
          <p className="text-xs text-slate-400">
            Un mot de passe sera généré automatiquement et affiché à la création — vous le transmettez ensuite à
            cet administrateur.
          </p>
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

function CreatedCredentials({
  email,
  password,
  emailSent,
  onDone,
}: {
  email: string;
  password: string;
  emailSent: boolean;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {emailSent ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          Entreprise créée. Les identifiants ont été envoyés par email à {email}.
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Entreprise créée, mais l&apos;envoi de l&apos;email a échoué. Transmettez ce mot de passe manuellement — il
          ne sera plus jamais affiché.
        </div>
      )}

      <div>
        <Label>E-mail de connexion</Label>
        <Input disabled value={email} className="bg-slate-50" />
      </div>

      <div>
        <Label>Mot de passe généré</Label>
        <div className="flex items-center gap-2">
          <Input disabled value={password} className="bg-slate-50 font-mono tracking-wider" />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
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

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyInfo } from "@/lib/actions/company";
import { Card, PageHeader, Input, Label, FormError, SubmitButton } from "@/components/ui";
import { GraduationCap, Upload } from "lucide-react";

type Company = {
  id: string;
  name: string;
  director: string | null;
  headerText: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const TABS = [
  { key: "general", label: "Informations générales" },
  { key: "contact", label: "Contact" },
  { key: "geo", label: "Coordonnées géographiques" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Le logo reste une petite image encodée en base64, soumise comme un champ
// caché du même formulaire : pas de stockage de fichiers à mettre en place
// pour ce simple logo affiché sur les documents.
export function EntrepriseClient({ company }: { company: Company }) {
  const [state, formAction] = useActionState(updateCompanyInfo, undefined as { error?: string; success?: boolean } | undefined);
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("general");
  const [logoPreview, setLogoPreview] = useState(company.logoUrl || "");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setLogoPreview(dataUrl);
      if (logoInputRef.current) logoInputRef.current.value = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <PageHeader title="Informations de l'entreprise" />

      <Card className="p-5 mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 overflow-hidden">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <GraduationCap size={26} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400">Nom de la structure</p>
          <p className="font-semibold text-slate-900 truncate">{company.name}</p>
          {company.director && <p className="text-sm text-slate-500">Direction : {company.director}</p>}
          {company.phone && <p className="text-sm text-slate-500">{company.phone}</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex gap-1 border-b border-slate-200 mb-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form action={formAction} className="space-y-4">
          <FormError error={state?.error} />
          {state?.success && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Informations enregistrées.
            </div>
          )}

          <input ref={logoInputRef} type="hidden" name="logoUrl" defaultValue={company.logoUrl || ""} />

          <div className={tab === "general" ? "space-y-4" : "hidden"}>
            <div>
              <Label>
                Nom de l&apos;établissement <span className="text-red-500">*</span>
              </Label>
              <Input name="name" defaultValue={company.name} required />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Directeur / Direction</Label>
                <Input name="director" defaultValue={company.director || ""} />
              </div>
              <div>
                <Label>En-tête (utilisé sur les documents)</Label>
                <Input name="headerText" defaultValue={company.headerText || ""} placeholder="Ex : Ministère du Commerce" />
              </div>
            </div>
            <div>
              <Label>Logo</Label>
              <label className="flex items-center gap-2 w-fit rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
                <Upload size={14} />
                Choisir un fichier
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
            </div>
          </div>

          <div className={tab === "contact" ? "space-y-4" : "hidden"}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input name="phone" defaultValue={company.phone || ""} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" name="email" defaultValue={company.email || ""} />
              </div>
            </div>
          </div>

          <div className={tab === "geo" ? "space-y-4" : "hidden"}>
            <div>
              <Label>Adresse</Label>
              <Input name="address" defaultValue={company.address || ""} placeholder="Ex : Abidjan, Cocody" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

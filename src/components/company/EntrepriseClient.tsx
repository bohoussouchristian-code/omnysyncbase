"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyInfo } from "@/lib/actions/company";
import { Card, PageHeader, Input, Label, Select, FormError, SubmitButton, Badge } from "@/components/ui";
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
  fneNcc: string | null;
  fneEnabled: boolean;
  hasFneApiKey: boolean;
  fneBaseUrl: string | null;
  fneTaxCode: "TVA" | "TVAB" | "TVAC" | "TVAD" | null;
};

const FNE_TAX_CODE_LABELS = {
  TVA: "TVA — taux normal (18%)",
  TVAB: "TVAB — taux réduit (9%)",
  TVAC: "TVAC — exonéré conventionnel (0%)",
  TVAD: "TVAD — exonéré légal (0%)",
} as const;

const TABS = [
  { key: "general", label: "Informations générales" },
  { key: "contact", label: "Contact" },
  { key: "geo", label: "Coordonnées géographiques" },
  { key: "fne", label: "Facturation électronique (FNE)" },
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
  const [fneEnabled, setFneEnabled] = useState(company.fneEnabled);

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

          <div className={tab === "fne" ? "space-y-4" : "hidden"}>
            <div className="flex items-center gap-2">
              <Badge tone={fneEnabled ? "success" : "default"}>{fneEnabled ? "Activée" : "Non activée"}</Badge>
              <p className="text-xs text-slate-400">
                La FNE reste propre à votre entreprise — vos identifiants ne sont utilisés que pour vos propres ventes.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>NCC (Numéro de Compte Contribuable)</Label>
                <Input name="fneNcc" defaultValue={company.fneNcc || ""} placeholder="Ex : 1234567A" />
              </div>
              <div>
                <Label>Clé API FNE</Label>
                <Input
                  name="fneApiKey"
                  type="password"
                  placeholder={company.hasFneApiKey ? "••••••••••• (enregistrée)" : "Fournie par la DGI"}
                />
                {company.hasFneApiKey && (
                  <p className="text-xs text-slate-400 mt-1">Laissez vide pour conserver la clé actuelle.</p>
                )}
              </div>
            </div>
            <div>
              <Label>Taux de TVA appliqué à vos ventes</Label>
              <Select name="fneTaxCode" defaultValue={company.fneTaxCode || ""}>
                <option value="">— Sélectionner —</option>
                {Object.entries(FNE_TAX_CODE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-400 mt-1">
                Appliqué à tous les articles de toutes vos ventes certifiées par la FNE (pas encore configurable par
                produit).
              </p>
            </div>
            <div>
              <Label>URL de production (optionnel)</Label>
              <Input
                name="fneBaseUrl"
                defaultValue={company.fneBaseUrl || ""}
                placeholder="http://54.247.95.108/ws (environnement de test utilisé par défaut)"
              />
              <p className="text-xs text-slate-400 mt-1">
                À renseigner uniquement une fois que la DGI vous a transmis votre URL de production, après validation
                de vos spécimens de factures. Laissez vide pour rester sur l&apos;environnement de test.
              </p>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                name="fneEnabled"
                checked={fneEnabled}
                onChange={(e) => setFneEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Activer la FNE pour cette entreprise
            </label>
            <p className="text-xs text-slate-400">
              Renseignez d&apos;abord votre NCC et votre clé API obtenus auprès de la DGI avant d&apos;activer la FNE.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

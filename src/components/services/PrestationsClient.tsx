"use client";

import { useActionState, useMemo, useState } from "react";
import { createService, updateService } from "@/lib/actions/services";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { Plus, Search, Pencil, Clock } from "lucide-react";

type Service = {
  id: string;
  name: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  durationMin: number | null;
  price: number;
  proPrice: number | null;
  active: boolean;
};

type Option = { id: string; name: string };

export function PrestationsClient({
  services,
  categories,
  canManage,
}: {
  services: Service[];
  categories: Option[];
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.category?.name.toLowerCase().includes(q) ?? false)
    );
  }, [services, query]);

  return (
    <div>
      <PageHeader
        title="Prestations"
        subtitle={`${services.length} prestation(s) au catalogue`}
        action={
          canManage ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Nouvelle prestation
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une prestation..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Prestation</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Durée</th>
                <th className="px-4 py-3 font-medium text-right">Prix</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.category?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.durationMin ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {s.durationMin} min
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatMoney(s.price)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.active ? "success" : "default"}>{s.active ? "Actif" : "Inactif"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setEditing(s)}
                          className="text-slate-400 hover:text-blue-600"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune prestation trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle prestation">
        <ServiceForm categories={categories} onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la prestation">
        {editing && <ServiceForm categories={categories} service={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function ServiceForm({
  categories,
  service,
  onDone,
}: {
  categories: Option[];
  service?: Service;
  onDone: () => void;
}) {
  const action = service ? updateService : createService;
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await action(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      {service && <input type="hidden" name="id" value={service.id} />}

      <div>
        <Label>Nom de la prestation</Label>
        <Input name="name" required defaultValue={service?.name} placeholder="Ex: Coupe homme" />
      </div>

      <div>
        <Label>Catégorie</Label>
        <Select name="categoryId" defaultValue={service?.categoryId || ""}>
          <option value="">— Aucune —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Durée (minutes, optionnel)</Label>
          <Input type="number" name="durationMin" min={0} step="1" defaultValue={service?.durationMin ?? ""} />
        </div>
        <div>
          <Label>Prix</Label>
          <Input type="number" name="price" min={0} step="1" required defaultValue={service?.price ?? 0} />
        </div>
      </div>

      <div>
        <Label>Prix professionnel (optionnel)</Label>
        <Input type="number" name="proPrice" min={0} step="1" defaultValue={service?.proPrice ?? ""} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>{service ? "Enregistrer" : "Créer la prestation"}</SubmitButton>
      </div>
    </form>
  );
}

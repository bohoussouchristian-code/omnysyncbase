"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWarehouse, setGeneralWarehouse } from "@/lib/actions/warehouses";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { Plus, Star } from "lucide-react";

type Warehouse = {
  id: string;
  name: string;
  address: string | null;
  type: string;
  active: boolean;
  isGeneral: boolean;
  _count: { stocks: number };
};

export function WarehousesClient({ warehouses }: { warehouses: Warehouse[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function makeGeneral(id: string) {
    startTransition(async () => {
      await setGeneralWarehouse(id);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Dépôts / Boutiques"
        subtitle={`${warehouses.length} emplacement(s)`}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvel emplacement
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Produits référencés</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <div className="flex items-center gap-2">
                      {w.name}
                      {w.isGeneral && <Badge tone="info">Dépôt Général</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{w.type === "ENTREPOT" ? "Entrepôt" : "Boutique"}</td>
                  <td className="px-4 py-3 text-slate-600">{w.address || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{w._count.stocks}</td>
                  <td className="px-4 py-3">
                    <Badge tone={w.active ? "success" : "default"}>{w.active ? "Actif" : "Inactif"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {!w.isGeneral && w.active && (
                      <button
                        onClick={() => makeGeneral(w.id)}
                        disabled={pending}
                        title="Désigner comme Dépôt Général"
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 float-right disabled:opacity-50"
                      >
                        <Star size={14} /> Définir comme Dépôt Général
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau dépôt / boutique">
        <WarehouseForm onDone={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}

function WarehouseForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createWarehouse(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div>
        <Label>Nom</Label>
        <Input name="name" required placeholder="Ex: Boutique Centre-ville" />
      </div>
      <div>
        <Label>Type</Label>
        <Select name="type" defaultValue="BOUTIQUE">
          <option value="ENTREPOT">Entrepôt</option>
          <option value="BOUTIQUE">Boutique / Point de vente</option>
        </Select>
      </div>
      <div>
        <Label>Adresse (optionnel)</Label>
        <Input name="address" />
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

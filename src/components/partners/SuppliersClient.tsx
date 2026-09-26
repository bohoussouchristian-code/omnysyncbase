"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createSupplier, updateSupplier } from "@/lib/actions/partners";
import { addSupplierPayment } from "@/lib/actions/purchases";
import { Modal, Input, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { Plus, Search, Pencil, Wallet, FolderOpen } from "lucide-react";

type Supplier = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  balance: number;
};

export function SuppliersClient({ suppliers, canManage }: { suppliers: Supplier[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q))
    );
  }, [suppliers, query]);

  const totalDebt = suppliers.reduce((s, c) => s + c.balance, 0);

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        subtitle={`${suppliers.length} fournisseur(s) — Dettes totales dues : ${formatMoney(totalDebt)}`}
        action={
          canManage ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Nouveau fournisseur
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, téléphone ou code (FOU-...)"
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium text-right">Montant dû</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.code ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={s.balance > 0 ? "danger" : "success"}>{formatMoney(s.balance)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <Link href={`/fournisseurs/${s.id}`} className="text-slate-400 hover:text-blue-600" title="Voir le dossier">
                        <FolderOpen size={16} />
                      </Link>
                      {s.balance > 0 && (
                        <button onClick={() => setPaying(s)} className="text-slate-400 hover:text-emerald-600" title="Payer">
                          <Wallet size={16} />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => setEditing(s)} className="text-slate-400 hover:text-blue-600" title="Modifier">
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aucun fournisseur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau fournisseur">
        <SupplierForm onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le fournisseur">
        {editing && <SupplierForm supplier={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!paying} onClose={() => setPaying(null)} title="Effectuer un paiement">
        {paying && <PaymentForm supplier={paying} onDone={() => setPaying(null)} />}
      </Modal>
    </div>
  );
}

function SupplierForm({ supplier, onDone }: { supplier?: Supplier; onDone: () => void }) {
  const action = supplier ? updateSupplier : createSupplier;
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await action(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <div>
        <Label>Nom</Label>
        <Input name="name" required defaultValue={supplier?.name} />
      </div>
      <div>
        <Label>Téléphone</Label>
        <Input name="phone" defaultValue={supplier?.phone || ""} />
      </div>
      <div>
        <Label>Adresse</Label>
        <Input name="address" defaultValue={supplier?.address || ""} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>{supplier ? "Enregistrer" : "Créer"}</SubmitButton>
      </div>
    </form>
  );
}

function PaymentForm({ supplier, onDone }: { supplier: Supplier; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await addSupplierPayment(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="supplierId" value={supplier.id} />
      <p className="text-sm text-slate-500">
        Montant dû : <span className="font-semibold text-slate-800">{formatMoney(supplier.balance)}</span>
      </p>
      <div>
        <Label>Montant payé</Label>
        <Input type="number" name="amount" min={1} step="1" max={supplier.balance} required autoFocus />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Payer</SubmitButton>
      </div>
    </form>
  );
}

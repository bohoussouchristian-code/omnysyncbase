"use client";

import { useActionState, useMemo, useState } from "react";
import { createSupplier, updateSupplier } from "@/lib/actions/partners";
import { addSupplierPayment } from "@/lib/actions/purchases";
import { Modal, Input, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus, Search, Pencil, Wallet, History } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  balance: number;
  purchases: { id: string; number: string; date: Date; totalAmount: number; status: string }[];
  payments: { id: string; amount: number; date: Date }[];
};

export function SuppliersClient({ suppliers, canManage }: { suppliers: Supplier[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
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
          placeholder="Rechercher un fournisseur..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium text-right">Montant dû</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={s.balance > 0 ? "danger" : "success"}>{formatMoney(s.balance)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setViewing(s)} className="text-slate-400 hover:text-blue-600" title="Historique">
                        <History size={16} />
                      </button>
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
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
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

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Historique — ${viewing?.name || ""}`}>
        {viewing && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Achats récents</h4>
              {viewing.purchases.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun achat.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {viewing.purchases.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="text-slate-600">{p.number} — {formatDateTime(p.date)}</span>
                      <span className="font-medium">{formatMoney(p.totalAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Paiements récents</h4>
              {viewing.payments.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun paiement.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {viewing.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="text-slate-600">{formatDateTime(p.date)}</span>
                      <span className="font-medium text-emerald-600">{formatMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
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

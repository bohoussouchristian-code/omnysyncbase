"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createCustomer, updateCustomer, recordCustomerPayment } from "@/lib/actions/partners";
import { Modal, Input, Label, Select, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { CUSTOMER_TYPE_LABELS } from "@/lib/constants";
import { Plus, Search, Pencil, Wallet, FolderOpen, Star } from "lucide-react";
import type { CustomerType } from "@prisma/client";

type Customer = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  type: CustomerType;
  creditBalance: number;
  creditLimit: number;
  loyaltyPoints: number;
};

export function CustomersClient({ customers, canManage }: { customers: Customer[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
  }, [customers, query]);

  const totalDebt = customers.reduce((s, c) => s + c.creditBalance, 0);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${customers.length} client(s) — Dettes totales : ${formatMoney(totalDebt)}`}
        action={
          canManage ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Nouveau client
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, téléphone ou code (CLI-...)"
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
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium text-right">Dette actuelle</th>
                <th className="px-4 py-3 font-medium text-right">Limite crédit</th>
                <th className="px-4 py-3 font-medium text-right">Points fidélité</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.code ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{CUSTOMER_TYPE_LABELS[c.type]}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={c.creditBalance > 0 ? "danger" : "success"}>
                      {formatMoney(c.creditBalance)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatMoney(c.creditLimit)}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-medium">
                    {c.loyaltyPoints > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" /> {c.loyaltyPoints}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <Link href={`/clients/${c.id}`} className="text-slate-400 hover:text-blue-600" title="Voir le dossier">
                        <FolderOpen size={16} />
                      </Link>
                      {c.creditBalance > 0 && (
                        <button onClick={() => setPaying(c)} className="text-slate-400 hover:text-emerald-600" title="Encaisser paiement">
                          <Wallet size={16} />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => setEditing(c)} className="text-slate-400 hover:text-blue-600" title="Modifier">
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Aucun client trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau client">
        <CustomerForm onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le client">
        {editing && <CustomerForm customer={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!paying} onClose={() => setPaying(null)} title="Encaisser un paiement">
        {paying && <PaymentForm customer={paying} onDone={() => setPaying(null)} />}
      </Modal>
    </div>
  );
}

function CustomerForm({ customer, onDone }: { customer?: Customer; onDone: () => void }) {
  const action = customer ? updateCustomer : createCustomer;
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await action(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <div>
        <Label>Nom</Label>
        <Input name="name" required defaultValue={customer?.name} />
      </div>
      <div>
        <Label>Téléphone</Label>
        <Input name="phone" defaultValue={customer?.phone || ""} />
      </div>
      <div>
        <Label>Adresse</Label>
        <Input name="address" defaultValue={customer?.address || ""} />
      </div>
      <div>
        <Label>Type de client</Label>
        <Select name="type" defaultValue={customer?.type || "PARTICULIER"}>
          {Object.entries(CUSTOMER_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-500 mt-1">
          Détermine le prix appliqué automatiquement en caisse (si le produit a des prix pro/revendeur).
        </p>
      </div>
      <div>
        <Label>Limite de crédit autorisée</Label>
        <Input type="number" name="creditLimit" min={0} step="1" defaultValue={customer?.creditLimit ?? 0} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>{customer ? "Enregistrer" : "Créer"}</SubmitButton>
      </div>
    </form>
  );
}

function PaymentForm({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await recordCustomerPayment(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="customerId" value={customer.id} />
      <p className="text-sm text-slate-500">
        Dette actuelle : <span className="font-semibold text-slate-800">{formatMoney(customer.creditBalance)}</span>
      </p>
      <div>
        <Label>Montant encaissé</Label>
        <Input type="number" name="amount" min={1} step="1" max={customer.creditBalance} required autoFocus />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Encaisser</SubmitButton>
      </div>
    </form>
  );
}

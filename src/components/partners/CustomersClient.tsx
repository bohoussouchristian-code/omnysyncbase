"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createCustomer, updateCustomer, recordCustomerPayment } from "@/lib/actions/partners";
import { Modal, Input, Label, Select, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { CUSTOMER_TYPE_LABELS, PAYMENT_LABELS } from "@/lib/constants";
import { Plus, Search, Pencil, Wallet, FolderOpen, Star, Printer } from "lucide-react";
import type { CustomerType } from "@prisma/client";
import {
  DebtPaymentReceiptDocument,
  type DebtPaymentReceiptData,
} from "@/components/partners/DebtPaymentReceiptDocument";

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

export function CustomersClient({
  customers,
  canManage,
  companyName,
  userName,
}: {
  customers: Customer[];
  canManage: boolean;
  companyName: string;
  userName: string;
}) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [receipt, setReceipt] = useState<DebtPaymentReceiptData | null>(null);

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
        {paying && (
          <PaymentForm
            customer={paying}
            companyName={companyName}
            userName={userName}
            onDone={() => setPaying(null)}
            onReceipt={(r) => setReceipt(r)}
          />
        )}
      </Modal>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <DebtPaymentReceiptDocument data={receipt} />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div id="receipt-print" className="hidden">
          <DebtPaymentReceiptDocument data={receipt} />
        </div>
      )}
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

function PaymentForm({
  customer,
  companyName,
  userName,
  onDone,
  onReceipt,
}: {
  customer: Customer;
  companyName: string;
  userName: string;
  onDone: () => void;
  onReceipt: (data: DebtPaymentReceiptData) => void;
}) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await recordCustomerPayment(prev, formData);
    if (res && "success" in res && res.success) {
      onReceipt({
        companyName,
        customerName: customer.name,
        customerCode: customer.code,
        amount: res.amount,
        appliedSales: res.appliedSales,
        leftover: res.leftover,
        newBalance: res.newBalance,
        cashierName: userName,
        issuedAt: new Date(),
      });
      onDone();
    }
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
      <div>
        <Label>Mode de paiement</Label>
        <Select name="method" defaultValue="ESPECES">
          {Object.entries(PAYMENT_LABELS)
            .filter(([k]) => k !== "CREDIT")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
      </div>
      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        Encaisser ce paiement exige d&apos;avoir ouvert votre caisse — un règlement en espèces y sera compté à la
        fermeture.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Encaisser</SubmitButton>
      </div>
    </form>
  );
}

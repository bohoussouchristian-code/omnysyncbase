"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createExpense,
  topUpExpenseEnvelope,
  issueExpenseVoucher,
  toggleExpenseEnvelopeActive,
} from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Modal, Input, Select, Label, SubmitButton, FormError, PageHeader, Card, Badge } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus, Wallet, PlusCircle, Fuel, Power } from "lucide-react";
import Link from "next/link";

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: Date;
  warehouse: { name: string } | null;
  user: { name: string } | null;
  cancelled: boolean;
};
type Warehouse = { id: string; name: string };
type Voucher = {
  id: string;
  number: string;
  amount: number;
  beneficiary: string;
  vehiclePlate: string | null;
  issuedAt: Date;
  issuedBy: { name: string } | null;
};
type Envelope = {
  id: string;
  category: string;
  balance: number;
  totalAllocated: number;
  active: boolean;
  vouchers: Voucher[];
};

export function ExpensesClient({
  expenses,
  warehouses,
  envelopes,
  canManageBudgets,
}: {
  expenses: Expense[];
  warehouses: Warehouse[];
  envelopes: Envelope[];
  canManageBudgets: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showVoucher, setShowVoucher] = useState<Envelope | null>(null);
  const total = expenses.filter((e) => !e.cancelled).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle={`Total enregistré : ${formatMoney(total)}`}
        action={
          <div className="flex items-center gap-2">
            {canManageBudgets && (
              <Link
                href="/annulations-depenses"
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annulation de dépense
              </Link>
            )}
            {canManageBudgets && (
              <button
                onClick={() => setShowTopUp(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Wallet size={16} /> Réapprovisionner
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Nouvelle dépense
            </button>
          </div>
        }
      />

      {envelopes.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="mb-3">
            <h2 className="font-semibold text-slate-900">Caisses de dépense</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Une enveloppe par catégorie : son solde suit automatiquement les dépenses enregistrées dans cette
              catégorie, ou les bons émis contre elle.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {envelopes.map((env) => {
              const spent = env.totalAllocated - env.balance;
              const pct = env.totalAllocated > 0 ? Math.min(100, Math.max(0, (spent / env.totalAllocated) * 100)) : 0;
              const overBudget = env.balance < 0;
              return (
                <div key={env.id} className={`border rounded-lg p-3 ${env.active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-800 text-sm">{env.category}</span>
                    {canManageBudgets && (
                      <button
                        onClick={() => toggleExpenseEnvelopeActive(env.id)}
                        title={env.active ? "Désactiver" : "Réactiver"}
                        className="text-slate-300 hover:text-slate-600"
                      >
                        <Power size={13} />
                      </button>
                    )}
                  </div>
                  <p className={`text-lg font-bold ${overBudget ? "text-red-600" : "text-slate-900"}`}>
                    {formatMoney(env.balance)}
                    <span className="text-xs font-normal text-slate-400"> restant</span>
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5 mb-1">
                    <div
                      className={`h-full rounded-full ${overBudget ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${overBudget ? 100 : pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {formatMoney(spent)} consommé sur {formatMoney(env.totalAllocated)} alloué
                  </p>
                  <button
                    onClick={() => setShowVoucher(env)}
                    disabled={!env.active}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 text-blue-700 text-xs font-semibold px-2.5 py-1.5 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Fuel size={12} /> Émettre un bon
                  </button>
                  {env.vouchers.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                      {env.vouchers.slice(0, 3).map((v) => (
                        <div key={v.id} className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate">
                            {v.number} — {v.beneficiary}
                            {v.vehiclePlate ? ` (${v.vehiclePlate})` : ""}
                          </span>
                          <span className="font-medium shrink-0 ml-1">{formatMoney(v.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Dépôt</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className={`border-t border-slate-100 ${e.cancelled ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(e.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{e.category}</td>
                  <td className="px-4 py-3 text-slate-600">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.warehouse?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {e.cancelled ? <Badge tone="danger">Annulée</Badge> : <Badge tone="success">OK</Badge>}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${e.cancelled ? "line-through" : ""}`}>
                    {formatMoney(e.amount)}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune dépense enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle dépense">
        <ExpenseForm warehouses={warehouses} onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal open={showTopUp} onClose={() => setShowTopUp(false)} title="Réapprovisionner une caisse de dépense">
        <TopUpForm onDone={() => setShowTopUp(false)} />
      </Modal>

      <Modal open={!!showVoucher} onClose={() => setShowVoucher(null)} title={`Émettre un bon — ${showVoucher?.category || ""}`}>
        {showVoucher && <VoucherForm envelope={showVoucher} onDone={() => setShowVoucher(null)} />}
      </Modal>
    </div>
  );
}

function ExpenseForm({ warehouses, onDone }: { warehouses: Warehouse[]; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createExpense(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div>
        <Label>Catégorie</Label>
        <Select name="category" required>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Dépôt / Boutique (optionnel)</Label>
        <Select name="warehouseId" defaultValue="">
          <option value="">— Général —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Montant</Label>
        <Input type="number" name="amount" min={1} step="1" required />
      </div>
      <div>
        <Label>Description (optionnel)</Label>
        <Input name="description" placeholder="Détails de la dépense..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

function TopUpForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await topUpExpenseEnvelope(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div>
        <Label>Catégorie</Label>
        <Select name="category" required>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-400 mt-1">
          Crée la caisse de dépense pour cette catégorie si elle n&apos;existe pas encore.
        </p>
      </div>
      <div>
        <Label>Montant à ajouter</Label>
        <Input type="number" name="amount" min={1} step="1" required />
      </div>
      <div>
        <Label>Note (optionnel)</Label>
        <Input name="note" placeholder="Ex : Caution carburant station Shell..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>
          <PlusCircle size={14} className="inline mr-1.5 -mt-0.5" /> Réapprovisionner
        </SubmitButton>
      </div>
    </form>
  );
}

function VoucherForm({ envelope, onDone }: { envelope: Envelope; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await issueExpenseVoucher(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="envelopeId" value={envelope.id} />
      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        Solde actuel de la caisse « {envelope.category} » : <strong>{formatMoney(envelope.balance)}</strong>
      </p>
      <div>
        <Label>Bénéficiaire</Label>
        <Input name="beneficiary" placeholder="Nom du chauffeur / employé" required />
      </div>
      <div>
        <Label>Véhicule (optionnel)</Label>
        <Input name="vehiclePlate" placeholder="Immatriculation" />
      </div>
      <div>
        <Label>Montant du bon</Label>
        <Input type="number" name="amount" min={1} step="1" required />
      </div>
      <div>
        <Label>Note (optionnel)</Label>
        <Input name="notes" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Émettre le bon</SubmitButton>
      </div>
    </form>
  );
}

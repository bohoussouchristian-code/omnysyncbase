"use client";

import { useActionState, useState } from "react";
import { createExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Modal, Input, Select, Label, SubmitButton, FormError, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus } from "lucide-react";

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: Date;
  warehouse: { name: string } | null;
  user: { name: string } | null;
};
type Warehouse = { id: string; name: string };

export function ExpensesClient({ expenses, warehouses }: { expenses: Expense[]; warehouses: Warehouse[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle={`Total enregistré : ${formatMoney(total)}`}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvelle dépense
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Dépôt</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(e.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{e.category}</td>
                  <td className="px-4 py-3 text-slate-600">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.warehouse?.name || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(e.amount)}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
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

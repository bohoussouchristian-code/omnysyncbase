"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { setGeneralBalanceBase } from "@/lib/actions/generalBalance";
import { Card, PageHeader, StatCard, Modal, Input, Label, SubmitButton, FormError } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Pencil } from "lucide-react";

type Data = {
  baseAmount: number;
  totalSalesCollected: number;
  totalExpenses: number;
  balance: number;
  updatedAt: Date | null;
  updatedByName: string | null;
};

// Solde fictif de l'entreprise, distinct des vrais comptes bancaires de
// Trésorerie : base de départ + tout l'historique de ventes encaissées −
// toutes les dépenses non annulées, sans notion de période (voir
// getGeneralBalanceData dans src/lib/actions/generalBalance.ts).
export function SoldeGeneralClient({ data, canEdit }: { data: Data; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Solde général"
        subtitle="Base de départ + tout l'historique de ventes encaissées − toutes les dépenses — indépendant de toute période."
        action={
          canEdit ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={16} /> Modifier la base
            </button>
          ) : undefined
        }
      />

      <Card className="p-6 mb-4 text-center">
        <p className="text-sm text-slate-400 mb-1">Solde général</p>
        <p className={`text-4xl font-bold ${data.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {formatMoney(data.balance)}
        </p>
        {data.updatedAt && (
          <p className="text-xs text-slate-400 mt-2">
            Base de départ fixée le {formatDateTime(data.updatedAt)}
            {data.updatedByName ? ` par ${data.updatedByName}` : ""}
          </p>
        )}
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Base de départ" value={formatMoney(data.baseAmount)} />
        <StatCard label="Ventes encaissées (total)" value={formatMoney(data.totalSalesCollected)} tone="success" />
        <StatCard label="Dépenses (total)" value={formatMoney(data.totalExpenses)} tone="danger" />
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier la base de départ">
        <BaseForm currentAmount={data.baseAmount} onDone={() => { setEditing(false); router.refresh(); }} />
      </Modal>
    </div>
  );
}

function BaseForm({ currentAmount, onDone }: { currentAmount: number; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await setGeneralBalanceBase(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <p className="text-sm text-slate-500">
        Le solde du jour où vous démarrez le suivi — tout ce qui a été encaissé/dépensé avant cette base n&apos;est
        pas recalculé rétroactivement.
      </p>
      <div>
        <Label>Base de départ (FCFA)</Label>
        <Input type="number" name="baseAmount" step="1" defaultValue={currentAmount} required />
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

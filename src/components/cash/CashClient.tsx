"use client";

import { useActionState } from "react";
import { openCashSession, closeCashSession } from "@/lib/actions/cash";
import { Card, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";

type Warehouse = { id: string; name: string };
type Session = {
  id: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  openedAt: Date;
  closedAt: Date | null;
  warehouse: { name: string };
  user: { name: string };
};

export function CashClient({
  warehouses,
  sessions,
  mySession,
}: {
  warehouses: Warehouse[];
  sessions: Session[];
  mySession: { id: string; warehouse: { name: string }; openingAmount: number; openedAt: Date } | null;
}) {
  return (
    <div>
      <PageHeader title="Sessions de caisse" subtitle="Ouvrez et fermez vos sessions de caisse quotidiennes" />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 lg:col-span-1">
          {mySession ? (
            <CloseForm session={mySession} />
          ) : (
            <OpenForm warehouses={warehouses} />
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 mb-3">Historique des sessions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Ouverture</th>
                  <th className="pb-2 font-medium">Boutique</th>
                  <th className="pb-2 font-medium">Caissier</th>
                  <th className="pb-2 font-medium text-right">Fond initial</th>
                  <th className="pb-2 font-medium text-right">Attendu</th>
                  <th className="pb-2 font-medium text-right">Compté</th>
                  <th className="pb-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                    <td className="py-2 text-slate-600">{s.warehouse.name}</td>
                    <td className="py-2 text-slate-600">{s.user.name}</td>
                    <td className="py-2 text-right">{formatMoney(s.openingAmount)}</td>
                    <td className="py-2 text-right">{s.expectedAmount != null ? formatMoney(s.expectedAmount) : "—"}</td>
                    <td className="py-2 text-right">{s.closingAmount != null ? formatMoney(s.closingAmount) : "—"}</td>
                    <td className="py-2">
                      <Badge tone={s.closedAt ? "default" : "success"}>{s.closedAt ? "Fermée" : "Ouverte"}</Badge>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Aucune session enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function OpenForm({ warehouses }: { warehouses: Warehouse[] }) {
  const [state, formAction] = useActionState(openCashSession, undefined as { error?: string } | undefined);
  return (
    <form action={formAction} className="space-y-4">
      <h2 className="font-semibold text-slate-900">Ouvrir une session</h2>
      <FormError error={state?.error} />
      <div>
        <Label>Dépôt / Boutique</Label>
        <Select name="warehouseId" required>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Fond de caisse initial</Label>
        <Input type="number" name="openingAmount" min={0} step="1" defaultValue={0} required />
      </div>
      <SubmitButton className="w-full">Ouvrir la caisse</SubmitButton>
    </form>
  );
}

function CloseForm({
  session,
}: {
  session: { id: string; warehouse: { name: string }; openingAmount: number; openedAt: Date };
}) {
  const [state, formAction] = useActionState(closeCashSession, undefined as
    | { error?: string; success?: boolean; expectedAmount?: number }
    | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="font-semibold text-slate-900">Session ouverte — {session.warehouse.name}</h2>
      <p className="text-xs text-slate-400">Depuis {formatDateTime(session.openedAt)}</p>
      <FormError error={state?.error} />
      {state?.success && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Session fermée. Montant attendu : {formatMoney(state.expectedAmount || 0)}
        </div>
      )}
      <input type="hidden" name="id" value={session.id} />
      <p className="text-sm text-slate-500">Fond initial : {formatMoney(session.openingAmount)}</p>
      <div>
        <Label>Montant compté en caisse</Label>
        <Input type="number" name="closingAmount" min={0} step="1" required />
      </div>
      <div>
        <Label>Remarques (optionnel)</Label>
        <Input name="notes" />
      </div>
      <SubmitButton className="w-full">Fermer la caisse</SubmitButton>
    </form>
  );
}

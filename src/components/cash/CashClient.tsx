"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { openCashSession } from "@/lib/actions/cash";
import { Card, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader } from "@/components/ui";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { CashClosingForm } from "@/components/cash/CashClosingForm";

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
  cumul,
  dailyRecap,
}: {
  warehouses: Warehouse[];
  sessions: Session[];
  mySession: { id: string; warehouse: { name: string }; openingAmount: number; openedAt: Date } | null;
  cumul: number | null;
  dailyRecap: { date: Date; total: number }[];
}) {
  const router = useRouter();

  return (
    <div>
      <PageHeader title="Sessions de caisse" subtitle="Ouvrez et fermez vos sessions de caisse quotidiennes" />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 lg:col-span-1">
          {mySession ? (
            <div className="space-y-4">
              {cumul != null && (
                <div className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="text-emerald-700">Cumul actuel</span>
                  <span className="font-semibold text-emerald-700">{formatMoney(cumul)}</span>
                </div>
              )}
              <CashClosingForm session={mySession} onClosed={() => router.refresh()} />
            </div>
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

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Récap quotidien — toutes activités (7 derniers jours)</h2>
        <ul className="space-y-1.5">
          {dailyRecap.map((d) => (
            <li key={d.date.toISOString()} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{formatDate(d.date)}</span>
              <span className="font-medium text-slate-800">{formatMoney(d.total)}</span>
            </li>
          ))}
        </ul>
      </Card>
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


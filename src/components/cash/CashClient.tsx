"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashSession, withdrawCashAdvance, reimburseCashAdvance } from "@/lib/actions/cash";
import { Card, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, StatCard } from "@/components/ui";
import { DateRangePicker } from "@/components/DateRangePicker";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { CashClosingForm } from "@/components/cash/CashClosingForm";
import { PrintButton } from "@/components/PrintButton";
import { Search, Wallet, HandCoins } from "lucide-react";

type Warehouse = { id: string; name: string };
type Session = {
  id: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  changeGivenTotal: number;
  openedAt: Date;
  closedAt: Date | null;
  warehouse: { name: string };
  user: { name: string };
};
type Stats = {
  totalCollected: number;
  openPointsCount: number;
  openPointsTotal: number;
  changeGivenTotal: number;
};
type Advance = {
  id: string;
  amount: number;
  reason: string;
  withdrawnAt: Date;
  reimbursedAt: Date | null;
};

export function CashClient({
  warehouses,
  sessions,
  mySession,
  myAdvances,
  cumul,
  from,
  to,
  stats,
}: {
  warehouses: Warehouse[];
  sessions: Session[];
  mySession: { id: string; warehouse: { name: string }; openingAmount: number; openedAt: Date } | null;
  myAdvances: Advance[];
  cumul: number | null;
  from: string;
  to: string;
  stats: Stats;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.user.name.toLowerCase().includes(q) || s.warehouse.name.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  return (
    <div>
      <PageHeader
        title="État de mes caisses"
        subtitle={`Activité du ${formatDate(from)} au ${formatDate(to)}`}
        action={
          <div className="flex items-center gap-2">
            <DateRangePicker from={from} to={to} onApply={(f, t) => router.push(`/caisse?from=${f}&to=${t}`)} />
            <PrintButton />
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Montant total encaissé" value={formatMoney(stats.totalCollected)} />
        <StatCard
          label={`Point caisse ouverte [ ${stats.openPointsCount} ]`}
          value={formatMoney(stats.openPointsTotal)}
        />
        <StatCard label="Solde monnaie" value={formatMoney(stats.changeGivenTotal)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="no-print p-5 lg:col-span-1">
          {mySession ? (
            <div className="space-y-4">
              {cumul != null && (
                <div className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="text-emerald-700">Cumul actuel</span>
                  <span className="font-semibold text-emerald-700">{formatMoney(cumul)}</span>
                </div>
              )}
              <CashClosingForm session={mySession} onClosed={() => router.refresh()} />
              <div className="pt-4 border-t border-slate-100">
                <CashAdvancesPanel sessionId={mySession.id} advances={myAdvances} />
              </div>
            </div>
          ) : (
            <OpenForm warehouses={warehouses} />
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-slate-900">
              Liste des sessions de caisse <span className="text-slate-400 font-normal">[ {filtered.length} ]</span>
            </h2>
            <div className="no-print relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-56 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Caissier(ère)</th>
                  <th className="pb-2 font-medium">Boutique</th>
                  <th className="pb-2 font-medium">Ouverture</th>
                  <th className="pb-2 font-medium">Clôture</th>
                  <th className="pb-2 font-medium text-right">Montant compté</th>
                  <th className="pb-2 font-medium text-right">Monnaie gardée</th>
                  <th className="pb-2 font-medium text-right">Écart</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const ecart = s.closingAmount != null && s.expectedAmount != null ? s.closingAmount - s.expectedAmount : null;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2">
                        <Badge tone={s.closedAt ? "default" : "success"}>{s.closedAt ? "Fermée" : "Ouverte"}</Badge>
                      </td>
                      <td className="py-2 text-slate-600">{s.user.name}</td>
                      <td className="py-2 text-slate-600">{s.warehouse.name}</td>
                      <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                      <td className="py-2 text-slate-500 whitespace-nowrap">
                        {s.closedAt ? formatDateTime(s.closedAt) : "—"}
                      </td>
                      <td className="py-2 text-right">{s.closingAmount != null ? formatMoney(s.closingAmount) : "—"}</td>
                      <td className="py-2 text-right">
                        {s.changeGivenTotal > 0 ? formatMoney(s.changeGivenTotal) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {ecart == null ? (
                          "—"
                        ) : (
                          <span className={ecart === 0 ? "text-emerald-600" : "text-red-600 font-medium"}>
                            {ecart === 0 ? "0 FCFA" : formatMoney(Math.abs(ecart))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      {sessions.length === 0 ? "Aucune session sur cette période." : "Aucun résultat."}
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
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Wallet size={18} />
        </div>
        <h2 className="font-semibold text-slate-900">Ouvrir ma caisse</h2>
      </div>
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

// Retrait de caisse pour une dépense urgente et imprévue : reste visible et
// bloquant (voir closeCashSession) tant qu'il n'est pas remboursé — l'argent
// doit être remis en caisse avant de pouvoir fermer la session.
function CashAdvancesPanel({ sessionId, advances }: { sessionId: string; advances: Advance[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reimbursingId, setReimbursingId] = useState<string | null>(null);

  const unreimbursed = advances.filter((a) => !a.reimbursedAt);
  const unreimbursedTotal = unreimbursed.reduce((s, a) => s + a.amount, 0);

  function submitWithdraw() {
    setError(null);
    if (!amount || Number(amount) <= 0) return setError("Montant invalide.");
    if (!reason.trim()) return setError("Le motif est obligatoire.");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", sessionId);
      formData.set("amount", amount);
      formData.set("reason", reason);
      const res = await withdrawCashAdvance(undefined, formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAmount("");
      setReason("");
      setShowForm(false);
      router.refresh();
    });
  }

  function reimburse(advanceId: string) {
    setReimbursingId(advanceId);
    startTransition(async () => {
      await reimburseCashAdvance(advanceId);
      setReimbursingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HandCoins size={15} className="text-slate-400" /> Avances de caisse
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            + Retrait
          </button>
        )}
      </div>

      {unreimbursedTotal > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {formatMoney(unreimbursedTotal)} à rembourser avant de pouvoir fermer la caisse.
        </p>
      )}

      {showForm && (
        <div className="space-y-2 border border-slate-200 rounded-lg p-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Input
            type="number"
            min={1}
            step="1"
            placeholder="Montant"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            placeholder="Motif (ex : carburant urgent)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={submitWithdraw}
              disabled={pending}
              className="flex-1 rounded-lg bg-slate-900 text-white py-1.5 text-xs font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "..." : "Retirer"}
            </button>
          </div>
        </div>
      )}

      {advances.length > 0 && (
        <ul className="space-y-1.5">
          {advances.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <p className="text-slate-700 truncate">{a.reason}</p>
                <p className="text-slate-400">{formatDateTime(a.withdrawnAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-slate-700">{formatMoney(a.amount)}</span>
                {a.reimbursedAt ? (
                  <Badge tone="success">Remboursée</Badge>
                ) : (
                  <button
                    onClick={() => reimburse(a.id)}
                    disabled={pending && reimbursingId === a.id}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-medium hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {pending && reimbursingId === a.id ? "..." : "Rembourser"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

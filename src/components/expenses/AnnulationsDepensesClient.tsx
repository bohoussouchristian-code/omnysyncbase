"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelExpense } from "@/lib/actions/expenses";
import { Card, Modal, PageHeader, Badge } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Search, Ban } from "lucide-react";

type ActiveExpense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: Date;
  warehouse: { name: string } | null;
  user: { name: string } | null;
};
type CancelledExpense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  cancelReason: string | null;
  cancelledAt: Date | null;
  warehouse: { name: string } | null;
  cancelledBy: { name: string } | null;
};

// Module dédié à l'annulation des dépenses, distinct de l'annulation des
// ventes : motif obligatoire conservé pour l'audit, avec son propre
// historique juste en dessous. Restitue le montant à la caisse de dépense
// concernée (voir cancelExpense).
export function AnnulationsDepensesClient({
  activeExpenses,
  cancelledExpenses,
}: {
  activeExpenses: ActiveExpense[];
  cancelledExpenses: CancelledExpense[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ActiveExpense | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeExpenses;
    return activeExpenses.filter(
      (e) => e.category.toLowerCase().includes(q) || (e.description?.toLowerCase().includes(q) ?? false)
    );
  }, [activeExpenses, query]);

  function openCancel(expense: ActiveExpense) {
    setTarget(expense);
    setReason("");
    setError(null);
  }

  function confirmCancel() {
    if (!target) return;
    if (!reason.trim()) {
      setError("Le motif d'annulation est obligatoire.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelExpense(target.id, reason);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader title="Annulation de dépense" />

      <Card className="overflow-hidden mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h2 className="font-semibold text-slate-900">
            Dépenses annulables <span className="text-slate-400 font-normal">[ {filteredActive.length} ]</span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une catégorie, une description..."
              className="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Dépôt</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredActive.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{e.category}</td>
                  <td className="px-4 py-3 text-slate-600">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.warehouse?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(e.date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(e.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openCancel(e)}
                      title="Annuler cette dépense"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
                    >
                      <Ban size={14} /> Annuler
                    </button>
                  </td>
                </tr>
              ))}
              {filteredActive.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {activeExpenses.length === 0 ? "Aucune dépense annulable." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-4">
          <h2 className="font-semibold text-slate-900">
            Historique des annulations <span className="text-slate-400 font-normal">[ {cancelledExpenses.length} ]</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Dépôt</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium">Annulée le</th>
                <th className="px-4 py-3 font-medium">Par</th>
                <th className="px-4 py-3 font-medium">Motif</th>
              </tr>
            </thead>
            <tbody>
              {cancelledExpenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{e.category}</td>
                  <td className="px-4 py-3 text-slate-600">{e.warehouse?.name || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(e.amount)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {e.cancelledAt ? formatDateTime(e.cancelledAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.cancelledBy?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={e.cancelReason || ""}>
                    {e.cancelReason || <Badge tone="default">Sans motif</Badge>}
                  </td>
                </tr>
              ))}
              {cancelledExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune annulation enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!target} onClose={() => setTarget(null)} title={`Annuler la dépense — ${target?.category || ""}`}>
        {target && (
          <div className="space-y-4">
            <div className="text-sm bg-slate-50 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Catégorie</span>
                <span className="font-medium">{target.category}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Montant</span>
                <span className="font-semibold">{formatMoney(target.amount)}</span>
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Si cette dépense relève d&apos;une caisse de dépense, son montant lui sera restitué.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motif d&apos;annulation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Ex : erreur de saisie, doublon..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
              <button
                onClick={confirmCancel}
                disabled={pending || reason.trim() === ""}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Annulation..." : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

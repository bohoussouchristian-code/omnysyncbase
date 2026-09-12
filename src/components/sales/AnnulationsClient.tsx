"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSale } from "@/lib/actions/sales";
import { Card, Modal, PageHeader, Badge } from "@/components/ui";
import { SaleStatusBadge } from "@/components/sales/SaleStatusBadge";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Search, Ban, Lock } from "lucide-react";

type ActiveSale = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  status: string;
  customer: { name: string } | null;
  warehouse: { name: string };
  user: { name: string } | null;
  locked: boolean;
};
type CancelledSale = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  cancelReason: string | null;
  cancelledAt: Date | null;
  customer: { name: string } | null;
  warehouse: { name: string };
  cancelledBy: { name: string } | null;
};

// Module dédié à toutes les annulations de vente : plus aucune annulation en
// un clic ailleurs dans l'app (Caisse, Historique des ventes) — tout passe
// par ici, avec un motif obligatoire conservé pour l'audit.
export function AnnulationsClient({
  activeSales,
  cancelledSales,
}: {
  activeSales: ActiveSale[];
  cancelledSales: CancelledSale[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ActiveSale | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeSales;
    return activeSales.filter(
      (s) => s.number.toLowerCase().includes(q) || (s.customer?.name.toLowerCase().includes(q) ?? false)
    );
  }, [activeSales, query]);

  function openCancel(sale: ActiveSale) {
    setTarget(sale);
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
      const res = await cancelSale(target.id, reason);
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
      <PageHeader
        title="Annulation de facture"
        subtitle="Gère toutes les annulations de ventes — un motif est obligatoire"
      />

      <Card className="overflow-hidden mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h2 className="font-semibold text-slate-900">
            Factures annulables <span className="text-slate-400 font-normal">[ {filteredActive.length} ]</span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un n°, un client..."
              className="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredActive.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{s.number}</td>
                  <td className="px-4 py-3 text-slate-600">{s.customer?.name || "Client comptant"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <SaleStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(s.date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(s.totalAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    {s.locked ? (
                      <span
                        title="Caisse déjà clôturée : cette vente ne peut plus être annulée"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-400 px-3 py-1.5 text-xs font-medium cursor-not-allowed"
                      >
                        <Lock size={14} /> Verrouillée
                      </span>
                    ) : (
                      <button
                        onClick={() => openCancel(s)}
                        title="Annuler cette facture"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
                      >
                        <Ban size={14} /> Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredActive.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {activeSales.length === 0 ? "Aucune facture annulable." : "Aucun résultat."}
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
            Historique des annulations <span className="text-slate-400 font-normal">[ {cancelledSales.length} ]</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium">Annulée le</th>
                <th className="px-4 py-3 font-medium">Par</th>
                <th className="px-4 py-3 font-medium">Motif</th>
              </tr>
            </thead>
            <tbody>
              {cancelledSales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{s.number}</td>
                  <td className="px-4 py-3 text-slate-600">{s.customer?.name || "Client comptant"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.warehouse.name}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(s.totalAmount)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {s.cancelledAt ? formatDateTime(s.cancelledAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.cancelledBy?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={s.cancelReason || ""}>
                    {s.cancelReason || <Badge tone="default">Sans motif</Badge>}
                  </td>
                </tr>
              ))}
              {cancelledSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Aucune annulation enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!target} onClose={() => setTarget(null)} title={`Annuler la facture ${target?.number || ""}`}>
        {target && (
          <div className="space-y-4">
            <div className="text-sm bg-slate-50 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Client</span>
                <span className="font-medium">{target.customer?.name || "Client comptant"}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Montant</span>
                <span className="font-semibold">{formatMoney(target.totalAmount)}</span>
              </div>
            </div>
            {target.status !== "EN_ATTENTE" && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Cette facture a déjà été encaissée/livrée : l&apos;annulation remettra le stock à jour et annulera
                la dette/les points fidélité associés au client.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motif d&apos;annulation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Ex : erreur de saisie, client insatisfait, doublon..."
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

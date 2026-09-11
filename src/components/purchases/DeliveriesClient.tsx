"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receivePurchase } from "@/lib/actions/purchases";
import { Modal, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { PackageCheck, Eye } from "lucide-react";

type Purchase = {
  id: string;
  number: string;
  date: Date;
  status: string;
  totalAmount: number;
  receivedAt: Date | null;
  supplier: { name: string };
  warehouse: { name: string };
  receivedBy: { name: string } | null;
  items: { id: string; quantity: number; unitPrice: number; product: { name: string } }[];
};

export function DeliveriesClient({ purchases }: { purchases: Purchase[] }) {
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pendingDeliveries = purchases.filter((p) => p.status === "EN_ATTENTE");
  const receivedDeliveries = purchases
    .filter((p) => p.status === "RECUE")
    .sort((a, b) => (b.receivedAt?.getTime() || 0) - (a.receivedAt?.getTime() || 0));

  function handleReceive(id: string) {
    startTransition(async () => {
      await receivePurchase(id);
      router.refresh();
      setViewing(null);
    });
  }

  return (
    <div>
      <PageHeader title="Bons de livraison" subtitle="Réception des commandes fournisseur au Dépôt Général" />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-1">En attente de réception</h2>
          <p className="text-xs text-slate-400 mb-3">
            Renseignez ici l&apos;arrivée d&apos;une commande : la marchandise entre alors au Dépôt Général.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">N° commande</th>
                  <th className="pb-2 font-medium">Commandé le</th>
                  <th className="pb-2 font-medium">Fournisseur</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pendingDeliveries.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-medium text-slate-700">{p.number}</td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(p.date)}</td>
                    <td className="py-2 text-slate-600">{p.supplier.name}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => setViewing(p)} className="text-slate-400 hover:text-blue-600">
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleReceive(p.id)}
                          disabled={pending}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <PackageCheck size={14} /> Réceptionner
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Aucune livraison en attente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Historique des livraisons reçues</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">N° commande</th>
                  <th className="pb-2 font-medium">Reçu le</th>
                  <th className="pb-2 font-medium">Reçu par</th>
                  <th className="pb-2 font-medium">Fournisseur</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {receivedDeliveries.slice(0, 30).map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-medium text-slate-700">{p.number}</td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">
                      {p.receivedAt ? formatDateTime(p.receivedAt) : "—"}
                    </td>
                    <td className="py-2 text-slate-600">{p.receivedBy?.name || "—"}</td>
                    <td className="py-2 text-slate-600">{p.supplier.name}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                  </tr>
                ))}
                {receivedDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Aucune livraison reçue pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Commande ${viewing?.number || ""}`}>
        {viewing && (
          <div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium text-right">Qté</th>
                  <th className="pb-2 font-medium text-right">P.U.</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1.5">{it.product.name}</td>
                    <td className="py-1.5 text-right">{it.quantity}</td>
                    <td className="py-1.5 text-right">{formatMoney(it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-semibold mb-4">
              <span>Total</span>
              <span>{formatMoney(viewing.totalAmount)}</span>
            </div>
            {viewing.status === "EN_ATTENTE" && (
              <button
                onClick={() => handleReceive(viewing.id)}
                disabled={pending}
                className="w-full rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-medium hover:bg-emerald-700"
              >
                Réceptionner la marchandise
              </button>
            )}
            {viewing.status === "RECUE" && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Reçue le {viewing.receivedAt ? formatDateTime(viewing.receivedAt) : "—"}
                {viewing.receivedBy ? ` par ${viewing.receivedBy.name}` : ""} — {viewing.warehouse.name}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

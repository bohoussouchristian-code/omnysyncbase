"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stockPurchase } from "@/lib/actions/purchases";
import { Modal, PageHeader, Card, Badge } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Boxes, Eye, Search } from "lucide-react";

type Purchase = {
  id: string;
  number: string;
  date: Date;
  status: string;
  totalAmount: number;
  receivedAt: Date | null;
  stockedAt: Date | null;
  supplier: { name: string };
  warehouse: { name: string };
  stockedBy: { name: string } | null;
  items: { id: string; quantity: number; unitPrice: number; product: { name: string } }[];
};

// Étape distincte du bon de livraison : la marchandise a été réceptionnée,
// mais n'entre en stock qu'ici, une fois effectivement rangée/comptée.
export function ApprovisionnementClient({ purchases }: { purchases: Purchase[] }) {
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const q = query.trim().toLowerCase();

  const rows = useMemo(
    () =>
      purchases
        .filter((p) => !q || p.number.toLowerCase().includes(q) || p.supplier.name.toLowerCase().includes(q))
        .sort((a, b) => (b.receivedAt ?? b.date).getTime() - (a.receivedAt ?? a.date).getTime()),
    [purchases, q]
  );

  function handleStock(id: string) {
    startTransition(async () => {
      await stockPurchase(id);
      router.refresh();
      setViewing(null);
    });
  }

  return (
    <div>
      <PageHeader title="Approvisionnement" />

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un n° de commande..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="p-5">
        <p className="text-xs text-slate-400 mb-3">
          Une commande déjà réceptionnée (bon de livraison) n&apos;entre en stock qu&apos;une fois approvisionnée ici.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">N° commande</th>
                <th className="pb-2 font-medium">Fournisseur</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isPending = !p.stockedAt;
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {p.number}
                        <CopyButton text={p.number} />
                      </div>
                    </td>
                    <td className="py-2 text-slate-600">{p.supplier.name}</td>
                    <td className="py-2">
                      <Badge tone={isPending ? "warning" : "success"}>
                        {isPending ? "En attente d'approvisionnement" : "Approvisionnée"}
                      </Badge>
                    </td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">
                      {formatDateTime(isPending ? p.receivedAt ?? p.date : p.stockedAt ?? p.date)}
                    </td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => setViewing(p)} className="text-slate-400 hover:text-blue-600">
                          <Eye size={16} />
                        </button>
                        {isPending && (
                          <button
                            onClick={() => handleStock(p.id)}
                            disabled={pending}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <Boxes size={14} /> Approvisionner
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {q ? "Aucun résultat." : "Aucune commande reçue pour le moment."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
            {!viewing.stockedAt ? (
              <button
                onClick={() => handleStock(viewing.id)}
                disabled={pending}
                className="w-full rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-medium hover:bg-emerald-700"
              >
                Approvisionner — créditer le stock
              </button>
            ) : (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Approvisionnée le {formatDateTime(viewing.stockedAt)}
                {viewing.stockedBy ? ` par ${viewing.stockedBy.name}` : ""} — {viewing.warehouse.name}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

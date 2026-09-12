"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Modal, PageHeader } from "@/components/ui";
import { DateRangePicker } from "@/components/DateRangePicker";
import { SaleStatusBadge } from "@/components/sales/SaleStatusBadge";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Eye, Search } from "lucide-react";

type Sale = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  status: string;
  paymentMethod: string;
  customer: { name: string } | null;
  warehouse: { name: string };
  user: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: { name: string } | null;
    service: { name: string } | null;
  }[];
};

export function SalesHistoryClient({
  sales,
  from,
  to,
}: {
  sales: Sale[];
  from: string;
  to: string;
}) {
  const [detail, setDetail] = useState<Sale | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) => s.number.toLowerCase().includes(q) || (s.customer?.name.toLowerCase().includes(q) ?? false)
    );
  }, [sales, query]);

  return (
    <div>
      <PageHeader title="Historique des ventes" subtitle={`${filteredSales.length} vente(s)`} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-end gap-2 p-5 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un n°, un client..."
              className="w-56 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <DateRangePicker from={from} to={to} onApply={(f, t) => router.push(`/ventes/historique?from=${f}&to=${t}`)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Payé</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{s.number}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(s.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{s.customer?.name || "Client comptant"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <SaleStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(s.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatMoney(s.paidAmount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setDetail(s)} className="text-slate-400 hover:text-blue-600">
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    {sales.length === 0 ? "Aucune vente sur cette période." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Vente ${detail?.number || ""}`}>
        {detail && (
          <div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <p className="text-slate-400">Date</p>
                <p className="font-medium">{formatDateTime(detail.date)}</p>
              </div>
              <div>
                <p className="text-slate-400">Client</p>
                <p className="font-medium">{detail.customer?.name || "Client comptant"}</p>
              </div>
              <div>
                <p className="text-slate-400">Boutique</p>
                <p className="font-medium">{detail.warehouse.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Vendeur</p>
                <p className="font-medium">{detail.user?.name || "—"}</p>
              </div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium text-right">Qté</th>
                  <th className="pb-2 font-medium text-right">P.U.</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1.5">{it.product?.name ?? it.service?.name ?? "—"}</td>
                    <td className="py-1.5 text-right">{it.quantity}</td>
                    <td className="py-1.5 text-right">{formatMoney(it.unitPrice)}</td>
                    <td className="py-1.5 text-right font-medium">{formatMoney(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total payé</span>
              <span className="font-medium">{formatMoney(detail.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-slate-100 pt-2 mt-2">
              <span>Total</span>
              <span>{formatMoney(detail.totalAmount)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Modal } from "@/components/ui";
import { DateRangePicker } from "@/components/DateRangePicker";
import { SaleStatusBadge } from "@/components/sales/SaleStatusBadge";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Eye, Search, Printer } from "lucide-react";
import { ReceiptDocument, buildReceiptData, packAwareQtyLabel, type ReceiptData } from "@/components/sales/ReceiptDocument";
import type { PaymentMethod } from "@prisma/client";

type Sale = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  dueDate: Date | null;
  pointsEarned: number;
  status: string;
  validatedAt: Date | null;
  customer: { name: string } | null;
  warehouse: { name: string; address: string | null };
  user: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: {
      name: string;
      unit: { symbol: string } | null;
      packUnit: { symbol: string } | null;
      piecesPerPack: number;
    } | null;
    service: { name: string } | null;
  }[];
  payments: { amount: number; cashReceived: number | null; changeGiven: number | null }[];
  fneStatus: "NON_APPLICABLE" | "CERTIFIED" | "FAILED";
  fneReference: string | null;
  fneToken: string | null;
  fneError: string | null;
};

export function SalesHistoryClient({
  sales,
  from,
  to,
  companyName,
  basePath = "/ventes/historique",
}: {
  sales: Sale[];
  from: string;
  to: string;
  companyName: string;
  basePath?: string;
}) {
  const [detail, setDetail] = useState<Sale | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
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
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-4">
          <p className="text-sm text-slate-500">{filteredSales.length} vente(s)</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un n°, un client..."
                className="w-56 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <DateRangePicker
              from={from}
              to={to}
              onApply={(f, t) =>
                router.push(`${basePath}${basePath.includes("?") ? "&" : "?"}from=${f}&to=${t}`)
              }
            />
          </div>
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
                {detail.items.map((it) => {
                  const isPack = it.product?.packUnit && it.product.piecesPerPack > 0 && it.quantity % it.product.piecesPerPack === 0;
                  const unitPrice = isPack ? it.unitPrice * it.product!.piecesPerPack : it.unitPrice;
                  return (
                    <tr key={it.id} className="border-b border-slate-50">
                      <td className="py-1.5">{it.product?.name ?? it.service?.name ?? "—"}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{packAwareQtyLabel(it.quantity, it.product)}</td>
                      <td className="py-1.5 text-right">{formatMoney(unitPrice)}</td>
                      <td className="py-1.5 text-right font-medium">{formatMoney(it.subtotal)}</td>
                    </tr>
                  );
                })}
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
            {detail.fneStatus === "CERTIFIED" && (
              <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                FNE certifiée — réf. {detail.fneReference}
              </p>
            )}
            {detail.fneStatus === "FAILED" && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Échec de la certification FNE — {detail.fneError}
              </p>
            )}
            {detail.status !== "EN_ATTENTE" && (
              <button
                onClick={() => {
                  setReceipt(buildReceiptData(detail, companyName));
                  setDetail(null);
                }}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimer le reçu
              </button>
            )}
          </div>
        )}
      </Modal>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <ReceiptDocument data={receipt} />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div id="receipt-print" className="hidden">
          <ReceiptDocument data={receipt} />
        </div>
      )}
    </div>
  );
}

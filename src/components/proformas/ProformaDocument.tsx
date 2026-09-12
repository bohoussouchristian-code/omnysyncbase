import { FileText } from "lucide-react";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";

type ProformaItemData = {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string; unit: { symbol: string } | null } | null;
  service: { name: string } | null;
};

export type ProformaDocumentData = {
  number: string;
  companyName: string;
  clientName: string;
  clientPhone: string | null;
  createdAt: Date;
  validUntil: Date | null;
  totalAmount: number;
  items: ProformaItemData[];
};

// Document non contractuel : mêmes principes visuels que le reçu de vente
// (ReceiptDocument), sans section paiement puisqu'un devis n'encaisse rien.
export function ProformaDocument({ data }: { data: ProformaDocumentData }) {
  return (
    <div className="bg-white text-slate-900">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-slate-300">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <FileText size={20} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{data.companyName}</p>
            <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Devis — document non contractuel</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">N° de devis</p>
          <p className="font-semibold">{data.number}</p>
          <p className="text-xs text-slate-400 mt-1">Émis le {formatDateTime(data.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-b border-dashed border-slate-300 text-sm">
        <div>
          <p className="text-xs text-slate-400">Client</p>
          <p className="font-medium">{data.clientName}</p>
          {data.clientPhone && <p className="text-xs text-slate-500">{data.clientPhone}</p>}
        </div>
        {data.validUntil && (
          <div>
            <p className="text-xs text-slate-400">Valable jusqu&apos;au</p>
            <p className="font-medium">{formatDate(data.validUntil)}</p>
          </div>
        )}
      </div>

      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase tracking-wide">
            <th className="pb-2 font-medium">Désignation</th>
            <th className="pb-2 font-medium text-right">Qté</th>
            <th className="pb-2 font-medium text-right">Prix unitaire</th>
            <th className="pb-2 font-medium text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it) => (
            <tr key={it.id} className="border-t border-slate-100">
              <td className="py-2">{it.product?.name ?? it.service?.name ?? "—"}</td>
              <td className="py-2 text-right">
                {it.quantity} {it.product?.unit?.symbol || ""}
              </td>
              <td className="py-2 text-right">{formatMoney(it.unitPrice)}</td>
              <td className="py-2 text-right font-medium">{formatMoney(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-base">Montant total</span>
        <span className="font-bold text-lg">{formatMoney(data.totalAmount)}</span>
      </div>

      <p className="text-xs text-slate-400 mt-4 text-center">
        Ce devis n&apos;est pas une facture et ne vaut pas encaissement.
      </p>
    </div>
  );
}

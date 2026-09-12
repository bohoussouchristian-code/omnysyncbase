import { ClipboardList } from "lucide-react";
import { formatMoney, formatDateTime } from "@/lib/utils";

type Item = { id: string; quantity: number; unitPrice: number; product: { name: string } };

export type PurchaseOrderDocumentData = {
  number: string;
  companyName: string;
  supplierName: string;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  items: Item[];
  status: string;
};

function statusLabel(status: string) {
  if (status === "RECUE") return "Reçue";
  if (status === "ANNULEE") return "Annulée";
  return "En attente de livraison";
}

// Même langage visuel que ReceiptDocument/ProformaDocument (en-tête avec
// l'entreprise, corps avec le reste) pour que tous les documents imprimables
// de l'application soient cohérents.
export function PurchaseOrderDocument({ data }: { data: PurchaseOrderDocumentData }) {
  return (
    <div className="bg-white text-slate-900">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-slate-300">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{data.companyName}</p>
            <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Bon de commande</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">N° de commande</p>
          <p className="font-semibold">{data.number}</p>
          <p className="text-xs text-slate-400 mt-1">Émis le {formatDateTime(data.date)}</p>
        </div>
      </div>

      <div className="py-4 border-b border-dashed border-slate-300 text-sm">
        <p className="text-xs text-slate-400">Fournisseur</p>
        <p className="font-medium">{data.supplierName}</p>
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
              <td className="py-2">{it.product.name}</td>
              <td className="py-2 text-right">{it.quantity}</td>
              <td className="py-2 text-right">{formatMoney(it.unitPrice)}</td>
              <td className="py-2 text-right font-medium">{formatMoney(it.quantity * it.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-base">Montant total</span>
          <span className="font-bold text-lg">{formatMoney(data.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Montant à payer</span>
          <span>{formatMoney(data.paidAmount)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4 text-center">{statusLabel(data.status)}</p>
    </div>
  );
}

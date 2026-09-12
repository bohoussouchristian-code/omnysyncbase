import { Receipt as ReceiptIcon, MapPin } from "lucide-react";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/constants";
import type { PaymentMethod } from "@prisma/client";

type ReceiptItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string } | null;
  service: { name: string } | null;
};

export type ReceiptData = {
  number: string;
  companyName: string;
  warehouse: string;
  warehouseAddress: string | null;
  customer: string;
  items: ReceiptItem[];
  total: number;
  paid: number;
  received: number;
  changeGiven: number;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  pointsEarned: number;
  issuedAt: Date;
};

function StatusPill({ paid, total }: { paid: number; total: number }) {
  if (paid >= total) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
        Payée
      </span>
    );
  }
  if (paid > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-semibold">
        Partielle
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold">
      Crédit
    </span>
  );
}

// Document de reçu : utilisé à la fois pour l'aperçu à l'écran (dans la
// modale de confirmation) et pour l'impression (#receipt-print), pour que ce
// que le caissier voit corresponde exactement à ce qui sort de l'imprimante.
export function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <div className="bg-white text-slate-900">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-slate-300">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ReceiptIcon size={20} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{data.companyName}</p>
            <p className="text-sm text-slate-500">{data.warehouse}</p>
            {data.warehouseAddress && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> {data.warehouseAddress}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">N° de vente</p>
          <p className="font-semibold">{data.number}</p>
          <p className="text-xs text-slate-400 mt-1">Émise le {formatDateTime(data.issuedAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-b border-dashed border-slate-300 text-sm">
        <div>
          <p className="text-xs text-slate-400">Client</p>
          <p className="font-medium">{data.customer}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Mode de paiement</p>
          <p className="font-medium">{PAYMENT_LABELS[data.paymentMethod]}</p>
        </div>
        {data.dueDate && (
          <div>
            <p className="text-xs text-slate-400">Échéance de paiement</p>
            <p className="font-medium">{formatDate(data.dueDate)}</p>
          </div>
        )}
        {data.pointsEarned > 0 && (
          <div>
            <p className="text-xs text-slate-400">Points fidélité gagnés</p>
            <p className="font-medium">+{data.pointsEarned}</p>
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
              <td className="py-2 text-right">{it.quantity}</td>
              <td className="py-2 text-right">{formatMoney(it.unitPrice)}</td>
              <td className="py-2 text-right font-medium">{formatMoney(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 pt-3 border-t border-dashed border-slate-300 space-y-1.5 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>Montant total</span>
          <span>{formatMoney(data.total)}</span>
        </div>
        {data.changeGiven > 0 && (
          <>
            <div className="flex justify-between text-slate-500">
              <span>Reçu ({PAYMENT_LABELS[data.paymentMethod]})</span>
              <span>{formatMoney(data.received)}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Monnaie rendue</span>
              <span>{formatMoney(data.changeGiven)}</span>
            </div>
          </>
        )}
        {data.paid < data.total && (
          <div className="flex justify-between font-semibold text-amber-600">
            <span>Reste à payer</span>
            <span>{formatMoney(data.total - data.paid)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="font-semibold text-base">Montant payé</span>
          <span className="font-bold text-lg">{formatMoney(data.paid)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-3">
        <p className="text-xs text-slate-400">Merci de votre achat !</p>
        <StatusPill paid={data.paid} total={data.total} />
      </div>
    </div>
  );
}

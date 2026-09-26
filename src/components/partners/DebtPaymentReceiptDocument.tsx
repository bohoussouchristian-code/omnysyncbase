import { Wallet } from "lucide-react";
import { formatMoney, formatDateTime, amountInWordsFcfa } from "@/lib/utils";

export type DebtPaymentReceiptData = {
  companyName: string;
  customerName: string;
  customerCode: string | null;
  amount: number;
  appliedSales: { number: string; applied: number; newStatus: "PAYEE" | "PARTIELLE" }[];
  leftover: number;
  newBalance: number;
  cashierName: string;
  issuedAt: Date;
};

// Reçu d'un paiement de dette (échelonné ou en une fois) : distinct du reçu
// de vente (ReceiptDocument), car un règlement de crédit n'a pas de ligne
// d'articles — juste un montant imputé sur une ou plusieurs factures
// antérieures, plus le nouveau solde restant dû.
export function DebtPaymentReceiptDocument({ data }: { data: DebtPaymentReceiptData }) {
  return (
    <div className="bg-white text-slate-900">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-slate-300">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Wallet size={20} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{data.companyName}</p>
            <p className="text-sm text-slate-500">Reçu de paiement de dette</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">Émis le</p>
          <p className="font-semibold">{formatDateTime(data.issuedAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-b border-dashed border-slate-300 text-sm">
        <div>
          <p className="text-xs text-slate-400">Client</p>
          <p className="font-medium">{data.customerName}</p>
          {data.customerCode && <p className="text-xs text-slate-400">{data.customerCode}</p>}
        </div>
        <div>
          <p className="text-xs text-slate-400">Encaissé par</p>
          <p className="font-medium">{data.cashierName}</p>
        </div>
      </div>

      {data.appliedSales.length > 0 && (
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-left text-slate-400 text-xs uppercase tracking-wide">
              <th className="pb-2 font-medium">Facture réglée</th>
              <th className="pb-2 font-medium text-right">Montant imputé</th>
              <th className="pb-2 font-medium text-right">Nouveau statut</th>
            </tr>
          </thead>
          <tbody>
            {data.appliedSales.map((s) => (
              <tr key={s.number} className="border-t border-slate-100">
                <td className="py-2">{s.number}</td>
                <td className="py-2 text-right font-medium">{formatMoney(s.applied)}</td>
                <td className="py-2 text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.newStatus === "PAYEE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.newStatus === "PAYEE" ? "Payée" : "Partielle"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 pt-3 border-t border-dashed border-slate-300 space-y-1.5 text-sm">
        {data.leftover > 0 && (
          <div className="flex justify-between text-slate-500">
            <span>Excédent conservé en avance</span>
            <span>{formatMoney(data.leftover)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="font-semibold text-base">Montant encaissé</span>
          <span className="font-bold text-lg">{formatMoney(data.amount)}</span>
        </div>
        <p className="text-xs text-slate-400 italic pt-1">
          Arrêté le présent reçu à la somme de : {amountInWordsFcfa(data.amount)}.
        </p>
        <div className="flex justify-between pt-2">
          <span className="text-slate-500">Nouveau solde débiteur</span>
          <span className={`font-semibold ${data.newBalance > 0 ? "text-red-600" : "text-emerald-700"}`}>
            {formatMoney(data.newBalance)}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4 pt-3">Merci de votre règlement !</p>
    </div>
  );
}

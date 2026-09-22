import { FileText, MapPin } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";

export type PayslipData = {
  number: string;
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  employeeName: string;
  matricule: string | null;
  position: string | null;
  category: string | null;
  maritalStatus: string | null;
  dependents: number;
  paymentMethod: string | null;
  period: string;
  baseSalary: number;
  allowances: number;
  familyAllowance: number;
  grossTotal: number;
  socialContribution: number;
  incomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  paidAt: Date | null;
  issuedAt: Date;
};

// Bulletin de salaire imprimable, même langage visuel que ReceiptDocument /
// PurchaseOrderDocument (en-tête entreprise + corps du document).
export function PayslipDocument({ data }: { data: PayslipData }) {
  return (
    <div className="bg-white text-slate-900">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-slate-300">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <FileText size={20} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{data.companyName}</p>
            <p className="text-sm text-slate-500">Bulletin de salaire</p>
            {data.companyAddress && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> {data.companyAddress}
              </p>
            )}
            {data.companyPhone && <p className="text-xs text-slate-400 mt-0.5">{data.companyPhone}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">Période de paie</p>
          <p className="font-semibold">{data.period}</p>
          <p className="text-xs text-slate-400 mt-1">Émis le {formatDate(data.issuedAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-b border-dashed border-slate-300 text-sm">
        <div>
          <p className="text-xs text-slate-400">Nom et prénoms</p>
          <p className="font-medium">{data.employeeName}</p>
        </div>
        {data.matricule && (
          <div>
            <p className="text-xs text-slate-400">Matricule</p>
            <p className="font-medium">{data.matricule}</p>
          </div>
        )}
        {data.position && (
          <div>
            <p className="text-xs text-slate-400">Poste / Fonction</p>
            <p className="font-medium">{data.position}</p>
          </div>
        )}
        {data.category && (
          <div>
            <p className="text-xs text-slate-400">Catégorie</p>
            <p className="font-medium">{data.category}</p>
          </div>
        )}
        {data.maritalStatus && (
          <div>
            <p className="text-xs text-slate-400">Situation matrimoniale</p>
            <p className="font-medium">{data.maritalStatus}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-400">Enfants à charge</p>
          <p className="font-medium">{data.dependents}</p>
        </div>
        {data.paymentMethod && (
          <div>
            <p className="text-xs text-slate-400">Mode de paiement</p>
            <p className="font-medium">{data.paymentMethod}</p>
          </div>
        )}
      </div>

      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase tracking-wide">
            <th className="pb-2 font-medium">Éléments de rémunération</th>
            <th className="pb-2 font-medium text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-100">
            <td className="py-2">Salaire de base</td>
            <td className="py-2 text-right">{formatMoney(data.baseSalary)}</td>
          </tr>
          {data.allowances > 0 && (
            <tr className="border-t border-slate-100">
              <td className="py-2">Primes et indemnités</td>
              <td className="py-2 text-right">{formatMoney(data.allowances)}</td>
            </tr>
          )}
          {data.familyAllowance > 0 && (
            <tr className="border-t border-slate-100">
              <td className="py-2">Allocations familiales</td>
              <td className="py-2 text-right">{formatMoney(data.familyAllowance)}</td>
            </tr>
          )}
          <tr className="border-t border-slate-200 font-semibold">
            <td className="py-2">Total des gains</td>
            <td className="py-2 text-right">{formatMoney(data.grossTotal)}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase tracking-wide">
            <th className="pb-2 font-medium">Retenues et prélèvements</th>
            <th className="pb-2 font-medium text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {data.socialContribution > 0 && (
            <tr className="border-t border-slate-100">
              <td className="py-2">Cotisation CNPS</td>
              <td className="py-2 text-right">{formatMoney(data.socialContribution)}</td>
            </tr>
          )}
          {data.incomeTax > 0 && (
            <tr className="border-t border-slate-100">
              <td className="py-2">Impôt sur traitement et salaires (ITS)</td>
              <td className="py-2 text-right">{formatMoney(data.incomeTax)}</td>
            </tr>
          )}
          {data.otherDeductions > 0 && (
            <tr className="border-t border-slate-100">
              <td className="py-2">Avances / autres retenues</td>
              <td className="py-2 text-right">{formatMoney(data.otherDeductions)}</td>
            </tr>
          )}
          <tr className="border-t border-slate-200 font-semibold">
            <td className="py-2">Total des retenues</td>
            <td className="py-2 text-right">{formatMoney(data.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 pt-3 border-t border-dashed border-slate-300 space-y-1.5 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>Total des gains</span>
          <span>{formatMoney(data.grossTotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Total des retenues</span>
          <span>{formatMoney(data.totalDeductions)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="font-semibold text-base">Net à payer</span>
          <span className="font-bold text-lg">{formatMoney(data.netPay)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-3">
        <p className="text-xs text-slate-400">
          {data.paidAt ? `Payé le ${formatDate(data.paidAt)}` : "Non encore payé"}
        </p>
        <p className="text-xs text-slate-400">Signature autorisée : ....................................</p>
      </div>
    </div>
  );
}

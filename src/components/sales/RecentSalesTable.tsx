import { Card } from "@/components/ui";
import { SaleStatusBadge } from "@/components/sales/SaleStatusBadge";
import { formatMoney } from "@/lib/utils";

type Sale = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  status: string;
  customer: { name: string } | null;
  warehouse: { name: string };
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDay = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatHour = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export function RecentSalesTable({ sales }: { sales: Sale[] }) {
  return (
    <Card className="overflow-hidden mt-6">
      <div className="p-5 pb-3">
        <h2 className="font-semibold text-slate-900">Ventes récentes</h2>
        <p className="text-xs text-slate-400 mt-0.5">Saisies au cours des 2 derniers jours, tous statuts confondus</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Heure</th>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Boutique</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDay(s.date)}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatHour(s.date)}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{s.number}</td>
                <td className="px-4 py-3 text-slate-600">{s.customer?.name || "Client comptant"}</td>
                <td className="px-4 py-3 text-slate-600">{s.warehouse.name}</td>
                <td className="px-4 py-3">
                  <SaleStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(s.totalAmount)}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Aucune vente enregistrée ces 2 derniers jours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

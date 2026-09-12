"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, PageHeader, StatCard } from "@/components/ui";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { formatMoney, formatDateTime, formatDate, toCSV } from "@/lib/utils";
import { Search } from "lucide-react";

type Session = {
  id: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  changeGivenTotal: number;
  openedAt: Date;
  closedAt: Date | null;
  warehouse: { name: string };
  user: { name: string };
};
type Stats = {
  totalCollected: number;
  openPointsCount: number;
  openPointsTotal: number;
  changeGivenTotal: number;
  cancelledSalesCount: number;
  cancelledSalesTotal: number;
};

// Vue d'administration : toutes les clôtures de caisse de tous les agents,
// sur une période, avec les indicateurs financiers associés. Contrairement à
// "État de mes caisses" (personnel), il n'y a ici aucune action
// d'ouverture/fermeture — uniquement de la consultation et de l'export.
export function CaissesDepotsClient({
  sessions,
  from,
  to,
  stats,
}: {
  sessions: Session[];
  from: string;
  to: string;
  stats: Stats;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.user.name.toLowerCase().includes(q) || s.warehouse.name.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const csv = useMemo(
    () =>
      toCSV(
        ["N°", "Statut", "Caissier(ère)", "Boutique", "Ouverture", "Clôture", "Montant compté", "Monnaie gardée", "Écart"],
        filtered.map((s, i) => {
          const ecart = s.closingAmount != null && s.expectedAmount != null ? s.closingAmount - s.expectedAmount : "";
          return [
            i + 1,
            s.closedAt ? "Fermée" : "Ouverte",
            s.user.name,
            s.warehouse.name,
            formatDateTime(s.openedAt),
            s.closedAt ? formatDateTime(s.closedAt) : "",
            s.closingAmount ?? "",
            s.changeGivenTotal,
            ecart,
          ];
        })
      ),
    [filtered]
  );

  return (
    <div>
      <PageHeader
        title="Gestion des caisses et dépôts"
        subtitle={`Activité du ${formatDate(from)} au ${formatDate(to)}`}
        action={
          <DateRangePicker
            from={from}
            to={to}
            onApply={(f, t) => router.push(`/gestion-caisses-depots?from=${f}&to=${t}`)}
          />
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Montant total encaissé" value={formatMoney(stats.totalCollected)} />
        <StatCard
          label={`Point de caisse ouverte [ ${stats.openPointsCount} ]`}
          value={formatMoney(stats.openPointsTotal)}
        />
        <StatCard
          label={`Ventes annulées [ ${stats.cancelledSalesCount} ]`}
          value={formatMoney(stats.cancelledSalesTotal)}
          tone="danger"
        />
        <StatCard label="Solde monnaie" value={formatMoney(stats.changeGivenTotal)} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-slate-900">
            Liste des clôtures de caisse <span className="text-slate-400 font-normal">[ {filtered.length} ]</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un caissier, une boutique..."
                className="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <ExportCsvButton filename={`caisses-depots-${from}_${to}.csv`} csv={csv} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">N°</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Caissier(ère)</th>
                <th className="px-3 py-2 font-medium">Boutique</th>
                <th className="px-3 py-2 font-medium">Ouverture</th>
                <th className="px-3 py-2 font-medium">Clôture</th>
                <th className="px-3 py-2 font-medium text-right">Montant compté</th>
                <th className="px-3 py-2 font-medium text-right">Monnaie gardée</th>
                <th className="px-3 py-2 font-medium text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const ecart =
                  s.closingAmount != null && s.expectedAmount != null ? s.closingAmount - s.expectedAmount : null;
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Badge tone={s.closedAt ? "default" : "success"}>{s.closedAt ? "Clôturée" : "Ouverte"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{s.user.name}</td>
                    <td className="px-3 py-2 text-slate-600">{s.warehouse.name}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {s.closedAt ? formatDateTime(s.closedAt) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.closingAmount != null ? formatMoney(s.closingAmount) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.changeGivenTotal > 0 ? formatMoney(s.changeGivenTotal) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {ecart == null ? (
                        "—"
                      ) : (
                        <span className={ecart === 0 ? "text-emerald-600" : "text-red-600 font-medium"}>
                          {ecart === 0 ? "0 FCFA" : formatMoney(Math.abs(ecart))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                    {sessions.length === 0 ? "Aucune session sur cette période." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { DateRangePicker } from "@/components/DateRangePicker";

const PRESETS = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "lastMonth", label: "Mois précédent" },
  { key: "year", label: "Année" },
] as const;

// Sélecteur de période du tableau de bord : boutons rapides + calendrier
// personnalisé (DateRangePicker, déjà utilisé dans Caisse/Rapports). Navigue
// simplement vers /dashboard?preset=X ou ?from=&to=, la page recalcule tout
// côté serveur — pas d'état client à synchroniser.
export function DashboardPeriodPicker({
  preset,
  from,
  to,
}: {
  preset: string;
  from: string;
  to: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => router.push(`/dashboard?preset=${p.key}`)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            preset === p.key
              ? "bg-blue-600 text-white"
              : "border border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p.label}
        </button>
      ))}
      <DateRangePicker
        from={from}
        to={to}
        onApply={(f, t) => router.push(`/dashboard?preset=custom&from=${f}&to=${t}`)}
      />
    </div>
  );
}

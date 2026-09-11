"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils";

// Sélecteur de période réutilisable : ouvre un calendrier (dates de début/fin)
// et n'applique la sélection qu'au clic sur "Valider", pour ne pas relancer
// une recherche à chaque frappe. Utilisé dans Caisse et Rapports.
export function DateRangePicker({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  function toggle() {
    if (!open) {
      setDraftFrom(from);
      setDraftTo(to);
    }
    setOpen((v) => !v);
  }

  function apply() {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      onApply(draftTo, draftFrom);
    } else {
      onApply(draftFrom, draftTo);
    }
    setOpen(false);
  }

  const label = from && to ? `${formatDate(from)} — ${formatDate(to)}` : "Choisir une période";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <CalendarDays size={16} />
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Du</label>
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Au</label>
                <input
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!draftFrom || !draftTo}
                className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Valider
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { Printer } from "lucide-react";

// Imprime la page telle quelle : la sidebar, le menu compte et tout élément
// marqué "no-print" sont masqués à l'impression (voir globals.css), le reste
// du contenu (le rapport) s'imprime normalement.
export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      type="button"
      className="no-print flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
    >
      <Printer size={16} /> {label}
    </button>
  );
}

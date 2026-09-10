"use client";

import { Download } from "lucide-react";

export function ExportCsvButton({ filename, csv, label = "Exporter CSV" }: { filename: string; csv: string; label?: string }) {
  function handleClick() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
    >
      <Download size={16} /> {label}
    </button>
  );
}

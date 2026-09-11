"use client";

import { useState, type MouseEvent } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard indisponible (permissions navigateur) : on ignore silencieusement.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Copier le numéro"
      className={
        className ??
        "text-slate-400 hover:text-blue-600"
      }
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

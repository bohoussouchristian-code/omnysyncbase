"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/lib/actions/search";
import { Search, X } from "lucide-react";

// Recherche globale : icône dans l'en-tête, ouvre un panneau plein écran
// avec un champ auto-focus et les résultats groupés par catégorie au fil de
// la frappe (débounce 300ms) — accessible depuis n'importe quelle page.
export function GlobalSearch({ theme = "light" }: { theme?: "light" | "dark" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function runSearch(q: string) {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    globalSearch(q).then((res) => {
      setResults(res);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  function goTo(href: string) {
    close();
    router.push(href);
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${
          theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
        }`}
        title="Recherche globale"
      >
        <Search size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 max-h-[70vh] flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                }}
                placeholder="Rechercher un client, fournisseur, produit, vente, achat, livraison..."
                className="flex-1 text-sm outline-none"
              />
              <button onClick={close} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {query.trim().length < 2 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Tapez au moins 2 caractères pour chercher.
                </p>
              )}
              {query.trim().length >= 2 && loading && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Recherche...</p>
              )}
              {query.trim().length >= 2 && !loading && results.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun résultat.</p>
              )}
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="py-1.5">
                  <p className="px-4 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    {category}
                  </p>
                  {items.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => goTo(r.href)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50 text-left"
                    >
                      <span className="font-medium text-slate-800">{r.label}</span>
                      {r.sublabel && <span className="text-slate-400 text-xs truncate ml-2">{r.sublabel}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

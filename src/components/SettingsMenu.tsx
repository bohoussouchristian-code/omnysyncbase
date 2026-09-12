"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersVertical, Building2, UserCog } from "lucide-react";

const SETTINGS_ITEMS = [
  { href: "/entrepots", label: "Dépôts / Boutiques", icon: Building2 },
  { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
];

export function SettingsMenu({
  theme = "light",
  dropDirection = "down",
}: {
  theme?: "light" | "dark";
  dropDirection?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Administration"
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          theme === "dark" ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <SlidersVertical size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute right-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 ${
              dropDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            <p className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Administration</p>
            {SETTINGS_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

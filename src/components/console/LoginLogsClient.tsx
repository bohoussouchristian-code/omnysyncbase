"use client";

import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { Search } from "lucide-react";

type LoginLog = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: { name: string; email: string; role: Role };
  company: { name: string } | null;
};

// Extrait un libellé lisible (navigateur + appareil) d'un user-agent brut,
// pour ne pas afficher la chaîne technique complète à l'écran.
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "—";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navigateur";
  const device = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Macintosh/.test(userAgent)
          ? "Mac"
          : /Windows/.test(userAgent)
            ? "Windows"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "";
  return device ? `${browser} · ${device}` : browser;
}

// Réservé au propriétaire de la plateforme (voir console/layout.tsx) : liste
// toutes les connexions, toutes entreprises confondues — un administrateur
// d'une entreprise cliente n'a lui-même accès qu'à ses propres utilisateurs.
export function LoginLogsClient({ logs }: { logs: LoginLog[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.user.name.toLowerCase().includes(q) ||
        l.user.email.toLowerCase().includes(q) ||
        (l.company?.name.toLowerCase().includes(q) ?? false)
    );
  }, [logs, query]);

  return (
    <div>
      <PageHeader
        title="Historique des connexions"
        action={
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un utilisateur, une entreprise..."
              className="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Entreprise</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Date &amp; heure</th>
                <th className="px-4 py-3 font-medium">Adresse IP</th>
                <th className="px-4 py-3 font-medium">Appareil</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">{l.user.name}</div>
                    <div className="text-xs text-slate-400">{l.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.company?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[l.user.role]}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{l.ipAddress || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{describeDevice(l.userAgent)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {logs.length === 0 ? "Aucune connexion enregistrée." : "Aucun résultat."}
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

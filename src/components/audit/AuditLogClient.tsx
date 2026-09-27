"use client";

import { useMemo, useState } from "react";
import { Card, Modal, PageHeader, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Search, Eye } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: Date;
  user: { name: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  "sale.cancel": "Annulation de vente",
  "expense.cancel": "Annulation de dépense",
  "delivery.cancel": "Annulation de livraison",
  "user.role_change": "Changement de rôle",
  "user.toggle_active": "Activation/désactivation utilisateur",
  "user.reset_password": "Réinitialisation de mot de passe",
  "user.permission_change": "Modification d'une permission",
  "company.update": "Modification entreprise / FNE",
  "general_balance.base_change": "Modification de la base du solde général",
};

function actionTone(action: string): "default" | "danger" | "warning" {
  if (action.endsWith(".cancel")) return "danger";
  if (action.startsWith("user.")) return "warning";
  return "default";
}

function formatJson(raw: string | null): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// Centre d'audit : chaque opération sensible (annulation, changement de
// rôle, désactivation d'utilisateur, réinitialisation de mot de passe,
// modification des paramètres entreprise/FNE) laisse une trace ici — qui,
// quoi, quand, ancienne et nouvelle valeur — voir logAudit dans
// src/lib/audit.ts. Ne couvre pas encore chaque mutation de l'application,
// seulement les opérations désignées comme sensibles.
export function AuditLogClient({ logs }: { logs: AuditLog[] }) {
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<AuditLog | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        (ACTION_LABELS[l.action] || l.action).toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        (l.user?.name.toLowerCase().includes(q) ?? false) ||
        (l.reason?.toLowerCase().includes(q) ?? false)
    );
  }, [logs, query]);

  return (
    <div>
      <PageHeader
        title="Sécurité & audit"
        subtitle="Journal des opérations sensibles : qui, quoi, quand, ancienne et nouvelle valeur."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h2 className="font-semibold text-slate-900">
            Journal <span className="text-slate-400 font-normal">[ {filtered.length} ]</span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une action, un utilisateur, un motif..."
              className="w-72 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entité</th>
                <th className="px-4 py-3 font-medium">Motif</th>
                <th className="px-4 py-3 font-medium text-center">Détail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{l.user?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={actionTone(l.action)}>{ACTION_LABELS[l.action] || l.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.entityType}
                    {l.entityId && <span className="text-slate-400 font-mono text-xs"> #{l.entityId.slice(-8)}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={l.reason || ""}>
                    {l.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setViewing(l)}
                      className="text-slate-400 hover:text-blue-600"
                      title="Voir le détail"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {logs.length === 0 ? "Aucune opération sensible enregistrée." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? ACTION_LABELS[viewing.action] || viewing.action : ""}
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="font-medium">{formatDateTime(viewing.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Utilisateur</p>
                <p className="font-medium">{viewing.user?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Entité</p>
                <p className="font-medium">
                  {viewing.entityType}
                  {viewing.entityId && ` #${viewing.entityId.slice(-8)}`}
                </p>
              </div>
              {viewing.reason && (
                <div>
                  <p className="text-xs text-slate-400">Motif</p>
                  <p className="font-medium">{viewing.reason}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Avant</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs overflow-x-auto">
                  {formatJson(viewing.oldValue)}
                </pre>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Après</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs overflow-x-auto">
                  {formatJson(viewing.newValue)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

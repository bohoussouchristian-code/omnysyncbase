"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stockPurchase } from "@/lib/actions/purchases";
import { Modal, PageHeader, Card, Badge, Input, Label } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Boxes, Eye, Search, AlertTriangle } from "lucide-react";

type PurchaseItemRow = {
  id: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number | null;
  brokenQuantity: number;
  product: {
    name: string;
    unit: { symbol: string } | null;
    packUnit: { symbol: string } | null;
    piecesPerPack: number;
  };
};

// On ne reçoit et ne déclare jamais la casse à la bouteille : quand la
// quantité commandée est un multiple entier du lot (casier) configuré, la
// saisie/affichage se fait uniquement en casiers — la conversion vers la
// quantité de base (bouteilles), nécessaire au stock, reste interne.
function packInfo(it: PurchaseItemRow) {
  const piecesPerPack = it.product.piecesPerPack;
  if (it.product.packUnit && piecesPerPack > 0 && it.quantity % piecesPerPack === 0) {
    return { usePacks: true as const, factor: piecesPerPack, max: it.quantity / piecesPerPack, unitLabel: it.product.packUnit.symbol };
  }
  return { usePacks: false as const, factor: 1, max: it.quantity, unitLabel: it.product.unit?.symbol || "" };
}

type Purchase = {
  id: string;
  number: string;
  date: Date;
  status: string;
  totalAmount: number;
  receivedAt: Date | null;
  stockedAt: Date | null;
  supplier: { name: string };
  warehouse: { name: string };
  stockedBy: { name: string } | null;
  items: PurchaseItemRow[];
};

// Étape distincte du bon de livraison : la marchandise a été réceptionnée,
// mais n'entre en stock qu'ici, une fois effectivement rangée/comptée — et
// seulement pour la quantité confirmée intacte (voir CasseForm plus bas).
export function ApprovisionnementClient({ purchases }: { purchases: Purchase[] }) {
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const q = query.trim().toLowerCase();

  const rows = useMemo(
    () =>
      purchases
        .filter((p) => !q || p.number.toLowerCase().includes(q) || p.supplier.name.toLowerCase().includes(q))
        .sort((a, b) => (b.receivedAt ?? b.date).getTime() - (a.receivedAt ?? a.date).getTime()),
    [purchases, q]
  );

  return (
    <div>
      <PageHeader title="Approvisionnement" />

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un n° de commande..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="p-5">
        <p className="text-xs text-slate-400 mb-3">
          Une commande déjà réceptionnée (bon de livraison) n&apos;entre en stock qu&apos;une fois approvisionnée
          ici, article par article — seule la quantité confirmée intacte est créditée.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">N° commande</th>
                <th className="pb-2 font-medium">Fournisseur</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isPending = !p.stockedAt;
                const totalBroken = p.items.reduce((s, it) => s + it.brokenQuantity, 0);
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {p.number}
                        <CopyButton text={p.number} />
                      </div>
                    </td>
                    <td className="py-2 text-slate-600">{p.supplier.name}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={isPending ? "warning" : "success"}>
                          {isPending ? "En attente d'approvisionnement" : "Approvisionnée"}
                        </Badge>
                        {!isPending && totalBroken > 0 && (
                          <Badge tone="danger">
                            <span className="flex items-center gap-1">
                              <AlertTriangle size={11} /> {totalBroken} cassé(s)
                            </span>
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">
                      {formatDateTime(isPending ? p.receivedAt ?? p.date : p.stockedAt ?? p.date)}
                    </td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => setViewing(p)} className="text-slate-400 hover:text-blue-600">
                          {isPending ? <Boxes size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {q ? "Aucun résultat." : "Aucune commande reçue pour le moment."}
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
        title={`Commande ${viewing?.number || ""}`}
      >
        {viewing &&
          (viewing.stockedAt ? (
            <StockedSummary purchase={viewing} />
          ) : (
            <CasseForm purchase={viewing} onDone={() => { setViewing(null); router.refresh(); }} />
          ))}
      </Modal>
    </div>
  );
}

function StockedSummary({ purchase }: { purchase: Purchase }) {
  return (
    <div>
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="pb-2 font-medium">Produit</th>
            <th className="pb-2 font-medium text-right">Commandé</th>
            <th className="pb-2 font-medium text-right">Reçu intact</th>
            <th className="pb-2 font-medium text-right">Casse</th>
            <th className="pb-2 font-medium text-right">Manquant</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((it) => {
            const { factor, max, unitLabel } = packInfo(it);
            const received = (it.receivedQuantity ?? it.quantity) / factor;
            const broken = it.brokenQuantity / factor;
            const missing = max - received - broken;
            return (
              <tr key={it.id} className="border-b border-slate-50">
                <td className="py-1.5">{it.product.name}</td>
                <td className="py-1.5 text-right text-slate-500 whitespace-nowrap">
                  {max} {unitLabel}
                </td>
                <td className="py-1.5 text-right font-medium whitespace-nowrap">
                  {received} {unitLabel}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {broken > 0 ? <span className="text-red-600">{broken} {unitLabel}</span> : "—"}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {missing > 0 ? <span className="text-amber-600">{missing} {unitLabel}</span> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex justify-between font-semibold mb-4">
        <span>Total</span>
        <span>{formatMoney(purchase.totalAmount)}</span>
      </div>
      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        Approvisionnée le {formatDateTime(purchase.stockedAt!)}
        {purchase.stockedBy ? ` par ${purchase.stockedBy.name}` : ""} — {purchase.warehouse.name}
      </p>
    </div>
  );
}

function CasseForm({ purchase, onDone }: { purchase: Purchase; onDone: () => void }) {
  // Saisie exprimée dans l'unité d'affichage de chaque article (casiers quand
  // le lot est configuré et que la commande en est un multiple entier, sinon
  // l'unité de base) — voir packInfo. Convertie en unité de base uniquement
  // au moment de l'envoi, seule unité que le serveur connaisse.
  const [values, setValues] = useState<Record<string, { received: number; broken: number }>>(() =>
    Object.fromEntries(purchase.items.map((it) => [it.id, { received: packInfo(it).max, broken: 0 }]))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateReceived(itemId: string, received: number, max: number) {
    setValues((prev) => {
      const broken = Math.min(prev[itemId].broken, Math.max(0, max - received));
      return { ...prev, [itemId]: { received, broken } };
    });
  }

  function updateBroken(itemId: string, broken: number, max: number) {
    setValues((prev) => {
      const received = Math.min(prev[itemId].received, Math.max(0, max - broken));
      return { ...prev, [itemId]: { received, broken } };
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await stockPurchase(
        purchase.id,
        purchase.items.map((it) => {
          const { factor } = packInfo(it);
          return {
            itemId: it.id,
            receivedQuantity: values[it.id].received * factor,
            brokenQuantity: values[it.id].broken * factor,
          };
        })
      );
      if (res && "error" in res) {
        setError(res.error ?? "Erreur inconnue.");
        return;
      }
      onDone();
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <p className="text-xs text-slate-500 mb-3">
        Vérifiez la marchandise reçue : indiquez ce qui est intact (crédité au stock) et ce qui est cassé. Le reste
        est compté comme manquant.
      </p>
      <div className="space-y-4 mb-4">
        {purchase.items.map((it) => {
          const v = values[it.id];
          const { max, unitLabel } = packInfo(it);
          const missing = max - v.received - v.broken;
          return (
            <div key={it.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-800 text-sm">{it.product.name}</span>
                <span className="text-xs text-slate-400">
                  Commandé : {max} {unitLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Reçu intact ({unitLabel})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step="1"
                    value={v.received}
                    onChange={(e) => updateReceived(it.id, Math.max(0, Number(e.target.value)), max)}
                  />
                </div>
                <div>
                  <Label>Casse ({unitLabel})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step="1"
                    value={v.broken}
                    onChange={(e) => updateBroken(it.id, Math.max(0, Number(e.target.value)), max)}
                  />
                </div>
              </div>
              {missing > 0 && (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={12} /> {missing} {unitLabel} manquant(s) — ni reçu ni cassé
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between font-semibold mb-4">
        <span>Total commande</span>
        <span>{formatMoney(purchase.totalAmount)}</span>
      </div>
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Enregistrement..." : "Approvisionner — créditer le stock"}
      </button>
    </div>
  );
}

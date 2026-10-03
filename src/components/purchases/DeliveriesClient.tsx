"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receivePurchase, type ReceivePurchaseItemInput } from "@/lib/actions/purchases";
import { Modal, PageHeader, Card, Badge, Input, Label } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { PackageCheck, Eye, Search, AlertTriangle } from "lucide-react";

type PurchaseItemRow = {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    name: string;
    unit: { symbol: string } | null;
    packUnit: { symbol: string } | null;
    piecesPerPack: number;
  };
};

// On ne reçoit jamais à la bouteille : dès qu'un lot (casier) est configuré
// sur le produit, la saisie/affichage se fait en casiers — même quand la
// quantité commandée n'en est pas un multiple exact (reliquat en décimale) —
// même règle qu'à l'approvisionnement (voir ApprovisionnementClient.tsx).
function packInfo(it: PurchaseItemRow) {
  const piecesPerPack = it.product.piecesPerPack;
  if (it.product.packUnit && piecesPerPack > 0) {
    return { factor: piecesPerPack, max: Math.round((it.quantity / piecesPerPack) * 100) / 100, unitLabel: it.product.packUnit.symbol };
  }
  return { factor: 1, max: it.quantity, unitLabel: it.product.unit?.symbol || "" };
}

type Purchase = {
  id: string;
  number: string;
  deliveryNumber: string | null;
  date: Date;
  status: string;
  totalAmount: number;
  receivedAt: Date | null;
  supplier: { name: string };
  warehouse: { name: string };
  receivedBy: { name: string } | null;
  items: PurchaseItemRow[];
};

export function DeliveriesClient({ purchases }: { purchases: Purchase[] }) {
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const q = query.trim().toLowerCase();

  // Un seul ticket, en attente ou déjà reçu : pas deux tableaux séparés,
  // le statut de chaque ligne suffit à distinguer (comme pour la Caisse).
  const deliveries = useMemo(
    () =>
      purchases
        .filter((p) => !q || p.number.toLowerCase().includes(q) || p.supplier.name.toLowerCase().includes(q))
        .sort((a, b) => (b.receivedAt ?? b.date).getTime() - (a.receivedAt ?? a.date).getTime()),
    [purchases, q]
  );

  return (
    <div>
      <PageHeader title="Bons de livraison" />

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
          Constatez ici l&apos;arrivée d&apos;une commande, article par article (quantité livrée, casse visible, lot,
          série, péremption) — l&apos;entrée en stock se confirme ensuite depuis Approvisionnement.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium">N° commande (BC)</th>
                <th className="pb-2 font-medium">N° livraison (BL)</th>
                <th className="pb-2 font-medium">Fournisseur</th>
                <th className="pb-2 font-medium">Date de commande</th>
                <th className="pb-2 font-medium">Date de livraison</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((p) => {
                const isPending = p.status === "EN_ATTENTE";
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2">
                      <Badge tone={isPending ? "warning" : "success"}>
                        {isPending ? "En attente de réception" : "Reçue"}
                      </Badge>
                    </td>
                    <td className="py-2 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {p.number}
                        <CopyButton text={p.number} />
                      </div>
                    </td>
                    <td className="py-2 text-slate-600">
                      {p.deliveryNumber ? (
                        <div className="flex items-center gap-1.5">
                          {p.deliveryNumber}
                          <CopyButton text={p.deliveryNumber} />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-slate-600">{p.supplier.name}</td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(p.date)}</td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">
                      {p.receivedAt ? formatDateTime(p.receivedAt) : "—"}
                    </td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => setViewing(p)} className="text-slate-400 hover:text-blue-600">
                          <Eye size={16} />
                        </button>
                        {isPending && (
                          <button
                            onClick={() => setReceiving(p)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700"
                          >
                            <PackageCheck size={14} /> Réceptionner
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    {q ? "Aucun résultat." : "Aucune livraison enregistrée."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Commande ${viewing?.number || ""}`}>
        {viewing && (
          <div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium text-right">Qté</th>
                  <th className="pb-2 font-medium text-right">P.U.</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1.5">{it.product.name}</td>
                    <td className="py-1.5 text-right">{it.quantity}</td>
                    <td className="py-1.5 text-right">{formatMoney(it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-semibold mb-4">
              <span>Total</span>
              <span>{formatMoney(viewing.totalAmount)}</span>
            </div>
            {viewing.status === "EN_ATTENTE" && (
              <button
                onClick={() => {
                  setViewing(null);
                  setReceiving(viewing);
                }}
                className="w-full rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-medium hover:bg-emerald-700"
              >
                Réceptionner la marchandise
              </button>
            )}
            {viewing.status === "RECUE" && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Reçue le {viewing.receivedAt ? formatDateTime(viewing.receivedAt) : "—"}
                {viewing.receivedBy ? ` par ${viewing.receivedBy.name}` : ""} — {viewing.warehouse.name}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!receiving}
        onClose={() => setReceiving(null)}
        title={`Réceptionner — ${receiving?.number || ""}`}
      >
        {receiving && (
          <ReceiveForm purchase={receiving} onDone={() => { setReceiving(null); router.refresh(); }} />
        )}
      </Modal>
    </div>
  );
}

function ReceiveForm({ purchase, onDone }: { purchase: Purchase; onDone: () => void }) {
  const [values, setValues] = useState<
    Record<string, { delivered: number; broken: number; lotNumber: string; serialNumber: string; expiryDate: string }>
  >(() =>
    Object.fromEntries(
      purchase.items.map((it) => [
        it.id,
        { delivered: packInfo(it).max, broken: 0, lotNumber: "", serialNumber: "", expiryDate: "" },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(itemId: string, patch: Partial<(typeof values)[string]>) {
    setValues((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  function updateDelivered(itemId: string, delivered: number, max: number) {
    setValues((prev) => {
      const broken = Math.min(prev[itemId].broken, Math.max(0, max - delivered));
      return { ...prev, [itemId]: { ...prev[itemId], delivered, broken } };
    });
  }

  function updateBroken(itemId: string, broken: number, max: number) {
    setValues((prev) => {
      const delivered = Math.min(prev[itemId].delivered, Math.max(0, max - broken));
      return { ...prev, [itemId]: { ...prev[itemId], delivered, broken } };
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const itemInputs: ReceivePurchaseItemInput[] = purchase.items.map((it) => {
        const { factor } = packInfo(it);
        const v = values[it.id];
        return {
          itemId: it.id,
          deliveredQuantity: v.delivered * factor,
          deliveredBrokenQuantity: v.broken * factor,
          lotNumber: v.lotNumber || undefined,
          serialNumber: v.serialNumber || undefined,
          expiryDate: v.expiryDate || undefined,
        };
      });
      const res = await receivePurchase(purchase.id, itemInputs);
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
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      <p className="text-xs text-slate-500 mb-3">
        Ce que vous constatez à l&apos;arrivée — le comptage définitif qui crédite le stock se fait ensuite depuis
        Approvisionnement.
      </p>
      <div className="space-y-4 mb-4">
        {purchase.items.map((it) => {
          const v = values[it.id];
          const { max, unitLabel } = packInfo(it);
          const missing = max - v.delivered - v.broken;
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
                  <Label>Quantité livrée ({unitLabel})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step="0.01"
                    value={v.delivered}
                    onChange={(e) => updateDelivered(it.id, Math.max(0, Number(e.target.value)), max)}
                  />
                </div>
                <div>
                  <Label>Cassé ({unitLabel})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step="0.01"
                    value={v.broken}
                    onChange={(e) => updateBroken(it.id, Math.max(0, Number(e.target.value)), max)}
                  />
                </div>
                <div>
                  <Label>N° de lot (optionnel)</Label>
                  <Input
                    value={v.lotNumber}
                    onChange={(e) => update(it.id, { lotNumber: e.target.value })}
                    placeholder="Ex : L2026-0912"
                  />
                </div>
                <div>
                  <Label>N° de série (optionnel)</Label>
                  <Input value={v.serialNumber} onChange={(e) => update(it.id, { serialNumber: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Date de péremption (optionnel)</Label>
                  <Input
                    type="date"
                    value={v.expiryDate}
                    onChange={(e) => update(it.id, { expiryDate: e.target.value })}
                  />
                </div>
              </div>
              {missing > 0 && (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={12} /> {missing} {unitLabel} manquant(s) — ni livré ni cassé
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
        {pending ? "Enregistrement..." : "Confirmer la réception"}
      </button>
    </div>
  );
}

"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDelivery,
  markDeliveryDelivered,
  collectDeliveryPayment,
  cancelDelivery,
} from "@/lib/actions/deliveries";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/constants";
import { Plus, Search, Truck, CheckCircle2, Ban, CircleDollarSign } from "lucide-react";

type Customer = { id: string; name: string };
type Delivery = {
  id: string;
  number: string;
  destination: string;
  quantity: number | null;
  fee: number;
  paid: boolean;
  status: "EN_ATTENTE" | "LIVREE" | "ANNULEE";
  notes: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  customer: { name: string } | null;
  sale: { number: string } | null;
  user: { name: string } | null;
};

function StatusBadge({ status }: { status: Delivery["status"] }) {
  if (status === "LIVREE") return <Badge tone="success">Livrée</Badge>;
  if (status === "ANNULEE") return <Badge tone="danger">Annulée</Badge>;
  return <Badge tone="warning">En attente</Badge>;
}

// Module dédié aux livraisons clients — distinct des Bons de livraison
// (réception fournisseur). Le montant facturé pour chaque livraison est
// toujours décidé au cas par cas ici (zone, distance, quantité...), jamais
// calculé automatiquement par une formule.
export function DeliveriesClient({ deliveries, customers }: { deliveries: Delivery[]; customers: Customer[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [payingDelivery, setPayingDelivery] = useState<Delivery | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Delivery | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter(
      (d) =>
        d.number.toLowerCase().includes(q) ||
        d.destination.toLowerCase().includes(q) ||
        (d.customer?.name.toLowerCase().includes(q) ?? false)
    );
  }, [deliveries, query]);

  const totalDue = deliveries.filter((d) => d.status !== "ANNULEE" && !d.paid).reduce((s, d) => s + d.fee, 0);

  function deliver(id: string) {
    startTransition(async () => {
      await markDeliveryDelivered(id);
      router.refresh();
    });
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError("Le motif d'annulation est obligatoire.");
      return;
    }
    setCancelError(null);
    startTransition(async () => {
      const res = await cancelDelivery(cancelTarget.id, cancelReason);
      if (res && "error" in res && res.error) {
        setCancelError(res.error);
        return;
      }
      setCancelTarget(null);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Livraison client"
        subtitle="Frais de livraison décidés au cas par cas (zone, distance, quantité...)"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvelle livraison
          </button>
        }
      />

      {totalDue > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
          <CircleDollarSign size={15} /> {formatMoney(totalDue)} de frais de livraison non encore payés
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h2 className="font-semibold text-slate-900">
            Livraisons <span className="text-slate-400 font-normal">[ {filtered.length} ]</span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un n°, un client, une destination..."
              className="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium text-right">Quantité</th>
                <th className="px-4 py-3 font-medium text-right">Frais</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{d.number}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(d.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{d.customer?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.destination}</td>
                  <td className="px-4 py-3 text-right">{d.quantity ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(d.fee)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3">
                    {d.paid ? (
                      <Badge tone="success">Payée</Badge>
                    ) : (
                      <button
                        onClick={() => setPayingDelivery(d)}
                        disabled={d.status === "ANNULEE"}
                        className="disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Badge tone="default">Impayée</Badge>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      {d.status === "EN_ATTENTE" && (
                        <>
                          <button
                            onClick={() => deliver(d.id)}
                            title="Marquer livrée"
                            className="text-slate-400 hover:text-emerald-600"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => setCancelTarget(d)}
                            title="Annuler cette livraison"
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Ban size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    {deliveries.length === 0 ? "Aucune livraison enregistrée." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle livraison">
        <DeliveryForm customers={customers} onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal
        open={!!payingDelivery}
        onClose={() => setPayingDelivery(null)}
        title={`Encaisser la livraison ${payingDelivery?.number || ""}`}
      >
        {payingDelivery && (
          <DeliveryPaymentForm delivery={payingDelivery} onDone={() => setPayingDelivery(null)} />
        )}
      </Modal>

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title={`Annuler la livraison ${cancelTarget?.number || ""}`}>
        {cancelTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motif d&apos;annulation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Ex : client a annulé la commande..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {cancelError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {cancelError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
              <button
                onClick={confirmCancel}
                disabled={pending || cancelReason.trim() === ""}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DeliveryForm({ customers, onDone }: { customers: Customer[]; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createDelivery(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        <Truck size={14} className="shrink-0" />
        Le montant de la livraison est à votre appréciation (zone, distance, quantité...) — aucun calcul automatique.
      </div>
      <div>
        <Label>Client (optionnel)</Label>
        <Select name="customerId" defaultValue="">
          <option value="">— Client comptant —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Destination</Label>
        <Input name="destination" placeholder="Ex : Sous-secteur Anonkoua-Kouté, Abobo" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Quantité (casiers, optionnel)</Label>
          <Input type="number" name="quantity" min={1} step="1" placeholder="Ex : 300" />
        </div>
        <div>
          <Label>Frais de livraison</Label>
          <Input type="number" name="fee" min={1} step="1" required />
        </div>
      </div>
      <div>
        <Label>Note (optionnel)</Label>
        <Input name="notes" placeholder="Ex : longue distance, accès difficile..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

function DeliveryPaymentForm({ delivery, onDone }: { delivery: Delivery; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await collectDeliveryPayment(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="deliveryId" value={delivery.id} />
      <p className="text-sm text-slate-500">
        Frais à encaisser : <span className="font-semibold text-slate-800">{formatMoney(delivery.fee)}</span>
      </p>
      <div>
        <Label>Mode de paiement</Label>
        <Select name="method" defaultValue="ESPECES">
          {Object.entries(PAYMENT_LABELS)
            .filter(([k]) => k !== "CREDIT")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
      </div>
      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        Encaisser ce paiement exige d&apos;avoir ouvert votre caisse — un règlement en espèces y sera compté à la
        fermeture.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Encaisser</SubmitButton>
      </div>
    </form>
  );
}

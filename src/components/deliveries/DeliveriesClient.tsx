"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDelivery, markDeliveryDelivered } from "@/lib/actions/deliveries";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus, Search, Truck, CheckCircle2, CircleDollarSign } from "lucide-react";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; piecesPerPack: number; packUnit: { symbol: string } | null };
type Employee = { id: string; name: string };
type Delivery = {
  id: string;
  number: string;
  destination: string;
  quantity: number | null;
  pricePerBottle: number | null;
  fee: number;
  paid: boolean;
  status: "EN_ATTENTE" | "LIVREE" | "ANNULEE";
  notes: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  customer: { name: string } | null;
  sale: { number: string } | null;
  user: { name: string } | null;
  product: { name: string } | null;
  assignedTo: { id: string; name: string } | null;
};

function StatusBadge({ status }: { status: Delivery["status"] }) {
  if (status === "LIVREE") return <Badge tone="success">Livrée</Badge>;
  if (status === "ANNULEE") return <Badge tone="danger">Annulée</Badge>;
  return <Badge tone="warning">En attente</Badge>;
}

// Module dédié aux livraisons clients — distinct des Bons de livraison
// (réception fournisseur). Ce qui est décidé au cas par cas (zone, distance,
// secteur...) est le prix par bouteille ; le montant final se déduit toujours
// en multipliant par le nombre total de bouteilles (casiers × bouteilles par
// casier du produit choisi — voir createDelivery côté serveur). Un livreur
// assigné (n'importe quel employé, pas seulement admin/gérant) vient ici
// confirmer lui-même sa propre course une fois effectuée — la page reste
// donc accessible à tous. L'encaissement du paiement se fait exclusivement à
// la Caisse (voir CaisseValidationClient), jamais ici : le livreur ne fait
// que confirmer la livraison, jamais l'argent.
export function DeliveriesClient({
  deliveries,
  customers,
  products,
  employees,
  canManage,
  currentUserId,
  initialSaleId,
  initialCustomerId,
  initialProductId,
  initialQuantityPacks,
}: {
  deliveries: Delivery[];
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  canManage: boolean;
  currentUserId: string;
  initialSaleId: string | null;
  initialCustomerId: string | null;
  initialProductId: string | null;
  initialQuantityPacks: number | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(!!initialSaleId && canManage);
  const [, startTransition] = useTransition();

  // Un employé sans droits de gestion ne voit que les courses qui lui sont
  // confiées — pas le carnet complet de l'entreprise, qui reste réservé à
  // admin/gérant.
  const scoped = canManage ? deliveries : deliveries.filter((d) => d.assignedTo?.id === currentUserId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (d) =>
        d.number.toLowerCase().includes(q) ||
        d.destination.toLowerCase().includes(q) ||
        (d.customer?.name.toLowerCase().includes(q) ?? false)
    );
  }, [scoped, query]);

  const totalDue = deliveries.filter((d) => d.status !== "ANNULEE" && !d.paid).reduce((s, d) => s + d.fee, 0);

  function deliver(id: string) {
    startTransition(async () => {
      await markDeliveryDelivered(id);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title={canManage ? "Livraison client" : "Mes livraisons"}
        subtitle={
          canManage
            ? "Prix par bouteille décidé au cas par cas (zone, distance, secteur...) — le montant total se calcule automatiquement"
            : "Les courses qui vous ont été confiées — confirmez-les une fois effectuées."
        }
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={16} /> Nouvelle livraison
              </button>
            </div>
          ) : undefined
        }
      />

      {canManage && totalDue > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
          <CircleDollarSign size={15} /> {formatMoney(totalDue)} de frais de livraison non encore payés — à encaisser
          depuis la Caisse
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
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium text-right">Quantité</th>
                <th className="px-4 py-3 font-medium text-right">Frais</th>
                <th className="px-4 py-3 font-medium">Assigné à</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                {canManage && <th className="px-4 py-3 font-medium">Paiement</th>}
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
                  <td className="px-4 py-3 text-slate-600">{d.product?.name || "—"}</td>
                  <td className="px-4 py-3 text-right">{d.quantity ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(d.fee)}</td>
                  <td className="px-4 py-3 text-slate-600">{d.assignedTo?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <Badge tone={d.paid ? "success" : "default"}>{d.paid ? "Payée" : "Impayée"}</Badge>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      {d.status === "EN_ATTENTE" && (canManage || d.assignedTo?.id === currentUserId) && (
                        <button
                          onClick={() => deliver(d.id)}
                          title="Confirmer la livraison effectuée"
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-2.5 py-1.5 text-xs font-medium hover:bg-emerald-100"
                        >
                          <CheckCircle2 size={14} /> Confirmer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="px-4 py-8 text-center text-slate-400">
                    {scoped.length === 0
                      ? canManage
                        ? "Aucune livraison enregistrée."
                        : "Aucune livraison ne vous est assignée pour l'instant."
                      : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canManage && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle livraison">
          <DeliveryForm
            customers={customers}
            products={products}
            employees={employees}
            initialSaleId={initialSaleId}
            initialCustomerId={initialCustomerId}
            initialProductId={initialProductId}
            initialQuantityPacks={initialQuantityPacks}
            onDone={() => setShowCreate(false)}
          />
        </Modal>
      )}

    </div>
  );
}

function DeliveryForm({
  customers,
  products,
  employees,
  initialSaleId,
  initialCustomerId,
  initialProductId,
  initialQuantityPacks,
  onDone,
}: {
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  initialSaleId: string | null;
  initialCustomerId: string | null;
  initialProductId: string | null;
  initialQuantityPacks: number | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createDelivery(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  // Livraison organisée depuis un reçu de caisse (voir CaisseValidationClient
  // > "Organiser une livraison") : le produit et la quantité viennent de la
  // vente elle-même et ne doivent plus pouvoir diverger — verrouillés.
  const lockedFromSale = !!initialSaleId && !!initialProductId;
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(initialQuantityPacks != null ? String(initialQuantityPacks) : "");
  const [pricePerBottle, setPricePerBottle] = useState("");

  const product = products.find((p) => p.id === productId) ?? null;
  const piecesPerPack = product?.piecesPerPack || 1;
  const totalBottles = (Number(quantity) || 0) * piecesPerPack;
  const computedFee = totalBottles * (Number(pricePerBottle) || 0);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      {initialSaleId && <input type="hidden" name="saleId" value={initialSaleId} />}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        <Truck size={14} className="shrink-0" />
        Seul le prix par bouteille est à votre appréciation (zone, distance, secteur...) — le montant total se
        calcule automatiquement (casiers × bouteilles par casier × prix).
      </div>
      <div>
        <Label>Client</Label>
        <Select name="customerId" defaultValue={initialCustomerId ?? ""} required>
          <option value="">Sélectionner un client</option>
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
      <div>
        <Label>Produit livré</Label>
        {lockedFromSale ? (
          <>
            <input type="hidden" name="productId" value={productId} />
            <Select disabled value={productId} className="disabled:bg-slate-100 disabled:text-slate-500">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.packUnit ? ` (${p.piecesPerPack} bouteilles / ${p.packUnit.symbol})` : ""}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-400 mt-1">Repris automatiquement du reçu de caisse — non modifiable.</p>
          </>
        ) : (
          <Select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            {products.length === 0 && <option value="">Aucun produit configuré</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.packUnit ? ` (${p.piecesPerPack} bouteilles / ${p.packUnit.symbol})` : ""}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Quantité (casiers)</Label>
          {lockedFromSale ? (
            <>
              <input type="hidden" name="quantity" value={quantity} />
              <Input
                type="number"
                disabled
                value={quantity}
                className="disabled:bg-slate-100 disabled:text-slate-500"
              />
            </>
          ) : (
            <Input
              type="number"
              name="quantity"
              min={1}
              step="1"
              placeholder="Ex : 300"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          )}
        </div>
        <div>
          <Label>Prix par bouteille (FCFA)</Label>
          <Input
            type="number"
            name="pricePerBottle"
            min={1}
            step="1"
            placeholder="Ex : 100"
            value={pricePerBottle}
            onChange={(e) => setPricePerBottle(e.target.value)}
            required
          />
        </div>
      </div>
      {totalBottles > 0 && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="text-slate-600">
            {quantity} casier(s) × {piecesPerPack} bouteilles = {totalBottles} bouteille(s)
          </span>
          <span className="font-semibold text-blue-700">{formatMoney(computedFee)}</span>
        </div>
      )}
      <div>
        <Label>Assigné à</Label>
        <Select name="assignedToId" defaultValue="" required>
          <option value="">Sélectionner un agent</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-400 mt-1">
          La personne choisie reçoit aussitôt une notification et pourra confirmer elle-même la livraison une fois
          effectuée.
        </p>
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


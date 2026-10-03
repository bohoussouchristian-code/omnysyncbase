"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDelivery, markDeliveryDelivered, type DeliveryCartItem } from "@/lib/actions/deliveries";
import { Modal, Input, Select, Label, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus, Search, Truck, CheckCircle2, CircleDollarSign, Trash2 } from "lucide-react";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; piecesPerPack: number; packUnit: { symbol: string } | null };
type Employee = { id: string; name: string };
type DeliveryItem = { quantity: number; product: { name: string; unit: { symbol: string } | null } };
type Delivery = {
  id: string;
  number: string;
  destination: string;
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
  items: DeliveryItem[];
  assignedTo: { id: string; name: string } | null;
};

function StatusBadge({ status }: { status: Delivery["status"] }) {
  if (status === "LIVREE") return <Badge tone="success">Livrée</Badge>;
  if (status === "ANNULEE") return <Badge tone="danger">Annulée</Badge>;
  return <Badge tone="warning">En attente</Badge>;
}

// Module dédié aux livraisons clients — distinct des Bons de livraison
// (réception fournisseur). Une livraison peut couvrir plusieurs produits
// (toute une commande, voir DeliveryItem) — ce qui est décidé au cas par cas
// (zone, distance, secteur...) est le prix par bouteille ; le montant final
// se déduit toujours en multipliant par le nombre total de bouteilles, toutes
// lignes confondues (voir createDelivery côté serveur). Un livreur assigné
// (n'importe quel employé, pas seulement admin/gérant) vient ici confirmer
// lui-même sa propre course une fois effectuée — la page reste donc
// accessible à tous. L'encaissement du paiement se fait exclusivement à la
// Caisse (voir CaisseValidationClient), jamais ici : le livreur ne fait que
// confirmer la livraison, jamais l'argent.
export function DeliveriesClient({
  deliveries,
  customers,
  products,
  employees,
  canManage,
  currentUserId,
  initialSaleId,
  initialCustomerId,
  initialItems,
}: {
  deliveries: Delivery[];
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  canManage: boolean;
  currentUserId: string;
  initialSaleId: string | null;
  initialCustomerId: string | null;
  initialItems: DeliveryCartItem[];
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
                <th className="px-4 py-3 font-medium">Produits</th>
                <th className="px-4 py-3 font-medium text-right">Bouteilles</th>
                <th className="px-4 py-3 font-medium text-right">Frais</th>
                <th className="px-4 py-3 font-medium">Assigné à</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                {canManage && <th className="px-4 py-3 font-medium">Paiement</th>}
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const totalBottles = d.items.reduce((s, it) => s + it.quantity, 0);
                return (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">{d.number}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(d.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{d.customer?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.destination}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.items.length > 0 ? d.items.map((it) => it.product.name).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{totalBottles || "—"}</td>
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
                );
              })}
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
            initialItems={initialItems}
            onDone={() => setShowCreate(false)}
          />
        </Modal>
      )}
    </div>
  );
}

type CartLine = {
  key: string;
  productId: string;
  name: string;
  packQty: number;
  piecesPerPack: number;
  unitLabel: string;
};

function DeliveryForm({
  customers,
  products,
  employees,
  initialSaleId,
  initialCustomerId,
  initialItems,
  onDone,
}: {
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  initialSaleId: string | null;
  initialCustomerId: string | null;
  initialItems: DeliveryCartItem[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Livraison organisée depuis un reçu de caisse (voir CaisseValidationClient
  // > "Organiser une livraison") : TOUS les produits de la vente sont repris,
  // pas seulement le premier — et ne doivent plus pouvoir diverger (verrouillés).
  const lockedFromSale = !!initialSaleId && initialItems.length > 0;

  const [cart, setCart] = useState<CartLine[]>(() =>
    initialItems.map((it, idx) => {
      const p = products.find((pp) => pp.id === it.productId);
      const piecesPerPack = p?.piecesPerPack || 1;
      return {
        key: `${it.productId}-${idx}`,
        productId: it.productId,
        name: p?.name ?? "Produit",
        packQty: Math.round((it.quantity / piecesPerPack) * 100) / 100,
        piecesPerPack,
        unitLabel: p?.packUnit?.symbol || "",
      };
    })
  );

  const [addProductId, setAddProductId] = useState(products[0]?.id ?? "");
  const [addQty, setAddQty] = useState("");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [destination, setDestination] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [pricePerBottle, setPricePerBottle] = useState("");
  const [notes, setNotes] = useState("");

  function addItem() {
    const p = products.find((pp) => pp.id === addProductId);
    const qty = Number(addQty);
    if (!p || !qty || qty <= 0) return;
    const piecesPerPack = p.piecesPerPack || 1;
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === addProductId);
      if (existing) {
        return prev.map((l) => (l.productId === addProductId ? { ...l, packQty: l.packQty + qty } : l));
      }
      return [
        ...prev,
        { key: p.id, productId: p.id, name: p.name, packQty: qty, piecesPerPack, unitLabel: p.packUnit?.symbol || "" },
      ];
    });
    setAddQty("");
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const totalBottles = cart.reduce((s, l) => s + l.packQty * l.piecesPerPack, 0);
  const computedFee = totalBottles * (Number(pricePerBottle) || 0);

  function submit() {
    setError(null);
    if (cart.length === 0) return setError("Ajoutez au moins un produit.");
    if (!customerId) return setError("Client requis.");
    if (!destination.trim()) return setError("Destination requise.");
    if (!assignedToId) return setError("Agent assigné requis.");
    if (!pricePerBottle || Number(pricePerBottle) <= 0) return setError("Le prix par bouteille doit être supérieur à 0.");

    startTransition(async () => {
      const res = await createDelivery({
        saleId: initialSaleId,
        customerId,
        assignedToId,
        destination,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.packQty * l.piecesPerPack })),
        pricePerBottle: Number(pricePerBottle),
        notes: notes || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        <Truck size={14} className="shrink-0" />
        Seul le prix par bouteille est à votre appréciation (zone, distance, secteur...) — le montant total se
        calcule automatiquement (casiers × bouteilles par casier × prix, toutes lignes confondues).
      </div>
      <div>
        <Label>Client</Label>
        <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
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
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Ex : Sous-secteur Anonkoua-Kouté, Abobo"
          required
        />
      </div>

      <div>
        <Label>Produits livrés</Label>
        {cart.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {cart.map((l) => (
              <div
                key={l.key}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  lockedFromSale ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 text-slate-700"
                }`}
              >
                <span>{l.name}</span>
                <span className="flex items-center gap-2">
                  {l.packQty} {l.unitLabel}
                  {!lockedFromSale && (
                    <button type="button" onClick={() => removeItem(l.key)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {lockedFromSale ? (
          <p className="text-xs text-slate-400 mt-1">
            Repris automatiquement du reçu de caisse (toute la commande) — non modifiable.
          </p>
        ) : (
          <div className="flex gap-2">
            <Select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className="flex-1">
              {products.length === 0 && <option value="">Aucun produit configuré</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.packUnit ? ` (${p.piecesPerPack} bouteilles / ${p.packUnit.symbol})` : ""}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={1}
              step="1"
              placeholder="Qté (casiers)"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="w-32"
            />
            <button
              type="button"
              onClick={addItem}
              className="shrink-0 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Ajouter
            </button>
          </div>
        )}
      </div>

      <div>
        <Label>Prix par bouteille (FCFA)</Label>
        <Input
          type="number"
          min={1}
          step="1"
          placeholder="Ex : 100"
          value={pricePerBottle}
          onChange={(e) => setPricePerBottle(e.target.value)}
          required
        />
      </div>

      {totalBottles > 0 && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="text-slate-600">{totalBottles} bouteille(s) au total</span>
          <span className="font-semibold text-blue-700">{formatMoney(computedFee)}</span>
        </div>
      )}

      <div>
        <Label>Assigné à</Label>
        <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} required>
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
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : longue distance, accès difficile..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
